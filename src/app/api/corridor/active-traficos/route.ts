import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { getCorridorPosition } from '@/lib/corridor-position'
import type {
  ActiveTraficoPulse,
  Landmark,
  LandmarkId,
  LandmarkType,
  WorkflowEventSlim,
} from '@/types/corridor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// P0-A4: explicit service-role requirement. Corridor pulse aggregates
// across tenants — service-role only, app code applies tenant filter
// via session.companyId for non-internal callers.
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY required for /api/corridor/active-traficos')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_ROLE
)

const ACTIVE_WINDOW_HOURS = 72
const HARD_LIMIT = 500

interface LandmarkRow {
  id: string
  name: string
  type: string
  lat: number | string
  lng: number | string
  description: string | null
}

interface TraficoRow {
  trafico: string | null
  company_id: string | null
  estatus: string | null
  assigned_to_operator_id: string | null
}

interface WorkflowEventRow {
  id: string
  event_type: string
  created_at: string
  trigger_id: string | null
  payload: Record<string, unknown> | null
}

function toLandmarks(rows: LandmarkRow[]): Map<string, Landmark> {
  const m = new Map<string, Landmark>()
  for (const r of rows) {
    m.set(r.id, {
      id: r.id as LandmarkId,
      name: r.name,
      type: r.type as LandmarkType,
      lat: typeof r.lat === 'string' ? parseFloat(r.lat) : r.lat,
      lng: typeof r.lng === 'string' ? parseFloat(r.lng) : r.lng,
      description: r.description,
    })
  }
  return m
}

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 }
    )
  }

  const isInternal = session.role === 'broker' || session.role === 'admin' || session.role === 'operator'

  // 1. Landmarks for position resolution.
  const { data: landmarkRows, error: lmErr } = await supabase
    .from('corridor_landmarks')
    .select('id, name, type, lat, lng, description')
  if (lmErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: lmErr.message } },
      { status: 500 }
    )
  }
  const landmarks = toLandmarks((landmarkRows ?? []) as LandmarkRow[])

  // 2. Active traficos — scoped by role. Clients see only their company.
  const sinceIso = new Date(Date.now() - ACTIVE_WINDOW_HOURS * 3600 * 1000).toISOString()

  let traficosQuery = supabase
    .from('traficos')
    .select('trafico, company_id, estatus, assigned_to_operator_id')
    .not('trafico', 'is', null)
    .limit(HARD_LIMIT)

  if (!isInternal) {
    traficosQuery = traficosQuery.eq('company_id', session.companyId)
  }

  const { data: traficoRows, error: tErr } = await traficosQuery
  if (tErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: tErr.message } },
      { status: 500 }
    )
  }
  const traficos = (traficoRows ?? []) as TraficoRow[]
  if (traficos.length === 0) {
    return NextResponse.json({ data: { traficos: [] }, error: null })
  }

  const traficoIds: string[] = traficos.map(t => t.trafico).filter((x): x is string => !!x)

  // 3. Latest workflow_event per trigger_id (= trafico key) within the active window.
  // One batched query with .in() — no N+1.
  const { data: eventRows, error: eErr } = await supabase
    .from('workflow_events')
    .select('id, event_type, created_at, trigger_id, payload')
    .in('trigger_id', traficoIds)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(HARD_LIMIT * 4)

  if (eErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: eErr.message } },
      { status: 500 }
    )
  }

  const latestByTrafico = new Map<string, WorkflowEventRow>()
  for (const e of (eventRows ?? []) as WorkflowEventRow[]) {
    if (!e.trigger_id) continue
    if (!latestByTrafico.has(e.trigger_id)) {
      latestByTrafico.set(e.trigger_id, e)
    }
  }

  // 4. Resolve position per trafico; filter to ones with a recent event OR not-yet-cleared.
  const pulses: ActiveTraficoPulse[] = []
  for (const t of traficos) {
    if (!t.trafico) continue
    const latest = latestByTrafico.get(t.trafico) ?? null
    if (!latest && t.estatus === 'Cruzado') continue

    const slim: WorkflowEventSlim | null = latest
      ? {
          id: latest.id,
          event_type: latest.event_type,
          created_at: latest.created_at,
          payload: latest.payload,
        }
      : null

    const position = getCorridorPosition(slim, landmarks)

    pulses.push({
      traficoId: t.trafico,
      cliente: t.company_id ?? 'desconocido',
      clienteId: t.company_id ?? 'unknown',
      latestEvent: slim,
      position,
      updatedAt: latest?.created_at ?? new Date(0).toISOString(),
      operatorId: t.assigned_to_operator_id,
    })
  }

  return NextResponse.json({ data: { traficos: pulses }, error: null })
}
