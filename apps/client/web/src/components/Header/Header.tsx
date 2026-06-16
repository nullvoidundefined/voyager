'use client';

/**
 * Top site header with primary navigation and auth-aware controls, rendered across
 * pages to give consistent global navigation and session affordances.
 */
import { useEffect, useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { get } from '@/lib/api';
import { APP_NAME, GITHUB_REPO_URL } from '@/lib/constants';
import { type UserPreferences } from '@/lib/preferenceOptions';

import styles from './Header.module.scss';

const publicLinks = [
  { href: '/explore', label: 'Explore' },
  { href: '/faq', label: 'FAQ' },
];

const authedLinks = [
  { href: '/explore', label: 'Explore' },
  { href: '/trips', label: 'My Trips' },
  { href: '/account', label: 'Account' },
  { href: '/faq', label: 'FAQ' },
];

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever the route changes so a nav click
  // does not leave the panel hanging open over the destination page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const navLinks = user ? authedLinks : publicLinks;

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () =>
      get<{ preferences: UserPreferences | null }>('/user-preferences').then(
        (r) => r.preferences,
      ),
    enabled: !!user,
  });

  const prefsIncomplete =
    !!user && (preferences?.completed_steps?.length ?? 0) < 6;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href='/' className={styles.logo}>
          {APP_NAME}
        </Link>
        <nav className={styles.nav} aria-label='Main navigation'>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${pathname === link.href ? styles.active : ''}`}
            >
              {link.label}
              {link.href === '/account' && prefsIncomplete && (
                <span
                  className={styles.incompleteBadge}
                  aria-label='Preferences incomplete'
                />
              )}
            </Link>
          ))}
        </nav>
        <a
          href={GITHUB_REPO_URL}
          target='_blank'
          rel='noopener noreferrer'
          className={styles.github}
          aria-label='Source on GitHub'
        >
          <svg
            width='18'
            height='18'
            viewBox='0 0 24 24'
            fill='currentColor'
            aria-hidden='true'
          >
            <path d='M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12' />
          </svg>
        </a>
        {user ? (
          <button className={styles.signIn} onClick={logout}>
            Sign Out
          </button>
        ) : (
          <Link href='/login' className={styles.signIn}>
            Sign In
          </Link>
        )}

        <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Dialog.Trigger asChild>
            <button
              type='button'
              className={styles.hamburger}
              aria-label='Open navigation menu'
            >
              <span aria-hidden='true' className={styles.hamburgerBar} />
              <span aria-hidden='true' className={styles.hamburgerBar} />
              <span aria-hidden='true' className={styles.hamburgerBar} />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={styles.drawerOverlay} />
            <Dialog.Content
              className={styles.drawerPanel}
              aria-describedby={undefined}
            >
              <Dialog.Title className={styles.drawerTitle}>
                Navigation
              </Dialog.Title>
              <nav className={styles.drawerNav} aria-label='Mobile navigation'>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`${styles.drawerLink} ${pathname === link.href ? styles.active : ''}`}
                  >
                    {link.label}
                    {link.href === '/account' && prefsIncomplete && (
                      <span
                        className={styles.incompleteBadge}
                        aria-label='Preferences incomplete'
                      />
                    )}
                  </Link>
                ))}
                <a
                  href={GITHUB_REPO_URL}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={styles.drawerLink}
                >
                  Source on GitHub
                </a>
                {user ? (
                  <button
                    type='button'
                    className={styles.drawerLink}
                    onClick={() => {
                      logout();
                      setDrawerOpen(false);
                    }}
                  >
                    Sign Out
                  </button>
                ) : (
                  <Link href='/login' className={styles.drawerLink}>
                    Sign In
                  </Link>
                )}
              </nav>
              <Dialog.Close asChild>
                <button
                  type='button'
                  className={styles.drawerClose}
                  aria-label='Close navigation menu'
                >
                  Close
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}
