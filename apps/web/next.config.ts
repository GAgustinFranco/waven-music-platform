import type { NextConfig } from 'next';

// The browser only talks to the web origin; `/api/*` is proxied to the API so the
// refresh cookie stays first-party (see docs/ARCHITECTURE.md).
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiProxyTarget}/:path*` }]);
  },
};

export default nextConfig;
