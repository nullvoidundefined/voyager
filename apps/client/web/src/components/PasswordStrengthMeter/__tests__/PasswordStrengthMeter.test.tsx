import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';

import { PasswordStrengthMeter, scorePassword } from '../PasswordStrengthMeter';

afterEach(cleanup);

describe('scorePassword', () => {
  it('is "empty" for the empty string', () => {
    expect(scorePassword('')).toBe('empty');
  });

  it('is "weak" for anything under 8 chars', () => {
    expect(scorePassword('short')).toBe('weak');
    expect(scorePassword('7chars!')).toBe('weak');
  });

  it('is "fair" for 8+ chars with limited variety', () => {
    expect(scorePassword('alllowercase')).toBe('fair');
  });

  it('is "good" for 12+ chars with 2+ character classes', () => {
    expect(scorePassword('LongerOne123')).toBe('good');
  });

  it('is "strong" for 16+ chars with 3+ character classes', () => {
    expect(scorePassword('LongerOne123!Symbol')).toBe('strong');
  });
});

describe('PasswordStrengthMeter', () => {
  it('renders nothing visible when password is empty', () => {
    render(<PasswordStrengthMeter password='' />);
    expect(screen.queryByText(/strength/i)).not.toBeInTheDocument();
  });

  it('renders "Too short" when password is under 8 chars', () => {
    render(<PasswordStrengthMeter password='short' />);
    expect(screen.getByText(/Too short/i)).toBeInTheDocument();
  });

  it('renders "Strong" for a long mixed-class password', () => {
    render(<PasswordStrengthMeter password='LongerOne123!Symbol' />);
    expect(screen.getByText(/Strong/)).toBeInTheDocument();
  });

  it('updates the live region as the password changes', () => {
    const { rerender } = render(<PasswordStrengthMeter password='abc' />);
    expect(screen.getByText(/Too short/i)).toBeInTheDocument();
    rerender(<PasswordStrengthMeter password='alllowercase' />);
    expect(screen.getByText(/Fair/i)).toBeInTheDocument();
  });

  it('has no axe violations at any strength', async () => {
    const { container, rerender } = render(
      <PasswordStrengthMeter password='alllowercase' />,
    );
    expect(await axe(container)).toHaveNoViolations();
    rerender(<PasswordStrengthMeter password='LongerOne123!Symbol' />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
