/**
 * Generates /robots.txt for crawlers, disallowing the API and authenticated app
 * routes so private pages stay out of search indexes.
 */
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api', '/trips', '/_next'],
    },
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://voyager.app'}/sitemap.xml`,
  };
}
