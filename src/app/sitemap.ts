import type { MetadataRoute } from 'next'

/**
 * /sitemap.xml — Next.js App Router convention.
 *
 * Only lists PUBLIC marketing pages. Authenticated surfaces (/inicio,
 * /admin/*, /embarques, etc.) are intentionally excluded — they require
 * a signed session and have no value to search engines.
 *
 * Hostname resolved via NEXT_PUBLIC_SITE_URL so preview deploys don't
 * claim the production URL. Fall back to the production canonical.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://portal.renatozapata.com'

  const lastModified = new Date()

  return [
    {
      url: `${base}/pitch`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${base}/demo`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // /demo/live is a session-issuing route — not indexable, excluded.
    // /login, /signup, /onboarding are functional surfaces with no
    // marketing value — also excluded.
  ]
}
