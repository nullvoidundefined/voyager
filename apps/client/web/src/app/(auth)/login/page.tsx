'use client';

/**
 * Login page. Renders the sign-in form, authenticates via the auth context, and
 * honors a post-login redirect target from the query string so users return to
 * the page that sent them here.
 */
import { type FormEvent, useState } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { ApiError, get } from '@/api/request';
import { Toast } from '@/components/Toast/Toast';
import { APP_NAME } from '@/constants';
import { useAuth } from '@/state/AuthContext';

import styles from '../auth.module.scss';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      await login(email, password);
      const nextUrl = searchParams.get('next');
      if (nextUrl && nextUrl.startsWith('/')) {
        router.push(nextUrl);
      } else {
        const { trips } = await get<{
          trips: { id: string }[];
        }>('/trips');
        router.push(trips.length > 0 ? '/trips' : '/trips/new');
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.';
      setToast(msg);
    }
  }

  return (
    <>
      <div className={styles.brandPanel}>
        <div className={styles.brandContent}>
          <h2 className={styles.brandHeadline}>
            <em>Plan trips you will never forget</em>
          </h2>
          <p className={styles.brandBody}>
            AI-powered concierge that searches real flights, hotels, and
            experiences within your budget.
          </p>
        </div>
      </div>
      <div className={styles.formPanel}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1>Welcome back</h1>
            <p>Sign in to plan your next trip</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={styles.field}>
              <span>Email</span>
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='you@example.com'
                autoComplete='email'
              />
            </label>

            <label className={styles.field}>
              <span>Password</span>
              <input
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='••••••••'
                autoComplete='current-password'
              />
            </label>

            <div className={styles.forgotLink}>
              <button
                type='button'
                className={styles.forgotButton}
                onClick={() => setToast('Password reset is coming soon.')}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p className={styles.error} role='alert'>
                {error}
              </p>
            )}

            <button
              type='submit'
              className={styles.submit}
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className={styles.switchLink}>
            Don&apos;t have an account? <Link href='/register'>Sign up</Link>
          </p>

          <Link href='/faq' className={styles.faqLink}>
            How does {APP_NAME} work? &rarr;
          </Link>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  );
}
