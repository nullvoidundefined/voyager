/**
 * Provides a deterministic mock @anthropic-ai/sdk client for use as a test
 * fixture. Drives scripted conversation scenarios so agent tests run without
 * real LLM calls. Lives outside __tests__ so multiple suites can import it.
 */
import type Anthropic from '@anthropic-ai/sdk';

/**
 * Deterministic mock of the @anthropic-ai/sdk client used by the
 * AgentOrchestrator. Drives scripted conversation scenarios so the
 * E2E suite can exercise the chat surface end-to-end without burning
 * Anthropic tokens or requiring an API key in CI.
 *
 * Scenario scripts:
 *
 * DEFAULT_SCRIPT (backward-compatible 3-iteration happy path):
 *   Step 0 (0 assistant messages): search_flights + search_hotels tool_use
 *   Step 1 (1 assistant message): format_response with quick_replies
 *   Step 2 (2+ assistant messages): end_turn
 *
 * SELECTION_SCRIPT (4+ iteration flow with tile selection):
 *   Step 0: Same as default step 0 (search tools)
 *   Step 1: Same as default step 1 (format_response with quick_replies)
 *   Step 2: When user message contains selection keywords ("cheapest",
 *           "first", "take") -> format_response with booking confirmation
 *   Step 3+: end_turn
 *
 * Use setMockScenario() to switch between scripts. The active scenario
 * is read by MockAnthropicClient when creating streams.
 */

// ── Constants ──────────────────────────────────────────────────────

const MOCK_END_TEXT =
  'Here are some options I found. Let me know which you prefer.';

const MOCK_QUICK_REPLIES = [
  "I'll take the cheapest flight",
  'Show me more hotels',
  'Confirm booking',
];

const MOCK_BOOKING_CONFIRMATION_TEXT =
  "Great choice! I've selected the cheapest flight for you. Here are the booking details.";

const MOCK_BOOKING_QUICK_REPLIES = ['Confirm booking', 'Change selection'];

const SELECTION_KEYWORDS = ['cheapest', 'first', 'take'];

// ── Types ──────────────────────────────────────────────────────────

interface MessageParam {
  role: 'user' | 'assistant';
  content: unknown;
}

interface StreamParams {
  messages: MessageParam[];
  [key: string]: unknown;
}

interface MockStreamListeners {
  text: Array<(chunk: string) => void>;
}

type MockContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool_use';
      id: string;
      name: string;
      input: Record<string, unknown>;
    };

interface MockFinalMessage {
  content: MockContentBlock[];
  stop_reason: 'end_turn' | 'tool_use';
  usage: { input_tokens: number; output_tokens: number };
}

export interface ScenarioStep {
  condition: (messages: MessageParam[]) => boolean;
  response: () => MockFinalMessage;
}

export type ScenarioScript = ScenarioStep[];

export type MockScenarioName = 'default' | 'selection' | 'selectFlight';

// ── Helpers ────────────────────────────────────────────────────────

function countAssistantMessages(messages: MessageParam[]): number {
  return messages.filter((m) => m.role === 'assistant').length;
}

