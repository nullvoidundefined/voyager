import type { Persona, TranscriptEntry } from '../types.js';

import { getCustomerResponse } from './customerAgent.js';
import { createMockReq, createMockRes, parseSSEChunks } from './harness.js';

const MAX_TURNS = 10;
const HTTP_OK = 200;
const ENTRIES_PER_TURN = 2;

export interface ToolResult {
  tool_name: string;
  result: unknown;
}

export interface ConversationResult {
  transcript: TranscriptEntry[];
  turns: number;
  completed: boolean;
  error?: string;
  tool_calls: string[];
  tool_results: ToolResult[];
  tripId: string;
}

export async function runConversation(
  persona: Persona,
  chatHandler: (req: unknown, res: unknown) => Promise<void>,
  tripId: string,
  userId: string,
): Promise<ConversationResult> {
  const transcript: TranscriptEntry[] = [];
  const allToolCalls: string[] = [];
  const allToolResults: ToolResult[] = [];
  let completed = false;

  let customerMessage = generateFirstMessage(persona);
  let pendingPlanConfirmation: Record<string, unknown> | undefined;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    transcript.push({ content: customerMessage, role: 'user' });

    const req = createMockReq(
      tripId,
      userId,
      customerMessage,
      pendingPlanConfirmation,
    );
    pendingPlanConfirmation = undefined;
    const res = createMockRes();

    try {
      await chatHandler(req, res);
    } catch (err) {
      return {
        completed: false,
        error: `Agent error on turn ${turn + 1}: ${err instanceof Error ? err.message : String(err)}`,
        tool_calls: allToolCalls,
        tool_results: allToolResults,
        transcript,
        tripId,
        turns: turn + 1,
      };
    }

    // Check for non-SSE error responses (e.g., 409 conflict, 400 validation)
    if (res.statusCode !== HTTP_OK || res.jsonData) {
      return {
        completed: false,
        error: `HTTP ${res.statusCode}: ${JSON.stringify(res.jsonData)}`,
        tool_calls: allToolCalls,
        tool_results: allToolResults,
        transcript,
        tripId,
        turns: turn + 1,
      };
    }

    const events = parseSSEChunks(res.chunks);
    const doneEvent = events.find((e) => e.type === 'done');
    const errorEvent = events.find((e) => e.type === 'error');

    if (errorEvent) {
      return {
        completed: false,
        error: `SSE error: ${JSON.stringify(errorEvent.data)}`,
        tool_calls: allToolCalls,
        tool_results: allToolResults,
        transcript,
        tripId,
        turns: turn + 1,
      };
    }

    let agentText = '';
    const turnToolCalls: string[] = [];

    // Map node types back to tool names for tool_results extraction
    const nodeTypeToTool: Record<string, string> = {
      car_rental_tiles: 'search_car_rentals',
      experience_tiles: 'search_experiences',
      flight_tiles: 'search_flights',
      hotel_tiles: 'search_hotels',
    };

    if (doneEvent?.data?.message) {
      const message = doneEvent.data.message as Record<string, unknown>;
      const nodes = (message.nodes ?? []) as Array<Record<string, unknown>>;

      for (const node of nodes) {
        if (node.type === 'text' && typeof node.content === 'string') {
          agentText += node.content + '\n';
        }
        if (
          node.type === 'tool_progress' &&
          typeof node.tool_name === 'string'
        ) {
          turnToolCalls.push(node.tool_name);
        }

        // Auto-confirm plan_card: simulate user clicking "Start planning"
        if (node.type === 'plan_card' && node.plan_card) {
          pendingPlanConfirmation = node.plan_card as Record<string, unknown>;
        }

        // Capture structured tool results from tile nodes
        const toolName = nodeTypeToTool[node.type as string];
        if (toolName) {
          allToolResults.push({ result: node, tool_name: toolName });
        }
      }
    }

    // Also extract tool calls from tool_progress SSE events
    for (const event of events) {
      if (event.type === 'tool_progress') {
        const toolName = (event.data as Record<string, unknown>).tool_name;
        if (typeof toolName === 'string' && !turnToolCalls.includes(toolName)) {
          turnToolCalls.push(toolName);
        }
      }
    }

    agentText = agentText.trim() || '[No text response]';
    allToolCalls.push(...turnToolCalls);
    transcript.push({
      content: agentText,
      role: 'assistant',
      tool_calls: turnToolCalls.length > 0 ? turnToolCalls : undefined,
    });

    // Get customer's next response
    let nextMessage: string;
    try {
      nextMessage = await getCustomerResponse(persona, transcript);
    } catch (_err) {
      // If customer agent fails, generate contextual fallback
      nextMessage = buildFallbackCustomerMessage(transcript);
    }

    if (!nextMessage || nextMessage.trim() === '') {
      // Empty response — generate contextual fallback
      nextMessage = buildFallbackCustomerMessage(transcript);
    }

    customerMessage = nextMessage;

    if (customerMessage.includes('DONE')) {
      completed = true;
      break;
    }
  }

  return {
    completed,
    tool_calls: allToolCalls,
    tool_results: allToolResults,
    transcript,
    tripId,
    turns: Math.ceil(transcript.length / ENTRIES_PER_TURN),
  };
}

function buildFallbackCustomerMessage(
  transcript: { role: string; content: string }[],
): string {
  const lastAgent = transcript.filter((t) => t.role === 'assistant').pop();
  if (lastAgent?.content.includes('flight'))
    return 'Yes, show me flight options';
  if (lastAgent?.content.includes('hotel')) return 'Yes, find me a hotel';
  return "Sounds good, let's continue planning";
}

function generateFirstMessage(persona: Persona): string {
  const budgetStr = persona.budget ? `, $${persona.budget} budget` : '';

  switch (persona.communication_style) {
    case 'detailed':
      return `I want to plan a trip to ${persona.destination}. I'm traveling from ${persona.origin}, departing ${persona.departure_date}${persona.return_date ? ` and returning ${persona.return_date}` : ' (one-way)'}${budgetStr}, ${persona.travelers} traveler${persona.travelers > 1 ? 's' : ''}.`;
    case 'terse':
      return persona.destination;
    case 'impatient':
      return `${persona.destination}${budgetStr}. Let's go.`;
    case 'conversational':
      return `Hey! I'm thinking about going to ${persona.destination}. What do you think?`;
    default:
      return `I'd like to plan a trip to ${persona.destination}.`;
  }
}
