/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── Skip type/lint errors during build ────────────────────────────────────
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ── Image optimization ────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.qrserver.com' },
      { protocol: 'https', hostname: '**.neon.tech' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
  },

  // ── Compiler optimizations ────────────────────────────────────────────────
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  // ── HTTP response headers ─────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        source: '/css/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/media/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
    ];
  },

  // ── Redirects ─────────────────────────────────────────────────────────────
  async redirects() {
    return [];
  },

  // ── Webpack bundle optimization ───────────────────────────────────────────
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    }
    return config;
  },
};

module.exports = nextConfig;