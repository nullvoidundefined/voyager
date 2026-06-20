import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CostCounter } from '@/components/CostCounter/CostCounter';

describe('CostCounter', () => {
  it('renders token count and cost', () => {
    render(<CostCounter totalTokens={12400} totalCostUsd='0.0031' />);
    expect(screen.getByText(/12,400/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.0031/)).toBeInTheDocument();
  });

  it('renders zero state gracefully', () => {
    render(<CostCounter totalTokens={0} totalCostUsd='0.0000' />);
    expect(screen.getByText(/0 tokens/)).toBeInTheDocument();
  });
});
