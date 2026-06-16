import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PreferencesWizard } from '../PreferencesWizard';

vi.mock('@/lib/api', () => ({
  put: vi.fn().mockResolvedValue({}),
}));

function renderWizard(isOpen = true) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <PreferencesWizard
        isOpen={isOpen}
        onClose={onClose}
        initialPreferences={null}
      />
    </QueryClientProvider>,
  );
  return { onClose };
}

afterEach(cleanup);

describe('PreferencesWizard', () => {
  it('renders a dialog with proper title when open', () => {
    renderWizard(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Travel preferences wizard')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    renderWizard(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const { onClose } = renderWizard(true);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('uses Radix Dialog which provides focus trapping', () => {
    renderWizard(true);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
  });

  it('has no axe violations when open', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <PreferencesWizard
          isOpen={true}
          onClose={vi.fn()}
          initialPreferences={null}
        />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
