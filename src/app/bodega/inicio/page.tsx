/**
 * ZAPATA AI · /bodega/inicio — warehouse cockpit (Vicente).
 *
 * v7+ canonical composition via CockpitInicio. All queries soft-wrapped
 * (invariant 34). Same 6 nav cards (invariant 29). audit_log feed filtered
 * to warehouse-relevant tables (invariant 32).
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import { bucketDailySeries, sumRange, startOfToday, daysAgo } from '@/lib/cockpit/fetch'
import { softCount, softData } from '@/lib/cockpit/safe-query'
import { auditLogAvailable } from '@/lib/cockpit/table-availability'
import { auditRowToTimelineItem, type AuditRow } from '@/lib/cockpit/audit-format'
import {
  CockpitInicio,
  CockpitErrorCard,
  CockpitSkeleton,
  TimelineFeed,
  CapabilityCardGrid,
  GlassCard,
  SectionHeader,
  type CockpitHeroKPI,
} from '@/components/aguila'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'
import type { CapabilityCounts } from '@/lib/cockpit/capabilities'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CROSSED_ESTATUS = ['Cruzado', 'Cancelado']

function withHardTimeout<T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(p).catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export default async function BodegaInicioPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['warehouse', 'admin', 'broker'].includes(session.role)) redirect('/login')

  const opName = cookieStore.get('operator_name')?.value || 'Vicente'
  const opId = cookieStore.get('operator_id')?.value || ''

  if (opId) {
    try {
      logOperatorAction({ operatorId: opId, actionType: 'view_page', targetId: '/bodega/inicio' })
    } catch { /* telemetry never crashes */ }
  }

  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <BodegaCockpit opName={opName} />
    </Suspense>
  )
}

async function BodegaCockpit({ opName }: { opName: string }) {
  try {
    return await renderBodegaCockpit(opName)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return <CockpitErrorCard message={`No se pudo cargar el cockpit de bodega: ${msg}`} />
  }
}

