import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DemoBanner } from './DemoBanner';

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

  it('links to the engineering audit for curious viewers', () => {
    render(<DemoBanner />);
    const link = screen.getByRole('link', { name: /engineering audit/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toContain('/docs/audits/');
  });

  it('is marked as a complementary landmark for screen readers', () => {
    render(<DemoBanner />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});
