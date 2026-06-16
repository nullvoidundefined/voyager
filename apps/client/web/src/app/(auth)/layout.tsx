/**
 * Layout for the auth route group (login, register). Provides the shared centered
 * auth shell and a Suspense boundary so the nested client forms that read search
 * params can stream.
 */
import { Suspense } from 'react';

import styles from './auth.module.scss';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <div className={styles.authLayout} data-auth-layout>
        {children}
      </div>
    </Suspense>
  );
}
