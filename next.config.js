/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── Image optimization ─────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      // Restrict to only needed domains (not wildcard **)
      { protocol: 'https', hostname: 'api.qrserver.com' },
      { protocol: 'https', hostname: '**.neon.tech' },
    ],
    formats: ['image/avif', 'image/webp'],   // modern formats = smaller files
    minimumCacheTTL: 3600,                   // cache images 1hr
  },

  // ── Compiler optimizations ─────────────────────────────────────────────────
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }      // strip console.log in prod, keep errors
      : false,
  },

  // ── HTTP response headers ──────────────────────────────────────────────────
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
          {
            key:   'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/css/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/media/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
      // Never cache API responses by default
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
    ];
  },

  // ── Redirects ──────────────────────────────────────────────────────────────
  async redirects() {
    return [
      // Force HTTPS in production (handled by host usually, but belt + suspenders)
      // Redirect old paths if any
    ];
  },

  // ── Webpack bundle optimization ────────────────────────────────────────────
  webpack(config, { isServer }) {
    // Tree-shake lodash (if used)
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        lodash: 'lodash-es',
      };
    }
    return config;
  },
};

module.exports = nextConfig;
