import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatProgressBar } from './ChatProgressBar';

afterEach(cleanup);

describe('ChatProgressBar', () => {
  it('renders a progressbar with aria-valuenow=0 when no tools done', () => {
    render(
      <ChatProgressBar
        mode='determinate'
        done={0}
        total={3}
        latestLabel='Searching flights'
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText(/Searching flights/)).toBeInTheDocument();
  });

  it('renders aria-valuenow=67 when 2 of 3 tools done', () => {
    render(
      <ChatProgressBar
        mode='determinate'
        done={2}
        total={3}
        latestLabel='Searching hotels'
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '67');
  });

  it('renders aria-valuenow=100 and "Done" label when all tools done', () => {
    render(
      <ChatProgressBar
        mode='determinate'
        done={3}
        total={3}
        latestLabel='Assembling response'
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText(/Done/)).toBeInTheDocument();
  });

  it('renders an indeterminate bar with no aria-valuenow in indeterminate mode', () => {
    render(<ChatProgressBar mode='indeterminate' label='Thinking' />);
    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByText(/Thinking/)).toBeInTheDocument();
  });

  it('renders exactly one progressbar element regardless of mode', () => {
    const { rerender } = render(
      <ChatProgressBar mode='determinate' done={1} total={2} latestLabel='X' />,
    );
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);

    rerender(<ChatProgressBar mode='indeterminate' label='Y' />);
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });
});
