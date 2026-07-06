/**
 * Resolves the judge-model list for cross-model validation from
 * EVAL_JUDGE_MODELS (comma-separated) with a maintained default set. Lives
 * apart from the crossModelJudge entry script so tests can import it without
 * executing the entry's main().
 */
const DEFAULT_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-5',
  'claude-opus-4-8',
];

export function getCrossJudgeModels(): string[] {
  const env = process.env.EVAL_JUDGE_MODELS;
  if (!env) return DEFAULT_MODELS;
  return env
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}
