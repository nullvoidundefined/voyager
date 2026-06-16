import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Toast } from '../Toast';

afterEach(cleanup);

describe('Toast', () => {
  it('renders the message text', () => {
    render(<Toast message='Something went wrong' onClose={vi.fn()} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('has a dismiss button with aria-label', () => {
    render(<Toast message='Error' onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('calls onClose when dismiss button is clicked', async () => {
    const onClose = vi.fn();
    render(<Toast message='Error' onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('auto-dismisses after duration', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast message='Error' onClose={onClose} duration={3000} />);

    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(onClose).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('has role="alert" and aria-live="assertive" for screen readers', () => {
    render(<Toast message='Error occurred' onClose={vi.fn()} />);
    const toast = screen.getByRole('alert');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveAttribute('aria-live', 'assertive');
  });

  it('defaults to 5000ms duration', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast message='Error' onClose={onClose} />);

    vi.advanceTimersByTime(4999);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <Toast message='Something went wrong' onClose={vi.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
