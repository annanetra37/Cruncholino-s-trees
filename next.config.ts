import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces .next/standalone — the Dockerfile copies only that, keeping the
  // Railway image small and the cold start fast.
  output: 'standalone',
  reactStrictMode: true,
  eslint: {
    // CI runs lint as its own step; failing the production build on a lint rule
    // wastes a Railway deploy cycle.
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
    },
  },
};

export default nextConfig;