async function renderBodegaCockpit(opName: string) {
  const sb = createServerClient()
  const now = new Date()
  const todayStartIso = startOfToday(now).toISOString()
  const sevenDaysAgoIso = daysAgo(7, now).toISOString()
  const fourteenDaysAgoIso = daysAgo(14, now).toISOString()
  const ninetyDaysAgoIso = daysAgo(90, now).toISOString()
  const weekEndIso = new Date(now.getTime() + 7 * 86_400_000).toISOString()
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    entradasHoyCount,
    entradas7dCount,
    entradasSeriesRows,
    proximasCount,
    enBodegaEntradas,
    crossedTraficos,
    activosCount,
    activosSeriesRows,
    expedientesCount,
    expedientesSeriesRows,
    pedimentosMesCount,
    pedimentosSeriesRows,
    cruzados7dCount,
    clasificacionesCount,
    clasificacionesSeriesRows,
    catalogoCount,
    auditAvailable,
  ] = await Promise.all([
    softCount(sb.from('entradas').select('cve_entrada', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', todayStartIso)),
    softCount(sb.from('entradas').select('cve_entrada', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', sevenDaysAgoIso)),
    softData<{ fecha_llegada_mercancia: string }>(
      sb.from('entradas').select('fecha_llegada_mercancia').gte('fecha_llegada_mercancia', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(
      sb.from('traficos').select('trafico', { count: 'exact', head: true })
        .gt('fecha_llegada', now.toISOString())
        .lte('fecha_llegada', weekEndIso)
        .not('estatus', 'in', `(${CROSSED_ESTATUS.map((s) => `"${s}"`).join(',')})`)
    ),
    softData<{ cve_entrada: string; trafico: string | null }>(
      sb.from('entradas').select('cve_entrada, trafico').gte('fecha_llegada_mercancia', ninetyDaysAgoIso).not('trafico', 'is', null).limit(5000)
    ),
    softData<{ trafico: string | null }>(
      sb.from('traficos').select('trafico').in('estatus', CROSSED_ESTATUS).gte('fecha_llegada', ninetyDaysAgoIso).limit(5000)
    ),
    // Activos = pending cruce, recent arrival only (excludes historical ghosts).
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).is('fecha_cruce', null).gte('fecha_llegada', ninetyDaysAgoIso)),
    softData<{ fecha_llegada: string }>(
      sb.from('traficos').select('fecha_llegada').is('fecha_cruce', null).gte('fecha_llegada', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('expediente_documentos').select('id', { count: 'exact', head: true })),
    softData<{ uploaded_at: string }>(
      sb.from('expediente_documentos').select('uploaded_at').gte('uploaded_at', fourteenDaysAgoIso).limit(2000)
    ),
    // Pedimentos generados este mes — milestone = fecha_cruce.
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).not('pedimento', 'is', null).gte('fecha_cruce', monthStartIso)),
    softData<{ fecha_cruce: string }>(
      sb.from('traficos').select('fecha_cruce').not('pedimento', 'is', null).gte('fecha_cruce', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).gte('fecha_cruce', sevenDaysAgoIso)),
    softCount(sb.from('globalpc_productos').select('id', { count: 'exact', head: true }).not('fraccion', 'is', null)),
    softData<{ fraccion_classified_at: string }>(
      sb.from('globalpc_productos').select('fraccion_classified_at').not('fraccion_classified_at', 'is', null).gte('fraccion_classified_at', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('globalpc_productos').select('id', { count: 'exact', head: true })),
    withHardTimeout(auditLogAvailable(sb), 2000, false),
  ])

  const crossedSet = new Set<string>(
    crossedTraficos.map((t) => t.trafico).filter((t): t is string => Boolean(t))
  )
  const enBodegaCount = enBodegaEntradas.reduce((acc, row) => {
    const tr = row.trafico
    return tr && !crossedSet.has(tr) ? acc + 1 : acc
  }, 0)

  const entradasSeries       = bucketDailySeries(entradasSeriesRows as Array<Record<string, unknown>>, 'fecha_llegada_mercancia', 14, now)
  const activosSeries        = bucketDailySeries(activosSeriesRows  as Array<Record<string, unknown>>, 'fecha_llegada', 14, now)
  const expedientesSeries    = bucketDailySeries(expedientesSeriesRows as Array<Record<string, unknown>>, 'uploaded_at', 14, now)
  const pedimentosSeries     = bucketDailySeries(pedimentosSeriesRows as Array<Record<string, unknown>>, 'fecha_cruce', 14, now)
  const clasificacionesSeries = bucketDailySeries(clasificacionesSeriesRows as Array<Record<string, unknown>>, 'fraccion_classified_at', 14, now)

  const heroKPIs: CockpitHeroKPI[] = [
    {
      key: 'hoy',
      label: 'Entradas hoy',
      value: entradasHoyCount,
      series: entradasSeries,
      current: sumRange(entradasSeries, 7, 14),
      previous: sumRange(entradasSeries, 0, 7),
      href: '/entradas',
      tone: 'silver',
    },
    {
      key: 'enBodega',
      label: 'En bodega',
      value: enBodegaCount,
      href: '/bodega/patio',
      tone: 'silver',
    },
    {
      key: 'proximas',
      label: 'Próximas 7d',
      value: proximasCount,
      href: '/embarques?estatus=En+Proceso',
      tone: 'silver',
    },
    {
      key: 'semana',
      label: 'Entradas 7d',
      value: entradas7dCount,
      series: entradasSeries,
      current: sumRange(entradasSeries, 7, 14),
      previous: sumRange(entradasSeries, 0, 7),
      href: '/entradas',
      tone: 'silver',
    },
  ]

  const navCounts: NavCounts = {
    traficos:        { count: activosCount,         series: activosSeries,        microStatus: `${cruzados7dCount} cruzaron esta semana` },
    pedimentos:      { count: pedimentosMesCount,   series: pedimentosSeries,     microStatus: 'Este mes' },
    expedientes:     { count: expedientesCount,     series: expedientesSeries,    microStatus: 'Documentos totales' },
    catalogo:        { count: catalogoCount,        series: [],                   microStatus: '—' },
    entradas:        { count: entradasHoyCount,     series: entradasSeries,       microStatus: `${entradas7dCount} recibida${entradas7dCount === 1 ? '' : 's'} esta semana` },
    clasificaciones: { count: clasificacionesCount, series: clasificacionesSeries, microStatus: `${clasificacionesCount} fracciones clasificadas` },
  }

  let auditRows: AuditRow[] = []
  if (auditAvailable) {
    auditRows = await softData<AuditRow>(
      sb.from('audit_log')
        .select('id, table_name, action, record_id, changed_at, company_id')
        .in('table_name', ['entradas', 'expediente_documentos', 'traficos'])
        .order('changed_at', { ascending: false })
        .limit(10)
    )
  }
  const actividadItems = auditRows.map(auditRowToTimelineItem)

  const estadoSections = (
    <GlassCard padding={20}>
      <SectionHeader title="Acciones de bodega" />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        marginTop: 12,
      }}>
        {[
          { href: '/bodega/recibir', label: 'Recibir', sub: 'Registrar mercancía entrante' },
          { href: '/bodega/escanear', label: 'Escanear', sub: 'Código de barras o QR' },
          { href: '/bodega/patio', label: 'Patio', sub: 'Tráiler y ubicación' },
          { href: '/bodega/subir', label: 'Subir', sub: 'Fotos o documentos' },
        ].map((a) => (
          <a
            key={a.href}
            href={a.href}
            style={{
              display: 'block',
              padding: '12px 14px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.02)',
              textDecoration: 'none',
              color: '#E6EDF3',
              fontSize: 13,
              fontWeight: 600,
              minHeight: 60,
            }}
          >
            <div>{a.label}</div>
            <div style={{ fontSize: 11, color: 'rgba(230,237,243,0.55)', marginTop: 2, fontWeight: 400 }}>{a.sub}</div>
          </a>
        ))}
      </div>
    </GlassCard>
  )

  // V1 — microStatus is DYNAMIC only. Static subtitle lives in CAPABILITY_CARDS.
  const capabilityCounts: CapabilityCounts = {
    checklist:    { count: expedientesCount,     microStatus: expedientesCount > 0 ? `${expedientesCount} totales` : undefined },
    clasificador: { count: clasificacionesCount, microStatus: clasificacionesCount > 0 ? `${clasificacionesCount} fracciones` : undefined },
    mensajes:     { count: null },
  }
  const capabilitySlot = <CapabilityCardGrid counts={capabilityCounts} />

  const actividadSlot = (
    <TimelineFeed items={actividadItems} max={10} emptyLabel="Sin actividad reciente en bodega." />
  )

  const summaryLine = enBodegaCount > 0
    ? `${enBodegaCount} entrada${enBodegaCount === 1 ? '' : 's'} en bodega · ${entradasHoyCount} llegaron hoy.`
    : entradasHoyCount > 0
      ? `${entradasHoyCount} entrada${entradasHoyCount === 1 ? '' : 's'} hoy.`
      : 'Sin entradas hoy. Las próximas llegadas aparecerán aquí.'

  return (
    <CockpitInicio
      role="warehouse"
      name={opName}
      heroKPIs={heroKPIs}
      navCounts={navCounts}
      estadoSections={estadoSections}
      capabilitySlot={capabilitySlot}
      actividadSlot={actividadSlot}
      systemStatus={enBodegaCount > 20 ? 'warning' : 'healthy'}
      pulseSignal={entradasHoyCount > 0}
      summaryLine={summaryLine}
    />
  )
}