function lastUserMessageContainsKeyword(
  messages: MessageParam[],
  keywords: string[],
): boolean {
  const userMessages = messages.filter((m) => m.role === 'user');
  const last = userMessages[userMessages.length - 1];
  if (!last) return false;
  const text =
    typeof last.content === 'string'
      ? last.content
      : JSON.stringify(last.content);
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

// ── Response builders ──────────────────────────────────────────────

function buildIterationOneToolUse(): MockFinalMessage {
  return {
    content: [
      {
        type: 'tool_use',
        id: 'mock-toolu-flights-1',
        name: 'search_flights',
        // Field names must match searchFlightsSchema exactly:
        // origin, destination, departure_date, return_date,
        // passengers (not "adults"). Mismatched field names get
        // rejected by Zod, the executor turns the error into a
        // string result, and buildNodeFromToolResult returns
        // null instead of a flight_tiles node. The result is a
        // silently empty chat with no tiles.
        input: {
          origin: 'DEN',
          destination: 'SFO',
          departure_date: '2026-06-01',
          return_date: '2026-06-04',
          passengers: 2,
        },
      },
      {
        type: 'tool_use',
        id: 'mock-toolu-hotels-1',
        name: 'search_hotels',
        // Field names must match searchHotelsSchema exactly:
        // city (not "location"), check_in (not "check_in_date"),
        // check_out (not "check_out_date"), guests (not "adults").
        input: {
          city: 'San Francisco',
          check_in: '2026-06-01',
          check_out: '2026-06-04',
          guests: 2,
        },
      },
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

function buildIterationTwoFormatResponse(): MockFinalMessage {
  return {
    content: [
      {
        type: 'tool_use',
        id: 'mock-toolu-format-1',
        name: 'format_response',
        input: {
          text: MOCK_END_TEXT,
          quick_replies: MOCK_QUICK_REPLIES,
        },
      },
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

function buildBookingConfirmationFormatResponse(): MockFinalMessage {
  return {
    content: [
      {
        type: 'tool_use',
        id: 'mock-toolu-format-2',
        name: 'format_response',
        input: {
          text: MOCK_BOOKING_CONFIRMATION_TEXT,
          quick_replies: MOCK_BOOKING_QUICK_REPLIES,
        },
      },
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

function buildEndTurn(): MockFinalMessage {
  return {
    content: [{ type: 'text', text: MOCK_END_TEXT }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 0, output_tokens: MOCK_END_TEXT.length },
  };
}

// ENG-17 / B24: persisting a selection on the server is what flips
// aria-pressed=true on the tile (the SelectableCardGroup reads
// confirmedId from the GET /trips/:id response, not from the local
// click). This step calls select_flight so the next trip GET sees
// trip_flights.selected = true for this flight, and the next render
// shows aria-pressed=true on the chosen tile. Used by the
// selection-with-persistence scenario for US-23 E2E coverage.
function buildSelectFlightCall(): MockFinalMessage {
  return {
    content: [
      {
        type: 'tool_use',
        id: 'mock-toolu-select-flight-1',
        name: 'select_flight',
        // Fields must match selectFlightSchema. The mock picks a
        // fixture-shaped flight (Iberia IB456 at $380) so an E2E test
        // can assert which tile becomes aria-pressed.
        input: {
          airline: 'Iberia',
          flight_number: 'IB456',
          origin: 'DEN',
          destination: 'SFO',
          price: 380,
          currency: 'USD',
        },
      },
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

// ── Scenario scripts ───────────────────────────────────────────────

const DEFAULT_SCRIPT: ScenarioScript = [
  {
    condition: (msgs) => countAssistantMessages(msgs) === 0,
    response: buildIterationOneToolUse,
  },
  {
    condition: (msgs) => countAssistantMessages(msgs) === 1,
    response: buildIterationTwoFormatResponse,
  },
  {
    // Fallback: 2+ assistant messages -> end_turn
    condition: () => true,
    response: buildEndTurn,
  },
];

const SELECTION_SCRIPT: ScenarioScript = [
  {
    condition: (msgs) => countAssistantMessages(msgs) === 0,
    response: buildIterationOneToolUse,
  },
  {
    condition: (msgs) => countAssistantMessages(msgs) === 1,
    response: buildIterationTwoFormatResponse,
  },
  {
    // Step 2: user selected something (contains selection keyword)
    // and we have exactly 2 prior assistant messages
    condition: (msgs) =>
      countAssistantMessages(msgs) === 2 &&
      lastUserMessageContainsKeyword(msgs, SELECTION_KEYWORDS),
    response: buildBookingConfirmationFormatResponse,
  },
  {
    // Fallback: 3+ assistant messages -> end_turn
    condition: () => true,
    response: buildEndTurn,
  },
];

// ENG-17: selection scenario with server-side persistence. Step 2
// calls select_flight so the server inserts a trip_flight row with
// selected=true. The orchestrator runs select_flight, then re-enters
// the loop for step 3 which delivers the booking confirmation.
const SELECT_FLIGHT_SCRIPT: ScenarioScript = [
  {
    condition: (msgs) => countAssistantMessages(msgs) === 0,
    response: buildIterationOneToolUse,
  },
  {
    condition: (msgs) => countAssistantMessages(msgs) === 1,
    response: buildIterationTwoFormatResponse,
  },
  {
    // User signals selection: call select_flight to persist.
    condition: (msgs) =>
      countAssistantMessages(msgs) === 2 &&
      lastUserMessageContainsKeyword(msgs, SELECTION_KEYWORDS),
    response: buildSelectFlightCall,
  },
  {
    // Right after select_flight returns success, narrate confirmation.
    condition: (msgs) => countAssistantMessages(msgs) === 3,
    response: buildBookingConfirmationFormatResponse,
  },
  {
    // Fallback: end the turn.
    condition: () => true,
    response: buildEndTurn,
  },
];

const SCENARIO_MAP: Record<MockScenarioName, ScenarioScript> = {
  default: DEFAULT_SCRIPT,
  selection: SELECTION_SCRIPT,
  selectFlight: SELECT_FLIGHT_SCRIPT,
};

// ── Module-level state ─────────────────────────────────────────────

let activeScenario: MockScenarioName = 'default';

export function setMockScenario(name: MockScenarioName): void {
  activeScenario = name;
}

export function getMockScenario(): MockScenarioName {
  return activeScenario;
}

/** Reset to default. Exported for test cleanup. */
export function resetMockScenario(): void {
  activeScenario = 'default';
}

// ── Stream implementation ──────────────────────────────────────────

function resolveResponse(
  script: ScenarioScript,
  messages: MessageParam[],
): MockFinalMessage {
  for (const step of script) {
    if (step.condition(messages)) {
      return step.response();
    }
  }
  // Should never reach here because scripts end with a () => true
  // fallback, but just in case:
  return buildEndTurn();
}

class MockMessageStream {
  private readonly listeners: MockStreamListeners = { text: [] };
  private readonly response: MockFinalMessage;

  constructor(script: ScenarioScript, messages: MessageParam[]) {
    this.response = resolveResponse(script, messages);
  }

  on(event: 'text', cb: (chunk: string) => void): this {
    if (event === 'text') {
      this.listeners.text.push(cb);
    }
    return this;
  }

  async finalMessage(): Promise<MockFinalMessage> {
    // Emit text deltas only when the response is end_turn (the
    // tool_use iterations have no text to stream).
    const textBlock = this.response.content.find(
      (b): b is { type: 'text'; text: string } => b.type === 'text',
    );
    if (textBlock) {
      for (const word of textBlock.text.split(' ')) {
        for (const cb of this.listeners.text) {
          cb(`${word} `);
        }
      }
    }
    return this.response;
  }
}

export class MockAnthropicClient {
  messages = {
    stream: (params: StreamParams): MockMessageStream => {
      const script = SCENARIO_MAP[activeScenario];
      return new MockMessageStream(script, params.messages ?? []);
    },
  };
}

/**
 * True when the server should swap the real Anthropic SDK for the
 * deterministic mock. Recognized only as the literal string '1'
 * to avoid accidental activation from truthy strings.
 */
export function isAnthropicMockMode(): boolean {
  return process.env.E2E_MOCK_ANTHROPIC === '1';
}

/**
 * Returns a mock client when E2E_MOCK_ANTHROPIC=1, otherwise
 * undefined. Callers should fall back to constructing a real
 * Anthropic client when this returns undefined.
 *
 * The return type is cast to `Anthropic` because the orchestrator's
 * config field is typed against the real SDK class. The mock only
 * implements the subset of methods the orchestrator actually calls;
 * any other access at runtime is a programming error and should
 * crash loudly.
 */
export function getMockAnthropicClientIfEnabled(): Anthropic | undefined {
  if (!isAnthropicMockMode()) {
    return undefined;
  }
  return new MockAnthropicClient() as unknown as Anthropic;
}
