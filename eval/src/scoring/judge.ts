import Anthropic from '@anthropic-ai/sdk';

import type { JudgeScores, Persona, TranscriptEntry } from '../types.js';

let anthropic: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

// Cross-model judge validation (audit follow-up): the judge model
// used to be hardcoded, which meant the eval score measured the
// grader's self-consistency on one model, not the product's
// robustness. EVAL_JUDGE_MODEL overrides the default at run time so
// the adversarial runner can iterate across (e.g.) claude-haiku-4-5,
// claude-sonnet-5, claude-opus-4-8 and compare pass-rates.
// Exported so the retired-model regression test can pin the default:
// claude-sonnet-4-20250514 retired and 404'd every eval run (2026-07-05).
const DEFAULT_JUDGE_MODEL = 'claude-sonnet-5';
export function getJudgeModel(): string {
  return process.env.EVAL_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL;
}

const JUDGE_PROMPT = `You are an expert evaluator assessing the quality of a travel planning AI agent. You will be given a customer persona and a conversation transcript.

Score the agent on each dimension from 0.0 to 1.0 (one decimal place). Provide a one-sentence justification for each.

## Dimensions

1. **task_completion** (0.0-1.0): Did the agent address the customer's goals? Collect details, search, help select?
2. **efficiency** (0.0-1.0): Did it work without unnecessary back-and-forth or repeated questions?
3. **relevance** (0.0-1.0): Were suggestions relevant to budget, preferences, and travel style?
4. **tone** (0.0-1.0): Natural, concise, helpful? Not robotic, verbose, or generic?
5. **error_recovery** (0.0-1.0): How well did it handle unexpected inputs or edge cases?

Respond in this exact JSON format (no markdown, no code fences):
{"task_completion":{"score":0.0,"justification":"..."},"efficiency":{"score":0.0,"justification":"..."},"relevance":{"score":0.0,"justification":"..."},"tone":{"score":0.0,"justification":"..."},"error_recovery":{"score":0.0,"justification":"..."}}`;

export async function runJudge(
  persona: Persona,
  transcript: TranscriptEntry[],
): Promise<JudgeScores> {
  const budgetStr = persona.budget ? `$${persona.budget}` : 'no budget set';

  const personaDesc = `Customer: ${persona.name}
Archetype: ${persona.archetype}
Destination: ${persona.destination}, from ${persona.origin}
Dates: ${persona.departure_date}${persona.return_date ? ` to ${persona.return_date}` : ' (one-way)'}
Budget: ${budgetStr}
Travelers: ${persona.travelers} (${persona.travel_party})
Style: ${persona.communication_style}
Goals:
${persona.goals.map((g) => `- ${g}`).join('\n')}
Constraints: ${persona.constraints}`;

  const transcriptStr = transcript
    .map(
      (t) =>
        `[${t.role.toUpperCase()}]: ${t.content}${t.tool_calls?.length ? ` (tools: ${t.tool_calls.join(', ')})` : ''}`,
    )
    .join('\n\n');

  const response = await getClient().messages.create({
    max_tokens: 1000,
    messages: [
      {
        content: `## Customer Persona\n\n${personaDesc}\n\n## Conversation Transcript\n\n${transcriptStr}\n\nNow score the agent. Respond with ONLY the JSON object, no other text.`,
        role: 'user',
      },
    ],
    model: getJudgeModel(),
    system: JUDGE_PROMPT,
  });

  const rawText =
    response.content[0]?.type === 'text' ? response.content[0].text : '';
  // Current models reject assistant prefill, so the judge returns the full
  // JSON object, possibly wrapped in code fences or prose; slice from the
  // first '{' to the last '}'.
  const trimmed = rawText.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  const text =
    start !== -1 && end > start ? trimmed.slice(start, end + 1) : trimmed;

  try {
    return JSON.parse(text) as JudgeScores;
  } catch {
    const defaultScore = {
      justification: 'Judge output could not be parsed',
      score: 0.5,
    };
    return {
      efficiency: defaultScore,
      error_recovery: defaultScore,
      relevance: defaultScore,
      task_completion: defaultScore,
      tone: defaultScore,
    };
  }
}

export function computeJudgeScore(scores: JudgeScores): number {
  const values = [
    scores.task_completion.score,
    scores.efficiency.score,
    scores.relevance.score,
    scores.tone.score,
    scores.error_recovery.score,
  ];
  return (
    Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) /
    100
  );
}
