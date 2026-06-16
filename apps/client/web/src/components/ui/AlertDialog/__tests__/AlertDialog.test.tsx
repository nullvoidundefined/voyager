import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AlertDialog } from '../AlertDialog';

afterEach(cleanup);

describe('AlertDialog', () => {
  it('renders the title when open', () => {
    render(
      <AlertDialog
        open
        onOpenChange={vi.fn()}
        title='Delete this trip?'
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText('Delete this trip?')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(
      <AlertDialog
        open
        onOpenChange={vi.fn()}
        title='Delete?'
        description='This action cannot be undone.'
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.getByText('This action cannot be undone.'),
    ).toBeInTheDocument();
  });

  it('uses default Confirm and Cancel labels when not specified', () => {
    render(
      <AlertDialog
        open
        onOpenChange={vi.fn()}
        title='Delete?'
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <AlertDialog
        open
        onOpenChange={vi.fn()}
        title='Delete?'
        confirmLabel='Delete'
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('does not render the dialog when open is false', () => {
    render(
      <AlertDialog
        open={false}
        onOpenChange={vi.fn()}
        title='Delete?'
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
  });

  it('has role=alertdialog for screen readers (via Radix)', () => {
    render(
      <AlertDialog
        open
        onOpenChange={vi.fn()}
        title='Delete?'
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
