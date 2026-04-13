// AGUILA · /inicio — cliente cockpit (v9).
//
// Every query soft-wrapped — one bad column never crashes the page.
// Invariant 24 preserved: no DeltaIndicator, no SeverityRibbon, no
// amber/red sparklines. Silver-only sparklines for positive-direction
// aggregates.
//
// Actividad Reciente = live Mensajería feed (operators → client).
// Feature flag NEXT_PUBLIC_MENSAJERIA_CLIENT=false → placeholder.
//
// Non-client roles (operator/admin/broker) are redirected to their cockpit at `/`.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import {
  getClienteActiveTraficos,
  getClienteDocuments,
} from '@/lib/cliente/dashboard'
import { bucketDailySeries, daysAgo, startOfToday } from '@/lib/cockpit/fetch'
import { softCount, softData, softFirst } from '@/lib/cockpit/safe-query'
import { CockpitInicio, MensajeriaFeed, type CockpitHeroKPI } from '@/components/aguila'
import { ClienteEstado } from '@/components/cliente/ClienteEstado'
import { fetchClientMensajeriaFeed, mensajeriaClientEnabled } from '@/lib/mensajeria/feed'
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
    companyRow,
    traficosActivosSeriesRows,
    pedimentosListosSeriesRows,
    expedientesSeriesRows,
    entradasSeriesRows,
    clasificacionesSeriesRows,
    cruzadosMesSeriesRows,
    cruzadosMesCount,
    entradasSemanaCount,
    pedimentosListosCount,
    expedientesCount,
    catalogoCount,
    clasificacionesCount,
    cruzados7dCount,
    pedimentosMonthCount,
    lastPedimento,
    mensajeriaMessages,
  ] = await Promise.all([
    getClienteActiveTraficos(supabase, companyId).catch(() => []),
    getClienteDocuments(supabase, companyId).catch(() => []),
    softFirst<{ name: string | null; clave_cliente?: string | null }>(
      supabase.from('companies').select('name, clave_cliente').eq('company_id', companyId).limit(1)
    ),
    softData<{ updated_at: string }>(
      supabase.from('traficos')
        .select('updated_at')
        .eq('company_id', companyId)
        .eq('estatus', 'En Proceso')
        .gte('updated_at', fourteenDaysAgoIso)
        .limit(2000)
    ),
    softData<{ updated_at: string }>(
      supabase.from('traficos')
        .select('updated_at')
        .eq('company_id', companyId)
        .not('pedimento', 'is', null)
        .gte('updated_at', fourteenDaysAgoIso)
        .limit(2000)
    ),
    softData<{ created_at: string }>(
      supabase.from('expediente_documentos')
        .select('created_at')
        .gte('created_at', fourteenDaysAgoIso)
        .limit(2000)
    ),
    softData<{ fecha_llegada_mercancia: string }>(
      supabase.from('entradas')
        .select('fecha_llegada_mercancia')
        .eq('company_id', companyId)
        .gte('fecha_llegada_mercancia', fourteenDaysAgoIso)
        .limit(2000)
    ),
    softData<{ fraccion_classified_at: string }>(
      supabase.from('globalpc_productos')
        .select('fraccion_classified_at')
        .not('fraccion_classified_at', 'is', null)
        .gte('fraccion_classified_at', fourteenDaysAgoIso)
        .limit(2000)
    ),
    softData<{ updated_at: string }>(
      supabase.from('traficos')
        .select('updated_at')
        .eq('company_id', companyId)
        .eq('estatus', 'Cruzado')
        .gte('updated_at', fourteenDaysAgoIso)
        .limit(2000)
    ),
    softCount(
      supabase.from('traficos')
        .select('trafico', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('estatus', 'Cruzado')
        .gte('updated_at', thirtyDaysAgoIso)
    ),
    softCount(
      supabase.from('entradas')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('fecha_llegada_mercancia', sevenDaysAgoIso)
    ),
    softCount(
      supabase.from('traficos')
        .select('trafico', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .not('pedimento', 'is', null)
    ),
    softCount(
      supabase.from('expediente_documentos').select('id', { count: 'exact', head: true })
    ),
    softCount(
      supabase.from('globalpc_productos').select('id', { count: 'exact', head: true })
    ),
    softCount(
      supabase.from('globalpc_productos')
        .select('id', { count: 'exact', head: true })
        .not('fraccion_classified_at', 'is', null)
    ),
    softCount(
      supabase.from('traficos')
        .select('trafico', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('estatus', 'Cruzado')
        .gte('updated_at', sevenDaysAgoIso)
    ),
    softCount(
      supabase.from('traficos')
        .select('trafico', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .not('pedimento', 'is', null)
        .gte('updated_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
    ),
    softFirst<{ updated_at: string }>(
      supabase.from('traficos')
        .select('updated_at')
        .eq('company_id', companyId)
        .not('pedimento', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
    ),
    fetchClientMensajeriaFeed(supabase, companyId, 10),
  ])

  const companyName = companyRow?.name ?? ''

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
    },
  })

  const traficosActivosSeries = bucketDailySeries(traficosActivosSeriesRows as Array<Record<string, unknown>>, 'updated_at', 14, now)
  const pedimentosListosSeries = bucketDailySeries(pedimentosListosSeriesRows as Array<Record<string, unknown>>, 'updated_at', 14, now)
  const expedientesSeries = bucketDailySeries(expedientesSeriesRows as Array<Record<string, unknown>>, 'created_at', 14, now)
  const entradasSeries = bucketDailySeries(entradasSeriesRows as Array<Record<string, unknown>>, 'fecha_llegada_mercancia', 14, now)
  const clasificacionesSeries = bucketDailySeries(clasificacionesSeriesRows as Array<Record<string, unknown>>, 'fraccion_classified_at', 14, now)
  const cruzadosMesSeries = bucketDailySeries(cruzadosMesSeriesRows as Array<Record<string, unknown>>, 'updated_at', 14, now)

  // Secondary-signal derivations (all numeric — safe even if queries returned 0s)
  const daysSinceLastPedimento = lastPedimento?.updated_at
    ? Math.floor((Date.now() - new Date(lastPedimento.updated_at).getTime()) / 86400000)
    : null

  const heroKPIs: CockpitHeroKPI[] = [
    { key: 'traficos',   label: 'Tráficos activos',     value: activeTraficos.length, series: traficosActivosSeries, href: '/traficos',            tone: 'silver' },
    { key: 'entradas',   label: 'Entradas esta semana', value: entradasSemanaCount,   series: entradasSeries,         href: '/entradas',            tone: 'silver' },
    { key: 'pedimentos', label: 'Pedimentos listos',    value: pedimentosListosCount, series: pedimentosListosSeries, href: '/pedimentos',          tone: 'silver' },
    { key: 'cruces',     label: 'Cruces este mes',      value: cruzadosMesCount,      series: cruzadosMesSeries,      href: '/traficos?estatus=Cruzado', tone: 'silver' },
  ]

  const navCounts: NavCounts = {
    traficos: {
      count: activeTraficos.length,
      series: traficosActivosSeries,
      microStatus: `${cruzados7dCount} cruzaron esta semana`,
    },
    pedimentos: {
      count: pedimentosMonthCount,
      series: pedimentosListosSeries,
      microStatus: daysSinceLastPedimento != null
        ? `Último hace ${daysSinceLastPedimento} día${daysSinceLastPedimento === 1 ? '' : 's'}`
        : 'Sin pedimentos recientes',
    },
    expedientes: {
      count: expedientesCount,
      series: expedientesSeries,
      microStatus: `${documentos.length} documento${documentos.length === 1 ? '' : 's'} en tu expediente`,
    },
    catalogo: {
      count: catalogoCount,
      series: [],
      microStatus: '—',
    },
    entradas: {
      count: entradasSemanaCount,
      series: entradasSeries,
      microStatus: `${entradasSemanaCount} recibida${entradasSemanaCount === 1 ? '' : 's'} esta semana`,
    },
    clasificaciones: {
      count: clasificacionesCount,
      series: clasificacionesSeries,
      microStatus: `${clasificacionesCount} fracciones clasificadas`,
    },
  }

  const estadoSections = (
    <ClienteEstado
      activeTraficos={activeTraficos}
      documentos={documentos}
    />
  )

  const summaryLine = activeTraficos.length > 0
    ? `${activeTraficos.length} tráfico${activeTraficos.length === 1 ? '' : 's'} en movimiento. Tu patente, en tiempo real.`
    : 'Sin tráficos activos. Tus próximas operaciones aparecerán aquí.'

  // Mensajería feed for client — feature-flagged.
  const mensajeriaEnabled = mensajeriaClientEnabled()
  const actividadSlot = (
    <MensajeriaFeed
      messages={mensajeriaEnabled ? mensajeriaMessages : []}
      realtime={mensajeriaEnabled}
      companyId={companyId}
      emptyLabel="Tu operación está en calma · Todo en orden"
      placeholder={mensajeriaEnabled ? undefined : 'Mensajería próximamente'}
      max={10}
    />
  )

  // Empty-pct fallback — expedientes percentage: total docs vs tráficos ratio.
  const expPct = activeTraficos.length > 0
    ? Math.min(100, Math.round((documentos.length / Math.max(activeTraficos.length * 3, 1)) * 100))
    : 0

  return (
    <CockpitInicio
      role="client"
      name={companyName || 'Tu portal'}
      companyName={companyName || 'Tu portal'}
      heroKPIs={heroKPIs}
      navCounts={navCounts}
      estadoSections={estadoSections}
      actividadSlot={actividadSlot}
      summaryLine={summaryLine}
      pulseSignal={activeTraficos.length > 0}
      metaPills={[
        { label: 'Activos', value: activeTraficos.length },
        { label: 'Semana', value: entradasSemanaCount },
        { label: 'Completos', value: `${expPct}%` },
        { label: 'Mes', value: pedimentosMonthCount },
      ]}
    />
  )
}
