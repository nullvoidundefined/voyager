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
  title: `${APP_NAME} | AI Travel Concierge`,
  description:
    'Plan your perfect trip with an AI travel agent that searches real flights, hotels, and experiences.',
  openGraph: {
    title: `${APP_NAME} | AI Travel Concierge`,
    description:
      'Plan your perfect trip with an AI travel agent that searches real flights, hotels, and experiences.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Voyager AI Travel Planner',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} | AI Travel Concierge`,
    description: 'Plan your perfect trip with an AI travel agent.',
    images: ['/og-image.png'],
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
