import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Header } from '../Header';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@/state/AuthContext', () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

vi.mock('@/api/request', () => ({
  get: vi.fn().mockResolvedValue({ preferences: null }),
}));

function renderHeader() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Header />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Header', () => {
  it('renders a GitHub source link pointing at the repo', () => {
    renderHeader();
    const link = screen.getByRole('link', { name: /source on github/i });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/nullvoidundefined/voyager',
    );
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders an accessible hamburger trigger for the mobile drawer', () => {
    renderHeader();
    expect(
      screen.getByRole('button', { name: /open navigation menu/i }),
    ).toBeInTheDocument();
  });

  it('opens the drawer with all nav links + close button when hamburger is clicked', async () => {
    renderHeader();
    await userEvent.click(
      screen.getByRole('button', { name: /open navigation menu/i }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explore/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /faq/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /close navigation menu/i }),
    ).toBeInTheDocument();
  });
});
