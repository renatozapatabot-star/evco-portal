import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      { source: '/cruz-ai', destination: '/cruz', permanent: true },
      { source: '/docs', destination: '/documentos', permanent: true },
      { source: '/finance', destination: '/financiero', permanent: true },
      { source: '/tracking', destination: '/traficos', permanent: true },
      // /inicio → / redirect REMOVED v9.7. /inicio is the canonical client cockpit
      // (AGUILA v8.1+). The legacy redirect created an infinite loop:
      //   / (role=client) → /inicio (next.config 308) → / → ...
      // ClientHome was deprecated; CockpitInicio at /inicio is the destination.
      { source: '/suppliers', destination: '/proveedores', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.telegram.org https://va.vercel-scripts.com",
              "worker-src 'self' blob:",
              "manifest-src 'self'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default nextConfig;
