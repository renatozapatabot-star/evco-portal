/**
 * AGUILA · V1.5 F6 — Eagle View (Tito's morning view)
 *
 * One screen, six glass tiles: tráficos by status, AR/AP, dormant clients,
 * top 5 attentions, live corridor, team activity. Role-gated to admin + broker.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { computeARAging, computeAPAging } from '@/lib/contabilidad/aging'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'
import { CoordinatesBadge } from '@/components/brand/CoordinatesBadge'
import {
  ACCENT_SILVER_BRIGHT,
  BG_DEEP,
  TEXT_MUTED,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { TraficosDelDiaTile } from '@/components/eagle/TraficosDelDiaTile'
import { ArApTile } from '@/components/eagle/ArApTile'
import { ClientesDormidosTile } from '@/components/eagle/ClientesDormidosTile'
import { TopAtencionesTile } from '@/components/eagle/TopAtencionesTile'
import { CorredorTile } from '@/components/eagle/CorredorTile'
import { TeamActivityTile } from '@/components/eagle/TeamActivityTile'
import type {
  ActivityItem,
  AtencionItem,
  DormantClient,
  TraficoStatusBucket,
} from '@/app/api/eagle/overview/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MOTION_STATUSES = ['En Proceso', 'Documentacion', 'En Aduana', 'Pedimento Pagado', 'Cruzado']
const DORMANT_DAYS = 14

function greetingByHour(): string {
  const h = new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' })
  const hour = parseInt(h, 10)
  if (hour < 12) return 'Buenos días, Tito'
  if (hour < 19) return 'Buenas tardes, Tito'
  return 'Buenas noches, Tito'
}

interface EagleData {
  traficosByStatus: TraficoStatusBucket[]
  ar: Awaited<ReturnType<typeof computeARAging>>
  ap: Awaited<ReturnType<typeof computeAPAging>>
  dormant: DormantClient[]
  atenciones: AtencionItem[]
  recentActivity: ActivityItem[]
}

export default async function EaglePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/')

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [traficosRes, ar, ap, recentForDormant, companiesRes, activityRes] = await Promise.all([
    sb
      .from('traficos')
      .select('estatus')
      .eq('company_id', session.companyId)
      .in('estatus', MOTION_STATUSES)
      .limit(5000),
    computeARAging(sb, session.companyId),
    computeAPAging(sb, session.companyId),
    sb
      .from('traficos')
      .select('company_id, created_at')
      .gte('created_at', new Date(Date.now() - DORMANT_DAYS * 86_400_000).toISOString())
      .limit(5000),
    sb.from('companies').select('company_id, razon_social, is_active').eq('is_active', true).limit(500),
    sb
      .from('workflow_events')
      .select('id, workflow, event_type, trigger_id, created_at')
      .eq('company_id', session.companyId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // traficosByStatus
  const counts = new Map<string, number>()
  for (const r of (traficosRes.data ?? []) as { estatus: string | null }[]) {
    const s = r.estatus ?? 'Sin estado'
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  const traficosByStatus: TraficoStatusBucket[] = Array.from(counts.entries()).map(([status, count]) => ({ status, count }))

  // dormant (top 3)
  const activeIds = new Set<string>()
  for (const r of (recentForDormant.data ?? []) as { company_id: string | null }[]) {
    if (r.company_id) activeIds.add(r.company_id)
  }
  const dormantCandidates = ((companiesRes.data ?? []) as { company_id: string; razon_social: string | null }[])
    .filter((c) => !activeIds.has(c.company_id))
    .slice(0, 3)

  const dormant: DormantClient[] = []
  for (const c of dormantCandidates) {
    const { data: last } = await sb
      .from('traficos')
      .select('created_at, importe_total')
      .eq('company_id', c.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const lastRow = last as { created_at: string | null; importe_total: number | null } | null
    const dias = lastRow?.created_at
      ? Math.floor((Date.now() - new Date(lastRow.created_at).getTime()) / 86_400_000)
      : 999
    dormant.push({
      companyId: c.company_id,
      razonSocial: c.razon_social ?? c.company_id,
      diasSinMovimiento: dias,
      ultimoMonto: lastRow?.importe_total ?? null,
    })
  }

  // atenciones
  const atenciones: AtencionItem[] = []
  const { data: mveRows } = await sb
    .from('mve_alerts')
    .select('id, rule_code, trafico_id')
    .eq('company_id', session.companyId)
    .eq('severity', 'critical')
    .eq('resolved', false)
    .limit(10)
  for (const a of (mveRows ?? []) as { id: string; rule_code: string | null; trafico_id: string | null }[]) {
    atenciones.push({
      id: `mve-${a.id}`,
      kind: 'mve_critical',
      label: 'MVE crítico',
      detail: a.rule_code ?? a.trafico_id ?? 'Alerta sin código',
      href: '/mve/alerts',
      severityRank: 0,
    })
  }
  try {
    const { data: sugg, error: suggErr } = await sb
      .from('audit_suggestions')
      .select('id, title, status')
      .eq('status', 'pending')
      .limit(10)
    if (!suggErr && sugg) {
      for (const s of sugg as { id: string; title: string | null }[]) {
        atenciones.push({
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
    // table absent — graceful
  }
  for (const d of dormant) {
    atenciones.push({
      id: `dorm-${d.companyId}`,
      kind: 'dormant',
      label: 'Cliente dormido',
      detail: `${d.razonSocial} · ${d.diasSinMovimiento}d`,
      href: `/clientes/${d.companyId}`,
      severityRank: 2,
    })
  }
  atenciones.sort((a, b) => a.severityRank - b.severityRank)
  const atencionesTop = atenciones.slice(0, 5)

  const recentActivity = ((activityRes.data ?? []) as ActivityItem[]) ?? []

  const data: EagleData = {
    traficosByStatus,
    ar,
    ap,
    dormant,
    atenciones: atencionesTop,
    recentActivity,
  }

  return (
    <div style={{ background: BG_DEEP, minHeight: '100vh', padding: '32px 24px 48px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AguilaMark size={40} tone="silver" />
          <div>
            <AguilaWordmark />
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 4 }}>Vista Águila · Tito</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CoordinatesBadge />
          <div style={{ fontSize: 14, color: ACCENT_SILVER_BRIGHT, fontWeight: 600 }}>{greetingByHour()}</div>
        </div>
      </header>

      <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: '0 0 20px' }}>
        Una pantalla · seis señales · cero clics para decidir.
      </p>

      <section
        className="eagle-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        <TraficosDelDiaTile buckets={data.traficosByStatus} />
        <ArApTile ar={data.ar} ap={data.ap} />
        <ClientesDormidosTile dormant={data.dormant} />
        <TopAtencionesTile items={data.atenciones} />
        <CorredorTile />
        <TeamActivityTile initial={data.recentActivity} />
      </section>

      <style>{`
        @media (max-width: 900px) {
          .eagle-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
