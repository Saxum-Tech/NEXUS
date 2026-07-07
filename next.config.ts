/**
 * next.config.ts
 * ─────────────────────────────────────────────────────────────
 * Next.js configuration. Security headers are set here rather
 * than in middleware so they apply to every response including
 * static assets, not just server-rendered routes.
 * ─────────────────────────────────────────────────────────────
 */

import type { NextConfig } from 'next';

const config: NextConfig = {
  // Catch more errors in development without breaking prod builds.
  reactStrictMode: true,

  // Remove X-Powered-By header to avoid fingerprinting the framework.
  poweredByHeader: false,

  // Security headers applied to every response.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Stop browsers second-guessing declared content types.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Control referrer information sent with requests.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict browser features this app doesn't use.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // Content Security Policy.
          // Start with a strict policy and loosen per-route if needed.
          // 'unsafe-inline' on style-src is required by Next.js's
          // inline style injection (including our brand colour override in
          // app/layout.tsx). Remove it if you move to CSS-in-JS or
          // generate a nonce per-request.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // 'unsafe-eval' required by Next.js dev mode; remove in prod if you can
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              `connect-src 'self' ${process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''} wss:`,
              "img-src 'self' data: blob: https:",
              "font-src 'self' https://cdn.jsdelivr.net",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          // HTTP Strict Transport Security (only effective over HTTPS).
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  // Configure which domains Next.js will optimise images from.
  // Add your Supabase storage domain once you know your project ref:
  //   `<your-ref>.supabase.co`
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Redirect the bare root to /dashboard (handled in app/page.tsx too,
  // but a redirect here avoids the server render entirely).
  async redirects() {
    return [];
  },
};

export default config;
