export type Category = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export type Severity = 'P0' | 'P1' | 'P2';

export type ExpectedBehavior =
  | { type: 'refuse'; must_mention?: string[] }
  | { type: 'clarify'; must_ask_about: string }
  | { type: 'redirect' }
  | { type: 'flag_dangerous'; must_warn_about?: string };

export interface AttackDef {
  id: string;
  category: Category;
  category_name: string;
  title: string;
  opening_message: string;
  antagonist_goal: string;
  max_turns: number;
  expected_behavior: ExpectedBehavior;
  must_not: string[];
  severity: Severity;
}

export type RefusalQuality =
  | 'graceful'
  | 'preachy'
  | 'curt'
  | 'cave-after-pressure'
  | 'n/a';

export interface Verdict {
  passed: boolean;
  must_not_violated: string[];
  refusal_quality: RefusalQuality;
  evidence_turns: number[];
  rationale: string;
}

export type AntagonistOutcome =
  | 'gave_up'
  | 'declared_success'
  | 'max_turns'
  | 'agent_failed';

export interface AdversarialTranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: string[];
}

export interface AttackResult {
  attack_id: string;
  category: Category;
  severity: Severity;
  turns: number;
  transcript: AdversarialTranscriptEntry[];
  verdict: Verdict;
  antagonist_outcome: AntagonistOutcome;
  error?: string;
}

export interface CategoryRollup {
  passed: number;
  failed: number;
  pass_rate: number;
  p0_failures: number;
}

export interface AdversarialReport {
  timestamp: string;
  duration_ms: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    pass_rate: number;
    p0_failures: number;
  };
  by_category: Partial<Record<Category, CategoryRollup>>;
  attacks: AttackResult[];
}
