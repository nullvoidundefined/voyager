import type { ChatMessage } from './messages.js';
import type { ChatNode } from './nodes.js';

export type SSEEvent =
  | { type: 'node'; node: ChatNode }
  | { type: 'text_delta'; content: string }
  | {
      type: 'tool_progress';
      tool_name: string;
      tool_id: string;
      status: 'running' | 'done';
    }
  | {
      type: 'budget';
      cache_creation_tokens: number;
      cache_read_tokens: number;
      input_tokens: number;
      output_tokens: number;
    }
  | { type: 'done'; message: ChatMessage }
  | { type: 'error'; error: string };
