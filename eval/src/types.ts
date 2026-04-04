export type CommunicationStyle =
  | 'detailed'
  | 'terse'
  | 'conversational'
  | 'impatient';

export type Archetype =
  | 'budget_backpacker'
  | 'luxury_couple'
  | 'family_vacation'
  | 'adventure_seeker'
  | 'business_traveler'
  | 'edge_case';

export interface Persona {
  name: string;
  archetype: Archetype;
  destination: string;
  origin: string;
  budget: number | null;
  departure_date: string;
  return_date: string | null;
  travelers: number;
  travel_party: string;
  communication_style: CommunicationStyle;
  goals: string[];
  constraints: string;
  trip_type: 'round_trip' | 'one_way';
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: string[];
}

export interface AssertionResults {
  details_collected: boolean;
  search_executed: boolean;
  no_errors: boolean;
  response_length: boolean;
  budget_respected: boolean;
  format_response_used: boolean;
  conversation_completed: boolean;
}

export interface JudgeScore {
  score: number;
  justification: string;
}

export interface JudgeScores {
  task_completion: JudgeScore;
  efficiency: JudgeScore;
  relevance: JudgeScore;
  tone: JudgeScore;
  error_recovery: JudgeScore;
}

export interface PersonaResult {
  name: string;
  archetype: Archetype;
  config: Persona;
  assertions: AssertionResults;
  assertion_score: number;
  judge_scores: JudgeScores;
  judge_score: number;
  overall: number;
  turns: number;
  transcript: TranscriptEntry[];
  error?: string;
}

export interface EvalReport {
  timestamp: string;
  duration_ms: number;
  summary: {
    overall: number;
    personas: number;
    turns: number;
    assertions_passed: number;
    assertions_total: number;
  };
  personas: PersonaResult[];
}
