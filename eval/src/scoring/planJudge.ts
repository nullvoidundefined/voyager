/**
 * Plan quality judge for Voyager. Evaluates a single agent turn on six
 * dimensions (budget_adherence, completeness, preference_alignment,
 * response_quality, tool_efficiency, safety_and_flags) by independently
 * recomputing budget math and checking safety invariants. Complements the
 * conversation-level judge in judge.ts, which scores tone and task completion
 * across a full transcript. This judge scores structural plan quality from a
 * single assistant turn.
 */
import Anthropic from '@anthropic-ai/sdk';

export interface TripContext {
  destination: string;
  origin: string;
  budget_total: number | null;
  budget_currency: string;
  travelers: number;
  departure_date: string;
  return_date: string | null;
}

export interface ToolCallRecord {
  tool_name: string;
  tool_id?: string;
  input: Record<string, unknown>;
  result: unknown;
}

export interface PlanTurnInput {
  user_input: string;
  trip_context: TripContext;
  tool_calls: ToolCallRecord[];
  response_nodes: unknown[];
}

export interface DimensionScore {
  score: number;
  reason: string;
}

export interface PlanJudgeResult {
  dimensions: {
    budget_adherence: DimensionScore;
    completeness: DimensionScore;
    preference_alignment: DimensionScore;
    response_quality: DimensionScore;
    tool_efficiency: DimensionScore;
    safety_and_flags: DimensionScore;
  };
  flags: string[];
  overall_score: number;
  verdict: string;
}

const PLAN_JUDGE_PROMPT = `You are an expert evaluator for Voyager, an AI travel-planning agent. The agent receives a trip request (destination, dates, budget, traveler count, preferences), calls tools in a multi-step loop (search_flights, search_hotels, search_experiences, calculate_remaining_budget, get_destination_info; max 8 calls), and returns an ordered list of structured response nodes (text, flight_tiles, hotel_tiles, experience_tiles, budget_bar, advisory, quick_replies, itinerary, plan_card).

You are given four inputs: user_input (the traveler's message), trip_context (destination, origin, budget_total, budget_currency, travelers, departure_date, return_date), tool_calls (the ordered tool calls the agent made, with inputs and results), and response_nodes (the ordered nodes the agent returned).

Evaluate the agent's turn against the six dimensions below. Score each dimension 1-5 (5 = excellent, 1 = unacceptable) and give a one-sentence reason grounded in the specific inputs. Then produce an overall score (1-5) and a 2-3 sentence verdict. Call the submit_evaluation tool with your results.

Dimensions:
1. budget_adherence - Did the assembled plan (flights + hotel nights + experiences, multiplied by traveler count where applicable) fit within budget_total? Recompute the totals yourself from the tool results; never trust the agent's arithmetic. Flight cost is per person round trip times travelers. Hotel cost is nightly rate times the number of nights (count nights between departure_date and return_date). Experience cost is per person times travelers unless stated otherwise. Penalize plans that exceed budget. If the plan exceeds budget but the agent surfaced a budget warning advisory and adjusted or flagged it, penalize less. If it silently exceeds budget, penalize hard.
2. completeness - Did the agent cover the categories the trip requires: flights, lodging, and experiences/activities, plus a budget summary? A plan missing a category the user needs (e.g., no hotel for a multi-day trip) is incomplete. Account for what the user actually asked for: a flights-only request is complete with flights alone.
3. preference_alignment - Did the agent honor the user's stated preferences (vibe, neighborhood, dietary, pace, interests, non-stop flights, star rating, budget priorities)? Penalize results that ignore or contradict an explicit preference.
4. response_quality - Is the narrative text clear, accurate, and consistent with the tiles and tool results? Are node types used appropriately and ordered sensibly? Penalize hallucinated details not present in tool results, contradictions between text and tiles, and confusing structure.
5. tool_efficiency - Did the agent gather the data it needed without waste? Penalize redundant or duplicate tool calls (same search twice), missing calls that left it responding without data, and exceeding the 8-call limit. Reward gathering exactly what the plan required.
6. safety_and_flags - Did the agent correctly surface advisories and avoid silent failures? Required flags: an advisory when the plan is over budget; correct traveler count throughout; no recommending a category with zero results as if it succeeded; no responding before any tool returned data. Penalize wrong traveler count, severe over-budget with no advisory, and confidently presenting empty or failed tool results.

Mandatory safety checks - list each that applies in the flags array:
- over_budget_no_advisory: assembled plan exceeds budget_total and no advisory node warns the user.
- missing_category: a category the trip requires (flights/hotel/experiences) is absent from response_nodes.
- wrong_traveler_count: tool inputs or cost math use a traveler count different from trip_context.travelers.
- responded_without_data: the agent emitted a recommendation with no successful supporting tool call.
- redundant_tool_calls: the same tool was called with the same input more than once.
- empty_results_presented: the agent presented a tile/recommendation backed by an empty or errored tool result.

Recompute all budget math yourself before scoring. Be strict: a confident, well-written response that is over budget without a warning, or that uses the wrong traveler count, is a poor response regardless of prose quality.`;

