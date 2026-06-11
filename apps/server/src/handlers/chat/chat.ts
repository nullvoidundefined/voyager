import type { ChatMessage, ChatNode } from '@voyager/shared-types';
import { getAuthUser } from 'app/middleware/requireAuth/getAuthUser.js';
import {
  DEFAULT_COMPLETION_TRACKER,
  computeNudge,
  hasAnySelection,
  noEngagement,
  normalizeCompletionTracker,
  updateCompletionTracker,
} from 'app/prompts/bookingSteps/bookingSteps.js';
import { buildConversationAgentPrompt } from 'app/prompts/subAgents/conversationPrompt.js';
import { buildExperienceAgentPrompt } from 'app/prompts/subAgents/experiencePrompt.js';
import { buildFlightAgentPrompt } from 'app/prompts/subAgents/flightPrompt.js';
import { buildGroundAgentPrompt } from 'app/prompts/subAgents/groundPrompt.js';
import { buildHotelAgentPrompt } from 'app/prompts/subAgents/hotelPrompt.js';
import { buildPlanAgentPrompt } from 'app/prompts/subAgents/planPrompt.js';
import {
  getMessagesByConversation,
  getOrCreateConversation,
  insertMessage,
  updateBookingState,
} from 'app/repositories/conversations/conversations.js';
import { getTripWithDetails } from 'app/repositories/trips/trips.js';
import { findByUserId as findUserPreferences } from 'app/repositories/userPreferences/userPreferences.js';
import { planCardSchema } from 'app/schemas/planCard/planCard.js';
import { runAgentLoop } from 'app/services/agent/agentService.js';
import {
  SUB_AGENT_REQUIRED_TOOLS,
  SUB_AGENT_TOOLS,
  buildDefaultPlanCard,
  selectSubAgent,
} from 'app/services/agent/subAgentService.js';
import posthog from 'app/services/analytics/posthog.js';
import {
  addTokenUsage,
  isOverDailyBudget,
} from 'app/services/cache/tokenBudgetService.js';
import { getEnrichmentNodes } from 'app/services/external/enrichment.js';
import type { TripPlanCard } from 'app/types/planCard.js';
import { ApiError } from 'app/utils/ApiError.js';
import { logger } from 'app/utils/logs/logger.js';
import type { Request, Response } from 'express';

import {
  applyPlanConfirmation,
  buildClaudeMessages,
  buildMissingFieldsForm,
  buildTripContext,
  computeFlowPosition,
  createSSEEmitter,
  flushSSE,
  toFlowInput,
} from './helpers.js';

// In-memory lock for single-replica defense; Redis SET NX EX layer
// (acquireConversationLock below) prevents concurrent agent loops
// across replicas on horizontal scale.
const activeConversations = new Set<string>();

/** Returns the number of currently active agent loops (for health monitoring). */
export function getActiveConversationCount(): number {
  return activeConversations.size;
}

// P2-01: lock TTL is a safety net; if a worker dies mid-loop the lock
// auto-expires so the conversation is not permanently wedged.
const REDIS_LOCK_TTL_S = 180;

async function acquireConversationLock(
  conversationId: string,
): Promise<boolean> {
  if (activeConversations.has(conversationId)) return false;
  activeConversations.add(conversationId);
  try {
    const { getRedis } = await import('app/services/cache/cacheService.js');
    const redis = getRedis();
    if (redis) {
      const key = `conversation:lock:${conversationId}`;
      const acquired = await redis.set(key, '1', 'EX', REDIS_LOCK_TTL_S, 'NX');
      if (!acquired) {
        activeConversations.delete(conversationId);
        return false;
      }
    }
  } catch {
    // Redis unavailable: fall through to in-memory lock only.
  }
  return true;
}

async function releaseConversationLock(conversationId: string): Promise<void> {
  activeConversations.delete(conversationId);
  try {
    const { getRedis } = await import('app/services/cache/cacheService.js');
    const redis = getRedis();
    if (redis) {
      await redis.del(`conversation:lock:${conversationId}`);
    }
  } catch {
    // Best-effort: TTL will expire the lock.
  }
}

