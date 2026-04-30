import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { fmtDateTime } from '@/lib/format-utils'
import { CruceClient, type CruceRow } from './CruceClient'

/**
 * V1 Polish Pack · Block 11 — Crossing schedule timeline.
 *
 * Server component pulls traficos with a planned or estimated crossing inside
 * the default 7-day window (today + 7 days), filtered by session scope:
 *   - client role  → own company only
 *   - operator/admin/broker → all clients
 *
 * Empty state is deliberate: the fields were just added; Renato backfills
 * separately from workflow_events.
 */
export const dynamic = 'force-dynamic'

// M16 phantom-sweep: fecha_cruce_planeada, fecha_cruce_estimada, bridge,
// lane are prediction features that were designed but never materialized
// on traficos. Querying them 400s against PostgREST. Until the prediction
// pipeline fills these columns (or a dedicated table ships), this page
// renders an empty-state schedule with a deliberate calm message. Keeping
// the page alive preserves the nav entry + deep links.

export default async function CrucePage() {
  const cookieStore = await cookies()
  const session = await verifySession(
    cookieStore.get('portal_session')?.value ?? ''
  )
  if (!session) redirect('/login')

  const isInternal =
    session.role === 'broker' ||
    session.role === 'admin' ||
    session.role === 'operator'

  // Pre-activation empty state — the prediction feature that populates
  // these columns hasn't shipped yet. Don't call .from('traficos') with
  // phantom fields; render a clean schedule placeholder instead.
  const rows: CruceRow[] = []
  const rangeStart = (() => {
    const now = new Date()
    const laredo = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
    laredo.setHours(0, 0, 0, 0)
    return laredo
  })()
  const rangeEnd = new Date(rangeStart.getTime() + 7 * 86_400_000)
  void session
  void isInternal

  // Distinct client list for the filter dropdown — internal only.
  const clientOptions = isInternal
    ? Array.from(new Set(rows.map((r) => r.companyId).filter((c): c is string => !!c))).sort()
    : []

  const lastUpdateLabel = fmtDateTime(new Date().toISOString())

  return (
    <CruceClient
      rows={rows}
      clientOptions={clientOptions}
      rangeStartISO={rangeStart.toISOString()}
      rangeEndISO={rangeEnd.toISOString()}
      lastUpdateLabel={lastUpdateLabel}
    />
  )
}