const DIMENSION_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number', description: 'Score 1-5' },
    reason: {
      type: 'string',
      description: 'One sentence grounded in the specific inputs',
    },
  },
  required: ['score', 'reason'],
} as const;

const SUBMIT_EVALUATION_TOOL: Anthropic.Tool = {
  name: 'submit_evaluation',
  description: 'Submit the structured evaluation result',
  input_schema: {
    type: 'object',
    properties: {
      dimensions: {
        type: 'object',
        properties: {
          budget_adherence: DIMENSION_SCHEMA,
          completeness: DIMENSION_SCHEMA,
          preference_alignment: DIMENSION_SCHEMA,
          response_quality: DIMENSION_SCHEMA,
          tool_efficiency: DIMENSION_SCHEMA,
          safety_and_flags: DIMENSION_SCHEMA,
        },
        required: [
          'budget_adherence',
          'completeness',
          'preference_alignment',
          'response_quality',
          'tool_efficiency',
          'safety_and_flags',
        ],
      },
      flags: { type: 'array', items: { type: 'string' } },
      overall_score: { type: 'number', description: 'Overall score 1-5' },
      verdict: { type: 'string', description: '2-3 sentence verdict' },
    },
    required: ['dimensions', 'flags', 'overall_score', 'verdict'],
  },
};

const DEFAULT_PLAN_JUDGE_MODEL = 'claude-opus-4-8';

let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

function getPlanJudgeModel(): string {
  return process.env.EVAL_PLAN_JUDGE_MODEL ?? DEFAULT_PLAN_JUDGE_MODEL;
}

function buildUserContent(input: PlanTurnInput): string {
  return [
    `user_input: ${JSON.stringify(input.user_input)}`,
    `trip_context: ${JSON.stringify(input.trip_context)}`,
    `tool_calls: ${JSON.stringify(input.tool_calls)}`,
    `response_nodes: ${JSON.stringify(input.response_nodes)}`,
  ].join('\n\n');
}

export async function runPlanJudge(
  input: PlanTurnInput,
): Promise<PlanJudgeResult> {
  const response = await callJudgeApi(input);
  return extractToolResult(response);
}

async function callJudgeApi(input: PlanTurnInput): Promise<Anthropic.Message> {
  return getClient().messages.create({
    model: getPlanJudgeModel(),
    max_tokens: 3000,
    system: PLAN_JUDGE_PROMPT,
    tools: [SUBMIT_EVALUATION_TOOL],
    tool_choice: { type: 'tool', name: 'submit_evaluation' },
    messages: [{ role: 'user', content: buildUserContent(input) }],
  });
}

function extractToolResult(response: Anthropic.Message): PlanJudgeResult {
  const block = response.content.find((b) => b.type === 'tool_use');
  if (block?.type === 'tool_use') {
    return block.input as PlanJudgeResult;
  }
  const fallback: DimensionScore = {
    score: 3,
    reason: 'Judge returned no tool call',
  };
  return {
    dimensions: {
      budget_adherence: fallback,
      completeness: fallback,
      preference_alignment: fallback,
      response_quality: fallback,
      tool_efficiency: fallback,
      safety_and_flags: fallback,
    },
    flags: ['parse_error'],
    overall_score: 3,
    verdict: 'Judge returned no tool call.',
  };
}

const EXPECTED_DIMENSIONS: Array<keyof PlanJudgeResult['dimensions']> = [
  'budget_adherence',
  'completeness',
  'preference_alignment',
  'response_quality',
  'tool_efficiency',
  'safety_and_flags',
];

export function computePlanScore(result: PlanJudgeResult): number {
  const scores = EXPECTED_DIMENSIONS.map(
    (k) => result.dimensions[k]?.score,
  ).filter((s): s is number => typeof s === 'number' && !Number.isNaN(s));
  if (scores.length === 0) return 0;
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return Math.round((avg / 5) * 100) / 100;
}
