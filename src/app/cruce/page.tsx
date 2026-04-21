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

interface TraficoDbRow {
  trafico: string
  estatus: string | null
  company_id: string | null
  fecha_cruce_planeada: string | null
  fecha_cruce_estimada: string | null
  bridge: string | null
  lane: string | null
  semaforo: string | null
}

function startOfToday(): Date {
  const now = new Date()
  const laredo = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Chicago' })
  )
  laredo.setHours(0, 0, 0, 0)
  return laredo
}

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

  const supabase = createServerClient()

  const rangeStart = startOfToday()
  const rangeEnd = new Date(rangeStart.getTime() + 7 * 86_400_000)

  const startISO = rangeStart.toISOString()
  const endISO = rangeEnd.toISOString()

  // Fetch planeada + estimada in a single query using the "or" filter.
  // We accept either field as a scheduling signal; the component resolves
  // which one to render per row.
  let query = supabase
    .from('traficos')
    .select(
      'trafico,estatus,company_id,fecha_cruce_planeada,fecha_cruce_estimada,bridge,lane,semaforo'
    )
    .or(
      `and(fecha_cruce_planeada.gte.${startISO},fecha_cruce_planeada.lte.${endISO}),and(fecha_cruce_estimada.gte.${startISO},fecha_cruce_estimada.lte.${endISO})`
    )
    .limit(500)

  // Client-scoped: only their own company_id.
  if (!isInternal) {
    query = query.eq('company_id', session.companyId)
  }

  const { data, error } = await query

  const raw: TraficoDbRow[] = error || !data ? [] : (data as TraficoDbRow[])

  const rows: CruceRow[] = raw.map((r) => ({
    trafico: r.trafico,
    estatus: r.estatus,
    companyId: r.company_id,
    fechaCrucePlaneada: r.fecha_cruce_planeada,
    fechaCruceEstimada: r.fecha_cruce_estimada,
    bridge: r.bridge,
    lane: r.lane,
    semaforo: r.semaforo,
  }))

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
