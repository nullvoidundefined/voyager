'use client';

/**
 * Project wrapper around Radix AlertDialog that applies app styling and a consistent
 * confirm/cancel API, so destructive-action prompts look and behave uniformly.
 */
import type { ReactNode } from 'react';

import * as RadixAlertDialog from '@radix-ui/react-alert-dialog';

import styles from './AlertDialog.module.scss';

/**
 * Voyager's Radix-based AlertDialog wrapper.
 *
 * Closes DES-04 components/ui/ scaffolding and UX-04 destructive
 * action confirmation. Inherits focus trap, aria-modal, Escape
 * handling, and focus return from Radix, so every consumer gets
 * those for free.
 */

export interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = false,
}: AlertDialogProps) {
  return (
    <RadixAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className={styles.overlay} />
        <RadixAlertDialog.Content className={styles.content}>
          <RadixAlertDialog.Title className={styles.title}>
            {title}
          </RadixAlertDialog.Title>
          {description && (
            <RadixAlertDialog.Description className={styles.description}>
              {description}
            </RadixAlertDialog.Description>
          )}
          <div className={styles.actions}>
            <RadixAlertDialog.Cancel asChild>
              <button type='button' className={styles.cancelButton}>
                {cancelLabel}
              </button>
            </RadixAlertDialog.Cancel>
            <RadixAlertDialog.Action asChild>
              <button
                type='button'
                className={
                  destructive ? styles.destructiveButton : styles.confirmButton
                }
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </RadixAlertDialog.Action>
          </div>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  );
}
