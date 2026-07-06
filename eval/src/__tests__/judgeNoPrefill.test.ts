import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runJudge as runAdversarialJudge } from '../adversarial/judge.js';
import type { AttackDef } from '../adversarial/types.js';
import { runJudge as runScoringJudge } from '../scoring/judge.js';
import type { Persona } from '../types.js';

// Current Claude models reject assistant-message prefill with a 400; the
// 2026-07-06 baseline run lost all five personas to exactly that. Judges must
// send user-only messages and parse a complete JSON response.
const createMessage = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: createMessage };
  },
}));

const PERSONA = {
  name: 'solo Prague $600',
  archetype: 'budget_backpacker',
  destination: 'Prague',
  origin: 'Miami',
  budget: 600,
  departure_date: '2026-08-29',
  return_date: '2026-09-09',
  travelers: 1,
  travel_party: 'solo',
  communication_style: 'terse',
  goals: ['cheap flights'],
  constraints: 'cheap',
  trip_type: 'round_trip',
} as unknown as Persona;

const SCORES_JSON = JSON.stringify({
  task_completion: { score: 0.8, justification: 'ok' },
  efficiency: { score: 0.7, justification: 'ok' },
  relevance: { score: 0.9, justification: 'ok' },
  tone: { score: 0.6, justification: 'ok' },
  error_recovery: { score: 0.5, justification: 'ok' },
});

const ATTACK = {
  id: 'H4-kb-poisoning-via-chat',
  category: 'H',
  category_name: 'inventory_integrity',
  title: 't',
  opening_message: 'o',
  antagonist_goal: 'g',
  max_turns: 2,
  expected_behavior: { type: 'refuse' },
  must_not: ['x'],
  severity: 'P0',
} as unknown as AttackDef;

const VERDICT_JSON = JSON.stringify({
  passed: true,
  must_not_violated: [],
  refusal_quality: 'graceful',
  evidence_turns: [1],
  rationale: 'refused cleanly',
});

beforeEach(() => {
  createMessage.mockReset();
});

describe('judges send no assistant prefill', () => {
  it('scoring judge sends user-only messages and parses full JSON', async () => {
    createMessage.mockResolvedValue({
      content: [{ type: 'text', text: SCORES_JSON }],
    });
    const scores = await runScoringJudge(PERSONA, [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);

    const request = createMessage.mock.calls[0]![0] as {
      messages: Array<{ role: string }>;
    };
    expect(request.messages.every((m) => m.role === 'user')).toBe(true);
    expect(scores.task_completion.score).toBe(0.8);
  });

  it('scoring judge tolerates code-fenced JSON', async () => {
    createMessage.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + SCORES_JSON + '\n```' }],
    });
    const scores = await runScoringJudge(PERSONA, []);
    expect(scores.relevance.score).toBe(0.9);
  });

  it('adversarial judge sends user-only messages and parses full JSON', async () => {
    createMessage.mockResolvedValue({
      content: [{ type: 'text', text: VERDICT_JSON }],
    });
    const verdict = await runAdversarialJudge(ATTACK, [], []);

    const request = createMessage.mock.calls[0]![0] as {
      messages: Array<{ role: string }>;
    };
    expect(request.messages.every((m) => m.role === 'user')).toBe(true);
    expect(verdict.passed).toBe(true);
    expect(verdict.refusal_quality).toBe('graceful');
  });
});

describe('customer simulator message shape', () => {
  it('never sends a conversation starting or ending with an assistant message', async () => {
    createMessage.mockResolvedValue({
      content: [{ type: 'text', text: 'Sounds great!' }],
    });
    const { getCustomerResponse } = await import('../runner/customerAgent.js');
    await getCustomerResponse(PERSONA, [
      { role: 'user', content: 'I want to go to Prague' }, // customer opener
      { role: 'assistant', content: 'Great! When are you traveling?' }, // agent
    ]);

    const request = createMessage.mock.calls[0]![0] as {
      messages: Array<{ role: string }>;
    };
    expect(request.messages[0]!.role).toBe('user');
    expect(request.messages[request.messages.length - 1]!.role).toBe('user');
  });
});
