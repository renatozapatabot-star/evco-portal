/**
 * AGUILA · V1.5 F6 — GET /api/eagle/overview
 *
 * Tito's morning view. Returns the six Eagle tiles:
 *   1. traficosByStatus  — count grouped by estatus (active motion statuses)
 *   2. ar / ap           — reuse F3 computeARAging / computeAPAging
 *   3. dormant           — top 3 companies with no embarque in 14+ days
 *   4. atenciones        — top 5 merged: MVE critical open + dormant (+ optional
 *                          audit_suggestions if the table exists)
 *   5. recentActivity    — last 20 workflow_events for the company
 *
 * Role-gated to admin + broker. Sends `eagle_view_opened` telemetry via
 * interaction_events.payload.event (locked TelemetryEvent union untouched).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { computeARAging, computeAPAging, type AgingResult } from '@/lib/contabilidad/aging'
import { detectDormantClients } from '@/lib/dormant/detect'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_ROLES = new Set(['admin', 'broker'])
const DORMANT_DAYS = 14
const MOTION_STATUSES = ['En Proceso', 'Documentacion', 'En Aduana', 'Pedimento Pagado', 'Cruzado']

export interface TraficoStatusBucket {
  status: string
  count: number
}

export interface DormantClient {
  companyId: string
  razonSocial: string
  diasSinMovimiento: number
  ultimoMonto: number | null
}

export interface AtencionItem {
  id: string
  kind: 'mve_critical' | 'dormant' | 'audit_suggestion'
  label: string
  detail: string
  href: string
  severityRank: number // lower = more urgent
}

export interface ActivityItem {
  id: string
  workflow: string
  event_type: string
  trigger_id: string | null
  created_at: string
}

export interface EagleOverview {
  traficosByStatus: TraficoStatusBucket[]
  ar: AgingResult
  ap: AgingResult
  dormant: DormantClient[]
  atenciones: AtencionItem[]
  recentActivity: ActivityItem[]
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

// Owner aggregates across every tenant under Patente 3596 (core-invariants 31).
// Never filter by session.companyId — admin/broker sessions encode literal
// 'admin'/'internal' which match no real company_id.
async function fetchTraficosByStatus(sb: SupabaseClient): Promise<TraficoStatusBucket[]> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data, error } = await sb
    .from('traficos')
    .select('estatus')
    .in('estatus', MOTION_STATUSES)
    .limit(5000)
  if (error || !data) return []
  const counts = new Map<string, number>()
  for (const row of data as { estatus: string | null }[]) {
    const s = row.estatus ?? 'Sin estado'
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }))
}

async function fetchDormant(sb: SupabaseClient): Promise<DormantClient[]> {
  const records = await detectDormantClients(sb, null, DORMANT_DAYS)
  return records.slice(0, 3).map((r) => ({
    companyId: r.clienteId,
    razonSocial: r.clienteName,
    diasSinMovimiento: r.diasSinMovimiento,
    ultimoMonto: r.lastInvoiceAmount,
  }))
}

// Cross-tenant — see fetchTraficosByStatus note.
async function fetchAtenciones(sb: SupabaseClient, dormant: DormantClient[]): Promise<AtencionItem[]> {
  const items: AtencionItem[] = []

  // MVE critical
  const { data: mve } = await sb
    .from('mve_alerts')
    .select('id, rule_code, trafico_id, severity')
    .eq('severity', 'critical')
    .eq('resolved', false)
    .limit(10)
  for (const a of (mve ?? []) as { id: string; rule_code: string | null; trafico_id: string | null }[]) {
    items.push({
      id: `mve-${a.id}`,
      kind: 'mve_critical',
      label: 'MVE crítico',
      detail: a.rule_code ?? a.trafico_id ?? 'Alerta sin código',
      href: '/mve/alerts',
      severityRank: 0,
    })
  }

  // Optional: audit_suggestions table (may not exist — fail soft)
  try {
    const { data: sugg, error: suggErr } = await sb
      .from('audit_suggestions')
      .select('id, title, status')
      .eq('status', 'pending')
      .limit(10)
    if (!suggErr && sugg) {
      for (const s of sugg as { id: string; title: string | null }[]) {
        items.push({
          id: `sugg-${s.id}`,
          kind: 'audit_suggestion',
          label: 'Sugerencia de auditoría',
          detail: s.title ?? 'Pendiente',
          href: '/admin/inicio',
          severityRank: 1,
        })
      }
    }
  } catch {
    // table missing — graceful
  }

  // Dormant clients as attentions
  for (const d of dormant) {
    items.push({
      id: `dorm-${d.companyId}`,
      kind: 'dormant',
      label: 'Cliente dormido',
      detail: `${d.razonSocial} · ${d.diasSinMovimiento}d`,
      href: `/clientes/${d.companyId}`,
      severityRank: 2,
    })
  }

  items.sort((a, b) => a.severityRank - b.severityRank)
  return items.slice(0, 5)
}

// Cross-tenant — see fetchTraficosByStatus note.
async function fetchRecentActivity(sb: SupabaseClient): Promise<ActivityItem[]> {
  const { data } = await sb
    .from('workflow_events')
    .select('id, workflow, event_type, trigger_id, created_at')
    .order('created_at', { ascending: false })
    .limit(20)
  return ((data ?? []) as ActivityItem[]) ?? []
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return errorResponse('UNAUTHORIZED', 'Sesión inválida', 401)
  if (!ALLOWED_ROLES.has(session.role)) {
    return errorResponse('FORBIDDEN', 'Sin permiso para ver Eagle', 403)
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Invariant 31: owner/broker cockpit aggregates across all tenants.
  const [traficosByStatus, ar, ap, dormant, recentActivity] = await Promise.all([
    fetchTraficosByStatus(sb),
    computeARAging(sb, null),
    computeAPAging(sb, null),
    fetchDormant(sb),
    fetchRecentActivity(sb),
  ])

  const atenciones = await fetchAtenciones(sb, dormant)

  // Telemetry: event rides in payload so the locked TelemetryEvent union stays at 15.
  await sb.from('interaction_events').insert({
    event_type: 'eagle_view_opened',
    event_name: 'eagle_view_opened',
    page_path: '/admin/eagle',
    user_id: `${session.companyId}:${session.role}`,
    company_id: session.companyId,
    payload: { event: 'eagle_view_opened' },
  })

  const data: EagleOverview = {
    traficosByStatus,
    ar,
    ap,
    dormant,
    atenciones,
    recentActivity,
  }

  return NextResponse.json(
    { data, error: null },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  )
}
