import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ToolTimeline } from '../ToolTimeline';

const TOOL_CALLS = [
  {
    id: 't1',
    toolName: 'search_flights',
    status: 'done' as const,
    durationMs: 820,
  },
  {
    id: 't2',
    toolName: 'search_hotels',
    status: 'done' as const,
    durationMs: 1100,
  },
  {
    id: 't3',
    toolName: 'calculate_remaining_budget',
    status: 'running' as const,
    durationMs: 0,
  },
];

describe('ToolTimeline', () => {
  it('renders a step for each tool call', () => {
    render(<ToolTimeline toolCalls={TOOL_CALLS} />);
    expect(screen.getByText(/search_flights/i)).toBeInTheDocument();
    expect(screen.getByText(/search_hotels/i)).toBeInTheDocument();
    expect(screen.getByText(/calculate_remaining_budget/i)).toBeInTheDocument();
  });

  it('shows duration for completed tool calls', () => {
    render(<ToolTimeline toolCalls={TOOL_CALLS} />);
    expect(screen.getByText(/820ms/)).toBeInTheDocument();
  });

  it('renders empty state when no tool calls', () => {
    render(<ToolTimeline toolCalls={[]} />);
    expect(screen.getByText(/no tool calls/i)).toBeInTheDocument();
  });
});
