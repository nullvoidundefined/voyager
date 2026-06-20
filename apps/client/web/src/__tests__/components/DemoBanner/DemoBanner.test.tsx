import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';

import { DemoBanner } from '@/components/DemoBanner/DemoBanner';

afterEach(cleanup);

describe('DemoBanner', () => {
  it('renders the portfolio-demo disclosure text', () => {
    render(<DemoBanner />);
    const banner = screen.getByRole('note', { name: /portfolio demo/i });
    expect(banner).toBeInTheDocument();
  });

  it('explains this is not a commercial booking service', () => {
    render(<DemoBanner />);
    expect(
      screen.getByText(/not a commercial booking service/i),
    ).toBeInTheDocument();
  });

  it('does not contain a dead link to a repo-internal path', () => {
    render(<DemoBanner />);
    expect(
      screen.queryByRole('link', { name: /engineering audit/i }),
    ).not.toBeInTheDocument();
  });

  it('is marked as a complementary landmark for screen readers', () => {
    render(<DemoBanner />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<DemoBanner />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
