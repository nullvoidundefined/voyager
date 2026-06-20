import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { TripPDFButton } from '@/components/TripPDF/TripPDF';

beforeAll(() => {
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
  URL.revokeObjectURL = vi.fn();
});

vi.mock('@react-pdf/renderer', () => ({
  pdf: vi
    .fn()
    .mockReturnValue({ toBlob: vi.fn().mockResolvedValue(new Blob(['%PDF'])) }),
  Document: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (s: unknown) => s },
}));

describe('TripPDFButton', () => {
  it('renders a Download PDF button', () => {
    render(<TripPDFButton tripTitle='Tokyo Trip' days={[]} />);
    expect(
      screen.getByRole('button', { name: /download pdf/i }),
    ).toBeInTheDocument();
  });

  it('calls pdf generation on click', async () => {
    render(<TripPDFButton tripTitle='Tokyo Trip' days={[]} />);
    await userEvent.click(
      screen.getByRole('button', { name: /download pdf/i }),
    );
    const { pdf } = await import('@react-pdf/renderer');
    expect(pdf).toHaveBeenCalled();
  });
});