export async function chat(req: Request, res: Response) {
  const tripId = req.params.id as string;
  const userId = getAuthUser(req).id;
  const MAX_MESSAGE_LENGTH = 2000;
  const { message, planConfirmation } = req.body as {
    message?: unknown;
    planConfirmation?: unknown;
  };

  if (!message || typeof message !== 'string') {
    throw ApiError.badRequest('message is required');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw ApiError.badRequest(
      `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
    );
  }

  // FIN-01 / FIN-05: per-user daily token budget guard.
  // Check BEFORE opening the SSE stream so we can return a clean HTTP
  // error status. Failing open (Redis down) is intentional: a Redis
  // outage should not block legitimate users.
  if (await isOverDailyBudget(userId)) {
    posthog.capture({
      distinctId: userId,
      event: 'daily budget exceeded',
      properties: { trip_id: tripId },
    });
    throw new ApiError(
      429,
      'DAILY_BUDGET_EXCEEDED',
      "You have reached today's agent usage limit. This is a portfolio demo with a conservative per-user daily budget to keep LLM costs bounded. The limit resets at UTC midnight.",
    );
  }

  const trip = await getTripWithDetails(tripId, userId);
  if (!trip) {
    throw ApiError.notFound('Trip not found');
  }

  const userPrefs = await findUserPreferences(userId);
  const conversation = await getOrCreateConversation(tripId);

  if (!(await acquireConversationLock(conversation.id))) {
    throw new ApiError(
      409,
      'CONFLICT',
      'A response is already being generated for this trip. Please wait.',
    );
  }

  const history = await getMessagesByConversation(conversation.id);
  const claudeMessages = buildClaudeMessages(history, message);
  const tripContext = buildTripContext(trip, userPrefs);

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.setTimeout(0);
  req.socket.setTimeout(150_000);

  req.on('close', () => {
    void releaseConversationLock(conversation.id);
  });

  // Persist user message
  await insertMessage({
    conversation_id: conversation.id,
    role: 'user',
    content: message,
    nodes: [{ type: 'text', content: message }],
  });
  posthog.capture({
    distinctId: userId,
    event: 'chat message sent',
    properties: {
      trip_id: tripId,
      conversation_id: conversation.id,
      message_length: message.length,
      is_first_message: history.length === 0,
    },
  });

  // Fetch enrichment on first message only
  const isFirstMessage = history.length === 0;
  let enrichmentNodes: ChatNode[] = [];
  if (trip.destination && isFirstMessage) {
    try {
      enrichmentNodes =
        (await getEnrichmentNodes(
          trip.destination,
          trip.origin ?? undefined,
        )) ?? [];
    } catch (err) {
      logger.warn({ err, tripId }, 'Failed to fetch enrichment nodes');
    }
  }

  const hasCriticalAdvisory = enrichmentNodes.some(
    (n) =>
      n.type === 'advisory' && 'severity' in n && n.severity === 'critical',
  );

  const onEvent = createSSEEmitter(res);

  let tracker = normalizeCompletionTracker(
    conversation.booking_state ?? DEFAULT_COMPLETION_TRACKER,
  );

  if (planConfirmation !== null && planConfirmation !== undefined) {
    // SEC-04: validate shape + bounds before persisting to booking_state.
    const parsed = planCardSchema.safeParse(planConfirmation);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid planConfirmation payload');
    }
    tracker = applyPlanConfirmation(tracker, parsed.data as TripPlanCard);
    await updateBookingState(conversation.id, tracker);
  }

  const flowPosition = computeFlowPosition(trip, tracker);
  const nudge = computeNudge(tracker);

  const subAgentType = selectSubAgent(flowPosition, tracker);
  const allowedTools = SUB_AGENT_TOOLS[subAgentType];

  let systemPromptOverride: string | undefined;
  switch (subAgentType) {
    case 'plan':
      systemPromptOverride = buildPlanAgentPrompt(
        buildDefaultPlanCard(toFlowInput(trip)),
        tripContext,
      );
      break;
    case 'flight':
      systemPromptOverride = buildFlightAgentPrompt(tripContext, tracker);
      break;
    case 'hotel':
      systemPromptOverride = buildHotelAgentPrompt(tripContext, tracker);
      break;
    case 'ground':
      systemPromptOverride = buildGroundAgentPrompt(tripContext, tracker);
      break;
    case 'experience':
      systemPromptOverride = buildExperienceAgentPrompt(tripContext, tracker);
      break;
    case 'conversation':
      systemPromptOverride = buildConversationAgentPrompt(tripContext, tracker);
      break;
    default:
      systemPromptOverride = undefined;
  }

  try {
    const result = await runAgentLoop(
      claudeMessages,
      tripContext,
      onEvent,
      conversation.id,
      { tripId, userId, requestId: req.id as string },
      enrichmentNodes,
      flowPosition,
      { hasCriticalAdvisory, nudge },
      tracker,
      systemPromptOverride,
      allowedTools,
      SUB_AGENT_REQUIRED_TOOLS[subAgentType],
    );

    // FIN-01 / FIN-05: increment the per-user daily token counter with
    // the output tokens used by this turn. Input tokens are not counted
    // against the budget because context-reprocessing is out of the
    // user's direct control; output tokens are a more honest measure
    // of what the user "spent".
    const outputTokens =
      typeof result.total_tokens?.output === 'number'
        ? result.total_tokens.output
        : 0;
    if (outputTokens > 0) {
      await addTokenUsage(userId, outputTokens);
    }
    posthog.capture({
      distinctId: userId,
      event: 'agent turn completed',
      properties: {
        trip_id: tripId,
        conversation_id: conversation.id,
        tool_call_count: result.tool_calls?.length ?? 0,
        input_tokens: result.total_tokens?.input ?? 0,
        output_tokens: outputTokens,
      },
    });

    // Post-loop: check for missing fields and update completion tracker
    const updatedTrip = await getTripWithDetails(tripId, userId);
    if (updatedTrip) {
      const newTracker = updateCompletionTracker(
        tracker,
        result,
        toFlowInput(updatedTrip),
      );

      const updatedPosition = computeFlowPosition(updatedTrip, newTracker);
      if (updatedPosition.phase === 'COLLECT_DETAILS') {
        const formNode = buildMissingFieldsForm(updatedTrip);
        if (formNode) result.nodes.push(formNode);
      }

      // Empty itinerary guard -- only relevant once the user is actively booking
      if (
        updatedPosition.phase === 'PLANNING' &&
        !hasAnySelection(newTracker) &&
        noEngagement(newTracker)
      ) {
        result.nodes.push({
          type: 'text',
          content:
            "You haven't selected anything for your trip yet. Want to go back and explore some options?",
        });
      }

      await updateBookingState(conversation.id, newTracker);
    }

    // Persist assistant message
    const assistantMessage = await insertMessage({
      conversation_id: conversation.id,
      role: 'assistant',
      content: result.response,
      tool_calls_json:
        result.tool_calls.length > 0 ? result.tool_calls : undefined,
      nodes: result.nodes,
      token_count: result.total_tokens.input + result.total_tokens.output,
    });

    const chatMessage: ChatMessage = {
      id: assistantMessage.id,
      role: 'assistant',
      nodes: result.nodes,
      sequence: assistantMessage.sequence,
      created_at: assistantMessage.created_at,
    };
    res.write(
      `event: done\ndata: ${JSON.stringify({ type: 'done', message: chatMessage })}\n\n`,
    );
    flushSSE(res);
  } catch (err) {
    logger.error({ err, tripId }, 'Agent loop failed');
    res.write(
      `event: error\ndata: ${JSON.stringify({ type: 'error', error: 'Agent encountered an error' })}\n\n`,
    );
    flushSSE(res);
  } finally {
    await releaseConversationLock(conversation.id);
    res.end();
  }
}

export async function getMessages(req: Request, res: Response) {
  const tripId = req.params.id as string;
  const userId = getAuthUser(req).id;

  const trip = await getTripWithDetails(tripId, userId);
  if (!trip) {
    throw ApiError.notFound('Trip not found');
  }

  const conversation = await getOrCreateConversation(tripId);
  const dbMessages = await getMessagesByConversation(conversation.id);

  const messages: ChatMessage[] = dbMessages
    .filter((m) => m.role !== 'tool')
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      nodes:
        m.nodes && m.nodes.length > 0
          ? m.nodes
          : [{ type: 'text' as const, content: m.content ?? '' }],
      sequence: m.sequence,
      created_at: m.created_at,
    }));

  if (messages.length === 0) {
    const isPlaceholder =
      !trip.destination ||
      trip.destination === 'Planning...' ||
      trip.destination === 'New trip';

    const welcomeText = isPlaceholder
      ? "Hi! I'd love to help plan your trip. Where would you like to go, when are you traveling, and what's your budget?"
      : `Great choice! Let's plan your trip to **${trip.destination}**. When are you traveling, what's your budget, and where will you be coming from?`;

    messages.unshift({
      id: 'welcome',
      role: 'assistant',
      nodes: [{ type: 'text', content: welcomeText }],
      sequence: 0,
      created_at: new Date().toISOString(),
    });
  }

  res.json({ messages });
}
