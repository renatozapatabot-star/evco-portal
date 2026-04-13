// AGUILA · /inicio — cliente cockpit (V1.5 F11 → v7).
//
// Client surface composes the unified cockpit. Invariant 24 preserved:
// no DeltaIndicator, no SeverityRibbon, no amber/red sparklines — silver only.
// Sparklines show positive-direction aggregates (your shipments, your entradas).
//
// Non-client roles (operator/admin/broker/warehouse/contabilidad) are
// redirected to their usual cockpit at `/`.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import {
  getClienteActiveTraficos,
  getClienteDocuments,
  getClienteNotifications,
} from '@/lib/cliente/dashboard'
import { bucketDailySeries, daysAgo, startOfToday } from '@/lib/cockpit/fetch'
import { CockpitInicio, type CockpitHeroKPI, type TimelineItem } from '@/components/aguila'
import { ClienteEstado } from '@/components/cliente/ClienteEstado'
import { getClienteEventLabel } from '@/lib/cliente/event-labels'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InicioPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (session.role !== 'client') redirect('/')

  const supabase = createServerClient()
  const companyId = session.companyId
  const now = new Date()
  const todayStartIso = startOfToday(now).toISOString()
  const sevenDaysAgoIso = daysAgo(7, now).toISOString()
  const fourteenDaysAgoIso = daysAgo(14, now).toISOString()
  const thirtyDaysAgoIso = daysAgo(30, now).toISOString()

  const [
    activeTraficos,
    documentos,
    notificaciones,
    companyRow,
    traficosActivosSeriesRes,
    pedimentosListosSeriesRes,
    expedientesSeriesRes,
    entradasSeriesRes,
    clasificacionesSeriesRes,
    cruzadosMesRes,
    cruzadosMesSeriesRes,
    entradasSemanaRes,
    pedimentosListosCountRes,
    expedientesCountRes,
    catalogoCountRes,
    clasificacionesCountRes,
  ] = await Promise.all([
    getClienteActiveTraficos(supabase, companyId),
    getClienteDocuments(supabase, companyId),
    getClienteNotifications(supabase, companyId),
    supabase.from('companies').select('name').eq('company_id', companyId).maybeSingle(),
    // Series: 14-day buckets, all client-scoped
    supabase.from('traficos')
      .select('updated_at')
      .eq('company_id', companyId)
      .eq('estatus', 'En Proceso')
      .gte('updated_at', fourteenDaysAgoIso)
      .limit(2000),
    supabase.from('traficos')
      .select('updated_at')
      .eq('company_id', companyId)
      .not('pedimento', 'is', null)
      .gte('updated_at', fourteenDaysAgoIso)
      .limit(2000),
    supabase.from('expediente_documentos')
      .select('created_at, trafico_id')
      .gte('created_at', fourteenDaysAgoIso)
      .limit(2000),
    supabase.from('entradas')
      .select('fecha_llegada_mercancia')
      .eq('company_id', companyId)
      .gte('fecha_llegada_mercancia', fourteenDaysAgoIso)
      .limit(2000),
    supabase.from('globalpc_productos')
      .select('fraccion_classified_at, cve_cliente')
      .not('fraccion_classified_at', 'is', null)
      .gte('fraccion_classified_at', fourteenDaysAgoIso)
      .limit(2000),
    // Hero: "Cruces este mes" — Cruzado status in last 30d
    supabase.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('estatus', 'Cruzado')
      .gte('updated_at', thirtyDaysAgoIso),
    supabase.from('traficos')
      .select('updated_at')
      .eq('company_id', companyId)
      .eq('estatus', 'Cruzado')
      .gte('updated_at', fourteenDaysAgoIso)
      .limit(2000),
    // Hero: entradas this week
    supabase.from('entradas')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('fecha_llegada_mercancia', sevenDaysAgoIso),
    // Nav counts (client-scoped)
    supabase.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('pedimento', 'is', null),
    // Total client documents
    supabase.from('expediente_documentos')
      .select('id', { count: 'exact', head: true }),
    // Catálogo: client's products count
    supabase.from('globalpc_productos')
      .select('id', { count: 'exact', head: true }),
    // Clasificaciones: client's classified products
    supabase.from('globalpc_productos')
      .select('id', { count: 'exact', head: true })
      .not('fraccion_classified_at', 'is', null),
  ])

  const companyName = (companyRow?.data?.name as string) ?? ''

  // Telemetry — fire-and-forget
  const opId = cookieStore.get('operator_id')?.value
  logOperatorAction({
    operatorId: opId,
    actionType: 'view_page',
    targetId: '/inicio',
    companyId,
    payload: {
      event: 'cliente_inicio_viewed',
      active_traficos: activeTraficos.length,
      documentos: documentos.length,
      notificaciones: notificaciones.length,
    },
  })

  const traficosActivosSeries = bucketDailySeries(traficosActivosSeriesRes.data as Array<Record<string, unknown>> | null, 'updated_at', 14, now)
  const pedimentosListosSeries = bucketDailySeries(pedimentosListosSeriesRes.data as Array<Record<string, unknown>> | null, 'updated_at', 14, now)
  const expedientesSeries = bucketDailySeries(expedientesSeriesRes.data as Array<Record<string, unknown>> | null, 'created_at', 14, now)
  const entradasSeries = bucketDailySeries(entradasSeriesRes.data as Array<Record<string, unknown>> | null, 'fecha_llegada_mercancia', 14, now)
  const clasificacionesSeries = bucketDailySeries(clasificacionesSeriesRes.data as Array<Record<string, unknown>> | null, 'fraccion_classified_at', 14, now)
  const cruzadosMesSeries = bucketDailySeries(cruzadosMesSeriesRes.data as Array<Record<string, unknown>> | null, 'updated_at', 14, now)

  // Hero KPIs for client — silver tone only, no deltas (invariant 24).
  const heroKPIs: CockpitHeroKPI[] = [
    {
      key: 'traficos',
      label: 'Tráficos activos',
      value: activeTraficos.length,
      series: traficosActivosSeries,
      href: '/traficos',
      tone: 'silver',
    },
    {
      key: 'entradas',
      label: 'Entradas esta semana',
      value: entradasSemanaRes.count ?? 0,
      series: entradasSeries,
      href: '/entradas',
      tone: 'silver',
    },
    {
      key: 'pedimentos',
      label: 'Pedimentos listos',
      value: pedimentosListosCountRes.count ?? 0,
      series: pedimentosListosSeries,
      href: '/pedimentos',
      tone: 'silver',
    },
    {
      key: 'cruces',
      label: 'Cruces este mes',
      value: cruzadosMesRes.count ?? 0,
      series: cruzadosMesSeries,
      href: '/traficos?estatus=Cruzado',
      tone: 'silver',
    },
  ]

  const navCounts: NavCounts = {
    traficos:        { count: activeTraficos.length,                     series: traficosActivosSeries },
    pedimentos:      { count: pedimentosListosCountRes.count ?? 0,       series: pedimentosListosSeries },
    expedientes:     { count: expedientesCountRes.count ?? 0,            series: expedientesSeries },
    catalogo:        { count: catalogoCountRes.count ?? 0,               series: [] },
    entradas:        { count: entradasSemanaRes.count ?? 0,              series: entradasSeries },
    clasificaciones: { count: clasificacionesCountRes.count ?? 0,        series: clasificacionesSeries },
  }

  const actividad: TimelineItem[] = notificaciones.slice(0, 10).map((n) => {
    const label = getClienteEventLabel(n.event_type)
    return {
      id: String(n.id),
      title: n.trafico_id || '—',
      subtitle: label.label,
      timestamp: n.created_at || new Date().toISOString(),
      href: n.trafico_id ? `/traficos/${encodeURIComponent(n.trafico_id)}/trace` : undefined,
    }
  })

  const estadoSections = (
    <ClienteEstado
      activeTraficos={activeTraficos}
      documentos={documentos}
    />
  )

  const summaryLine = activeTraficos.length > 0
    ? `${activeTraficos.length} tráfico${activeTraficos.length === 1 ? '' : 's'} en movimiento. Tu patente, en tiempo real.`
    : 'Sin tráficos activos. Tus próximas operaciones aparecerán aquí.'

  return (
    <CockpitInicio
      role="client"
      name={companyName || 'Tu portal'}
      companyName={companyName || 'Tu portal'}
      heroKPIs={heroKPIs}
      navCounts={navCounts}
      estadoSections={estadoSections}
      actividad={actividad}
      actividadEmptyLabel="Aún no hay eventos recientes en tus operaciones."
      summaryLine={summaryLine}
    />
  )
}
