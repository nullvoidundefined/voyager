'use client';

/**
 * Site footer with navigation links and auth-aware content, rendered across pages to
 * provide consistent secondary navigation and build/version context.
 */
import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';
import { APP_NAME } from '@/lib/constants';

import styles from './Footer.module.scss';

export function Footer() {
  const { user } = useAuth();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <p className={styles.logo}>{APP_NAME}</p>
          <p className={styles.tagline}>AI-powered travel concierge</p>
        </div>
        <nav className={styles.links} aria-label='Footer navigation'>
          <Link href='/faq'>FAQ</Link>
          <span className={styles.dot} aria-hidden='true' />
          {user ? (
            <>
              <Link href='/trips'>My Trips</Link>
              <span className={styles.dot} aria-hidden='true' />
              <Link href='/account'>Account</Link>
            </>
          ) : (
            <>
              <Link href='/login'>Sign In</Link>
              <span className={styles.dot} aria-hidden='true' />
              <Link href='/register'>Get Started</Link>
            </>
          )}
        </nav>
      </div>
    </footer>
  );
}
