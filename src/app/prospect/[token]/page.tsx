/**
 * /prospect/[token]/page.tsx
 *
 * Public, token-gated prospect cockpit. Server component.
 *
 * Flow:
 *   1. Verify HMAC prospect token (via verifyProspectToken).
 *   2. Aggregate this prospect's importer-of-record data from
 *      aduanet_facturas using getProspectByRfc.
 *   3. Best-effort log the open event to prospect_view_log + bump
 *      prospect_link_issuance.last_viewed_at / view_count if the
 *      tables exist (silent skip otherwise).
 *   4. Render <ProspectCockpit> in a PageShell with login-North-Star
 *      visual contract.
 *
 * Tenant isolation: this route is intentionally OUTSIDE every tenant
 * scope. The token contains the RFC; the RFC is the only thing this
 * route reads. No portal_session is created; no company_id is set; the
 * cockpit cannot navigate anywhere else without a fresh token.
 *
 * Token expiry: handled by verifyProspectToken — expired tokens return
 * null and we render notFound() (looks like a 404 to the user, no
 * "expired" leakage that could be brute-forced).
 */

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { verifyProspectToken, hashProspectToken } from '@/lib/session'
import { getProspectByRfc } from '@/lib/prospect-data'
import { createServerClient } from '@/lib/supabase-server'
import { ProspectCockpit } from '@/components/prospect/ProspectCockpit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function ProspectTokenPage({ params }: PageProps) {
  const { token } = await params
  const decoded = decodeURIComponent(token)

  const verified = await verifyProspectToken(decoded)
  if (!verified) notFound()

  const supabase = createServerClient()
  const data = await getProspectByRfc(supabase, verified.rfc)
  if (!data || data.empty) notFound()

  // Fire-and-forget logging. Silent if the migration hasn't been applied yet.
  const tokenHash = await hashProspectToken(decoded).catch(() => null)
  const headerList = await headers()
  const userAgent = headerList.get('user-agent') ?? null
  const xForwardedFor = headerList.get('x-forwarded-for') ?? null
  const ip = xForwardedFor?.split(',')[0]?.trim() || null

  void (async () => {
    try {
      await supabase.from('prospect_view_log').insert({
        rfc: verified.rfc,
        token_hash: tokenHash,
        event_type: 'opened',
        event_data: {
          referrer: headerList.get('referer') ?? null,
        },
        ip,
        user_agent: userAgent,
      })
    } catch {
      // Table may not exist (migration pending). Don't block render.
    }
    if (tokenHash) {
      try {
        const { data: issuance } = await supabase
          .from('prospect_link_issuance')
          .select('id, view_count')
          .eq('token_hash', tokenHash)
          .maybeSingle()
        if (issuance?.id) {
          await supabase
            .from('prospect_link_issuance')
            .update({
              last_viewed_at: new Date().toISOString(),
              view_count: (issuance.view_count ?? 0) + 1,
            })
            .eq('id', issuance.id)
        }
      } catch {
        // ignore — issuance table may not exist yet
      }
    }
  })()

  return <ProspectCockpit data={data} token={decoded} />
}

// Keep this surface out of search engines until Tito explicitly opens it up.
export const metadata = {
  title: 'Vista preliminar — Renato Zapata & Company',
  description: 'Patente 3596 · Aduana 240 · Laredo TX · Est. 1941',
  robots: { index: false, follow: false, nocache: true },
}
