/**
 * Root App Router layout. Wraps every page in the global providers (auth, query),
 * chrome (header, footer), and error boundary, and declares site-wide metadata
 * and stylesheet imports so all routes share one shell.
 */
import type { Metadata } from 'next';

import 'mapbox-gl/dist/mapbox-gl.css';

import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { Footer } from '@/components/Footer/Footer';
import { Header } from '@/components/Header/Header';
import { APP_NAME } from '@/constants';
import { AuthProvider } from '@/state/AuthContext';
import { QueryProvider } from '@/state/QueryProvider';
import { TelemetryProvider } from '@/state/TelemetryProvider';

import '../styles/animations.scss';

import './globals.scss';
import styles from './layout.module.scss';

export const metadata: Metadata = {
  description:
    'Plan your perfect trip with an AI travel agent that searches real flights, hotels, and experiences.',
  openGraph: {
    description:
      'Plan your perfect trip with an AI travel agent that searches real flights, hotels, and experiences.',
    images: [
      {
        alt: 'Voyager AI Travel Planner',
        height: 630,
        url: '/og-image.png',
        width: 1200,
      },
    ],
    title: `${APP_NAME} | AI Travel Concierge`,
    type: 'website',
  },
  title: `${APP_NAME} | AI Travel Concierge`,
  twitter: {
    card: 'summary_large_image',
    description: 'Plan your perfect trip with an AI travel agent.',
    images: ['/og-image.png'],
    title: `${APP_NAME} | AI Travel Concierge`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body>
        <a href='#main-content' className={styles.skipLink}>
          Skip to main content
        </a>
        <TelemetryProvider>
          <QueryProvider>
            <AuthProvider>
              <div className={styles.appShell}>
                <Header />
                <main id='main-content' tabIndex={-1} className={styles.main}>
                  <ErrorBoundary>{children}</ErrorBoundary>
                </main>
                <Footer />
              </div>
            </AuthProvider>
          </QueryProvider>
        </TelemetryProvider>
      </body>
    </html>
  );
}
