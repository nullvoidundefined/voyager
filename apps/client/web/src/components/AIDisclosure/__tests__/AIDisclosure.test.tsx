import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AIDisclosure } from '../AIDisclosure';

afterEach(cleanup);

describe('AIDisclosure', () => {
  it('discloses the AI agent and a price-verification reminder', () => {
    render(<AIDisclosure />);
    const note = screen.getByRole('note');
    expect(note.textContent).toMatch(/AI agent/i);
    expect(note.textContent).toMatch(/verify/i);
  });
});
