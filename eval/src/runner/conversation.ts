import type { Persona, TranscriptEntry } from '../types.js';
import { getCustomerResponse } from './customer-agent.js';
import { createMockReq, createMockRes, parseSSEChunks } from './harness.js';

const MAX_TURNS = 10;

export interface ConversationResult {
  transcript: TranscriptEntry[];
  turns: number;
  completed: boolean;
  error?: string;
  tool_calls: string[];
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
  let completed = false;

  let customerMessage = generateFirstMessage(persona);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    transcript.push({ role: 'user', content: customerMessage });

    const req = createMockReq(tripId, userId, customerMessage);
    const res = createMockRes();

    try {
      await chatHandler(req, res);
    } catch (err) {
      return {
        transcript,
        turns: turn + 1,
        completed: false,
        error: `Agent error on turn ${turn + 1}: ${err instanceof Error ? err.message : String(err)}`,
        tool_calls: allToolCalls,
        tripId,
      };
    }

    // Check for non-SSE error responses (e.g., 409 conflict, 400 validation)
    if (res.statusCode !== 200 || res.jsonData) {
      return {
        transcript,
        turns: turn + 1,
        completed: false,
        error: `HTTP ${res.statusCode}: ${JSON.stringify(res.jsonData)}`,
        tool_calls: allToolCalls,
        tripId,
      };
    }

    const events = parseSSEChunks(res.chunks);
    const doneEvent = events.find((e) => e.type === 'done');
    const errorEvent = events.find((e) => e.type === 'error');

    if (errorEvent) {
      return {
        transcript,
        turns: turn + 1,
        completed: false,
        error: `SSE error: ${JSON.stringify(errorEvent.data)}`,
        tool_calls: allToolCalls,
        tripId,
      };
    }

    let agentText = '';
    const turnToolCalls: string[] = [];

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
      role: 'assistant',
      content: agentText,
      tool_calls: turnToolCalls.length > 0 ? turnToolCalls : undefined,
    });

    // Get customer's next response
    customerMessage = await getCustomerResponse(persona, transcript);

    if (customerMessage.includes('DONE')) {
      completed = true;
      break;
    }
  }

  return {
    transcript,
    turns: Math.ceil(transcript.length / 2),
    completed,
    tool_calls: allToolCalls,
    tripId,
  };
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
