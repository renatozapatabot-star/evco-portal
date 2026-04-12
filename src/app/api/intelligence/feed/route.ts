// src/app/api/intelligence/feed/route.ts
// Role-personalized intelligence ticker feed. Returns up to 8 items.
//
// Many of the data sources below are placeholders (USD/MXN, bridge waits)
// and will be wired to live feeds in later features:
//   - USD/MXN  -> Banxico (F18)
//   - Bridge waits -> CBP bridge-times cron (F18)
//   - Dormant detection -> F7
//   - Yard occupancy -> bodega metrics polish
//
// Silent on partial failure: any section that errors is dropped, the rest ship.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { verifySession, type PortalRole } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Trend = 'up' | 'down' | 'flat'
interface Item {
  id: string
  icon?: string
  label: string
  value: string
  trend?: Trend
}

const nf = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 })
const pctFmt = (n: number) => `${n > 0 ? '+' : ''}${nf.format(Math.round(n * 10) / 10)}%`
const mxn = (n: number) => `$${nf.format(Math.round(n))} MXN`

// --- Placeholder fetchers (hardcoded; replace in F18) ----------------------

function usdMxnItem(): Item {
  // TODO(F18): wire Banxico fix_usd_mxn
  return { id: 'fx', label: 'USD/MXN', value: '17.34', trend: 'up' }
}

function solidarityWaitItem(): Item {
  // TODO(F18): wire CBP bridge-times cron
  return { id: 'bridge-solidarity', label: 'Puente Solidarity', value: '18 min', trend: 'flat' }
}

function bridgeWaitsItems(): Item[] {
  // TODO(F18): wire CBP bridge-times cron for 4 bridges
  return [
    { id: 'b-solidarity', label: 'Solidarity', value: '18 min' },
    { id: 'b-world-trade', label: 'World Trade', value: '24 min' },
    { id: 'b-colombia', label: 'Colombia', value: '9 min' },
    { id: 'b-bnw', label: 'B&M', value: '32 min' },
  ]
}

// --- Live fetchers ---------------------------------------------------------

async function mveCriticalCount(): Promise<Item | null> {
  try {
    const { count } = await supabase
      .from('mve_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'critical')
      .is('resolved_at', null)
    if (count == null) return null
    return { id: 'mve-crit', label: 'MVE crítico', value: String(count) }
  } catch {
    return null
  }
}

async function pendingDocSolicitationsCount(): Promise<Item | null> {
  try {
    const { count } = await supabase
      .from('documento_solicitudes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendiente')
    if (count == null) return null
    return { id: 'docs-pend', label: 'Solicitudes pend.', value: String(count) }
  } catch {
    return null
  }
}

async function entradasLast24hCount(): Promise<Item | null> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('entradas')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since)
    if (count == null) return null
    return { id: 'entr-24h', label: 'Entradas 24h', value: String(count) }
  } catch {
    return null
  }
}

async function clientActiveTraficos(companyId: string): Promise<Item | null> {
  try {
    const { count } = await supabase
      .from('traficos')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .neq('status', 'cruzado')
    if (count == null) return null
    return { id: 'mine-active', label: 'Mis tráficos activos', value: String(count) }
  } catch {
    return null
  }
}

async function clientLastCrossing(companyId: string): Promise<Item | null> {
  try {
    const { data } = await supabase
      .from('traficos')
      .select('fecha_cruce, trafico_number')
      .eq('company_id', companyId)
      .not('fecha_cruce', 'is', null)
      .order('fecha_cruce', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data?.fecha_cruce) return null
    const d = new Date(data.fecha_cruce)
    const label = d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Chicago',
    })
    return { id: 'last-cross', label: 'Último cruce', value: label }
  } catch {
    return null
  }
}

async function topClientMoMDelta(): Promise<Item | null> {
  try {
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const [thisM, lastM] = await Promise.all([
      supabase
        .from('facturas')
        .select('company_id, total_mxn')
        .gte('fecha', thisMonthStart)
        .limit(500),
      supabase
        .from('facturas')
        .select('company_id, total_mxn')
        .gte('fecha', lastMonthStart)
        .lt('fecha', thisMonthStart)
        .limit(500),
    ])
    if (!thisM.data || !lastM.data) return null
    const sumBy = (rows: { company_id: string | null; total_mxn: number | null }[]) => {
      const m = new Map<string, number>()
      for (const r of rows) {
        if (!r.company_id) continue
        m.set(r.company_id, (m.get(r.company_id) ?? 0) + (r.total_mxn ?? 0))
      }
      return m
    }
    const tm = sumBy(thisM.data)
    const lm = sumBy(lastM.data)
    let topId: string | null = null
    let topDelta = 0
    for (const [id, cur] of tm) {
      const prev = lm.get(id) ?? 0
      if (prev <= 0) continue
      const delta = ((cur - prev) / prev) * 100
      if (Math.abs(delta) > Math.abs(topDelta)) {
        topDelta = delta
        topId = id
      }
    }
    if (!topId) return null
    return {
      id: 'top-client',
      label: 'Cliente líder MoM',
      value: `${topId} ${pctFmt(topDelta)}`,
      trend: topDelta >= 0 ? 'up' : 'down',
    }
  } catch {
    return null
  }
}

