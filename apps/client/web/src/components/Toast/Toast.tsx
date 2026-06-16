'use client';

/**
 * Transient notification that surfaces a message and auto-dismisses after a timeout,
 * giving users non-blocking feedback on the outcome of an action.
 */
import { useEffect } from 'react';

import styles from './Toast.module.scss';

type ToastVariant = 'danger' | 'success' | 'info';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
  variant?: ToastVariant;
}

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: '✓',
  danger: '✗',
  info: 'i',
};

export function Toast({
  message,
  onClose,
  duration = 5000,
  variant = 'danger',
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div
      className={`${styles.toast} ${styles[variant]}`}
      role='alert'
      aria-live='assertive'
    >
      <span className={styles.icon} aria-hidden='true'>
        {VARIANT_ICONS[variant]}
      </span>
      <span>{message}</span>
      <button
        type='button'
        className={styles.close}
        onClick={onClose}
        aria-label='Dismiss'
      >
        &times;
      </button>
    </div>
  );
}
