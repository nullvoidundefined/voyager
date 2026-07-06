import { afterEach, describe, expect, it } from 'vitest';

import { getCrossJudgeModels } from '../adversarial/getCrossJudgeModels.js';
import { getJudgeModel } from '../scoring/judge.js';

// Retired Anthropic model ids 404 at request time; a default pinned to one
// silently kills every eval run (2026-07-05: all 5 personas' results were
// discarded because the judge model claude-sonnet-4-20250514 had retired).
const RETIRED_OR_RETIRING_MODEL_IDS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-haiku-20240307',
];

afterEach(() => {
  delete process.env.EVAL_JUDGE_MODEL;
});

describe('judge model defaults', () => {
  it('scoring judge default is not a retired model id', () => {
    expect(RETIRED_OR_RETIRING_MODEL_IDS).not.toContain(getJudgeModel());
  });

  it('scoring judge honors the EVAL_JUDGE_MODEL override', () => {
    process.env.EVAL_JUDGE_MODEL = 'claude-opus-4-8';
    expect(getJudgeModel()).toBe('claude-opus-4-8');
  });

  it('cross-model judge default list contains no retired model ids', () => {
    for (const model of getCrossJudgeModels()) {
      expect(RETIRED_OR_RETIRING_MODEL_IDS).not.toContain(model);
    }
  });
});
