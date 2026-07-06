import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {},
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname, '../../../'),
  async rewrites() {
    const apiUrl =
      process.env.API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:3001';
    return [
      {
        destination: `${apiUrl}/:path*`,
        source: '/api/:path*',
      },
    ];
  },
  transpilePackages: ['@repo/types'],
  webpack(config: Parameters<NonNullable<NextConfig['webpack']>>[0]) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
