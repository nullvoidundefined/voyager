import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VirtualizedChat } from '../VirtualizedChat';

const defaultProps = {
  messages: [],
  streamingNodes: [],
  toolProgress: [],
  streamingText: '',
  isSending: false,
  onQuickReply: vi.fn(),
};

describe('VirtualizedChat empty state', () => {
  it('renders a starter prompt chip when messages is empty', () => {
    render(<VirtualizedChat {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /plan a trip/i }),
    ).toBeInTheDocument();
  });

  it('clicking the chip calls onQuickReply with the starter text', async () => {
    const onQuickReply = vi.fn();
    render(<VirtualizedChat {...defaultProps} onQuickReply={onQuickReply} />);
    await userEvent.click(screen.getByRole('button', { name: /plan a trip/i }));
    expect(onQuickReply).toHaveBeenCalledWith(
      expect.stringMatching(/plan a trip/i),
    );
  });
});

describe('VirtualizedChat thinking indicator', () => {
  it('shows thinking indicator when isStreaming is true', () => {
    render(<VirtualizedChat {...defaultProps} isStreaming={true} />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it('hides thinking indicator when isStreaming is false', () => {
    render(<VirtualizedChat {...defaultProps} isStreaming={false} />);
    expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument();
  });
});
