import type { ChatNodeOfType } from '@repo/types';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MarkdownText } from '@/components/ChatBox/nodes/MarkdownText';

afterEach(cleanup);

function makeTextNode(content: string): ChatNodeOfType<'text'> {
  return { content, type: 'text' };
}

describe('MarkdownText', () => {
  it('renders a GFM pipe table as a real table element', () => {
    // The agent emits confirmation summaries as GFM pipe tables. Without
    // GFM support, react-markdown renders the pipes as one inline
    // paragraph of "| | Details | |---|---| ..." soup (2026-07-06
    // noisy-flight-results report).
    const tableMarkdown = [
      '| | Details |',
      '|---|---|',
      '| Flight | AA 2614 / EY 12 |',
      '| Cost | $1,186 |',
    ].join('\n');

    render(<MarkdownText node={makeTextNode(tableMarkdown)} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('AA 2614 / EY 12')).toBeInTheDocument();
    // The raw delimiter row must not leak into visible text.
    expect(screen.queryByText(/\|---\|/)).not.toBeInTheDocument();
  });

  it('still renders emphasis and plain prose', () => {
    render(<MarkdownText node={makeTextNode('A **bold** statement.')} />);
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText(/statement/)).toBeInTheDocument();
  });
});