async function dormantClientsItems(): Promise<Item[]> {
  try {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recent } = await supabase
      .from('traficos')
      .select('company_id, created_at')
      .gte('created_at', cutoff)
      .limit(2000)
    const activeIds = new Set((recent ?? []).map((r) => r.company_id).filter(Boolean))
    const { data: companies } = await supabase
      .from('companies')
      .select('company_id, razon_social')
      .eq('is_active', true)
      .limit(100)
    const dormant = (companies ?? []).filter((c) => !activeIds.has(c.company_id)).slice(0, 2)
    return dormant.map((c, i) => ({
      id: `dormant-${i}`,
      label: 'Sin movimiento 14d+',
      value: String(c.razon_social ?? c.company_id ?? '—').slice(0, 24),
    }))
  } catch {
    return []
  }
}

async function overdueARTotal(): Promise<Item | null> {
  try {
    const today = new Date().toISOString()
    const { data } = await supabase
      .from('facturas')
      .select('total_mxn, fecha_vencimiento, pagada')
      .eq('pagada', false)
      .lt('fecha_vencimiento', today)
      .limit(500)
    const sum = (data ?? []).reduce((a, r) => a + (r.total_mxn ?? 0), 0)
    if (sum <= 0) return null
    return { id: 'ar-overdue', label: 'CxC vencido', value: mxn(sum) }
  } catch {
    return null
  }
}

async function yardOccupancyItem(): Promise<Item | null> {
  try {
    // TODO: replace with real capacity; using simple occupied-row ratio for now.
    const { count: occupied } = await supabase
      .from('yard_positions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ocupado')
    const { count: total } = await supabase
      .from('yard_positions')
      .select('*', { count: 'exact', head: true })
    if (total == null || total === 0 || occupied == null) return null
    const pct = Math.round((occupied / total) * 100)
    return { id: 'yard', label: 'Patio ocupado', value: `${pct}%` }
  } catch {
    return null
  }
}

// --- Role dispatcher -------------------------------------------------------

async function itemsForRole(role: PortalRole, companyId: string): Promise<Item[]> {
  if (role === 'admin' || role === 'broker') {
    const [mom, dormant, mve] = await Promise.all([
      topClientMoMDelta(),
      dormantClientsItems(),
      mveCriticalCount(),
    ])
    return [usdMxnItem(), ...(mom ? [mom] : []), ...dormant, ...(mve ? [mve] : []), solidarityWaitItem()]
  }
  if (role === 'operator') {
    const [docs, mve] = await Promise.all([pendingDocSolicitationsCount(), mveCriticalCount()])
    return [...bridgeWaitsItems(), ...(docs ? [docs] : []), ...(mve ? [mve] : [])]
  }
  if (role === 'contabilidad') {
    const ar = await overdueARTotal()
    return [usdMxnItem(), ...(ar ? [ar] : [])]
  }
  if (role === 'warehouse') {
    const [entradas, yard] = await Promise.all([entradasLast24hCount(), yardOccupancyItem()])
    return [...(entradas ? [entradas] : []), ...(yard ? [yard] : [])]
  }
  // client
  const [active, last] = await Promise.all([
    clientActiveTraficos(companyId),
    clientLastCrossing(companyId),
  ])
  return [...(active ? [active] : []), ...(last ? [last] : []), usdMxnItem()]
}

async function trackFetched(companyId: string, role: PortalRole, count: number) {
  try {
    await supabase.from('portal_audit_log').insert({
      event_type: 'telemetry',
      tenant_slug: companyId,
      path: '/api/intelligence/feed',
      metadata: { event: 'intelligence_feed_fetched', role, count },
    })
  } catch {
    // best-effort
  }
}

export async function GET() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const { companyId, role } = session

  try {
    const raw = await itemsForRole(role, companyId)
    const items = raw.slice(0, 8)
    void trackFetched(companyId, role, items.length)
    return NextResponse.json(
      { data: { items }, error: null },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  } catch (err) {
    return NextResponse.json({
      data: { items: [] },
      error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'feed error' },
    })
  }
}
