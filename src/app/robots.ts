import type { MetadataRoute } from 'next'

/**
 * /robots.txt — Next.js App Router convention.
 *
 * Explicitly allows /pitch + /demo (the prospect surfaces) and blocks
 * every authenticated area — saves crawl budget and keeps internal
 * admin surfaces out of search results. Sitemap pointer included.
 */
export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://portal.renatozapata.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/pitch', '/demo'],
        disallow: [
          '/admin',
          '/api',
          '/inicio',
          '/embarques',
          '/pedimentos',
          '/expedientes',
          '/entradas',
          '/catalogo',
          '/anexo-24',
          '/mensajeria',
          '/mi-cuenta',
          '/reportes',
          '/cruz',
          '/track',
          '/share',
          '/upload',
          '/proveedor',
          '/demo/live',
          '/demo/request-access',
          '/login',
          '/signup',
          '/onboarding',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
