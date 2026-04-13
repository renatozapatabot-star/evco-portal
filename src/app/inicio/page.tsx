// AGUILA · /inicio — cliente cockpit (v9.3 — defensive).
//
// Every query soft-wrapped. Whole render wrapped in try/catch so even a
// catastrophic failure shows the glass error card instead of a blank page.
// Invariant 24 preserved (no delta/severity). NEXT_PUBLIC_MENSAJERIA_CLIENT
// feature flag respected.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import {
  getClienteActiveTraficos,
  getClienteDocuments,
} from '@/lib/cliente/dashboard'
import { getClienteActivity } from '@/lib/cliente/activity'
import { bucketDailySeries, daysAgo } from '@/lib/cockpit/fetch'
import { softCount, softData, softFirst } from '@/lib/cockpit/safe-query'
import { CockpitInicio, MensajeriaFeed, CockpitErrorCard, CockpitSkeleton, ActividadStrip, CapabilityCardGrid, TimelineFeed, type CockpitHeroKPI, type ActividadStripItem } from '@/components/aguila'
import { ClienteEstado } from '@/components/cliente/ClienteEstado'
import { fetchClientMensajeriaFeed, mensajeriaClientEnabled } from '@/lib/mensajeria/feed'
import { parseMonthParam } from '@/lib/cockpit/month-window'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'
import type { CapabilityCounts } from '@/lib/cockpit/capabilities'

/** Wrap any Promise with a hard timeout so SSR can never exceed Vercel function limits. */
function withHardTimeout<T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(p).catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InicioPage({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (session.role !== 'client') redirect('/')

  const sp = (await searchParams) ?? {}
  const month = parseMonthParam(sp.month).ym

  // Stream skeleton immediately while data fetches; CockpitContent streams in.
  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <CockpitContent session={session} cookieStore={cookieStore} month={month} />
    </Suspense>
  )
}

async function CockpitContent({ session, cookieStore, month }: { session: SessionLike; cookieStore: CookieJar; month: string }) {
  try {
    return await renderClientCockpit(session, cookieStore, month)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return <CockpitErrorCard message={`No se pudo cargar el cockpit: ${msg}`} />
  }
}

type SessionLike = { companyId: string; role: string }
type CookieJar = Awaited<ReturnType<typeof cookies>>

async function renderClientCockpit(session: SessionLike, cookieStore: CookieJar, month: string) {
  const supabase = createServerClient()
  const companyId = session.companyId
  const now = new Date()
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
    clienteActivity,
  ] = await Promise.all([
    withHardTimeout(getClienteActiveTraficos(supabase, companyId), 3500, []),
    withHardTimeout(getClienteDocuments(supabase, companyId), 3500, []),
    softFirst<{ name: string | null; clave_cliente?: string | null }>(
      supabase.from('companies').select('name, clave_cliente').eq('company_id', companyId).limit(1)
    ),
    softData<{ updated_at: string }>(
      supabase.from('traficos').select('updated_at').eq('company_id', companyId).eq('estatus', 'En Proceso').gte('updated_at', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{ updated_at: string }>(
      supabase.from('traficos').select('updated_at').eq('company_id', companyId).not('pedimento', 'is', null).gte('updated_at', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{ uploaded_at: string }>(
      supabase.from('expediente_documentos').select('uploaded_at').eq('company_id', companyId).gte('uploaded_at', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{ fecha_llegada_mercancia: string }>(
      supabase.from('entradas').select('fecha_llegada_mercancia').eq('company_id', companyId).gte('fecha_llegada_mercancia', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{ fraccion_classified_at: string }>(
      supabase.from('globalpc_productos').select('fraccion_classified_at').eq('company_id', companyId).not('fraccion_classified_at', 'is', null).gte('fraccion_classified_at', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{ updated_at: string }>(
      supabase.from('traficos').select('updated_at').eq('company_id', companyId).eq('estatus', 'Cruzado').gte('updated_at', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(supabase.from('traficos').select('trafico', { count: 'exact', head: true }).eq('company_id', companyId).eq('estatus', 'Cruzado').gte('updated_at', thirtyDaysAgoIso)),
    softCount(supabase.from('entradas').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('fecha_llegada_mercancia', sevenDaysAgoIso)),
    softCount(supabase.from('traficos').select('trafico', { count: 'exact', head: true }).eq('company_id', companyId).not('pedimento', 'is', null)),
    softCount(supabase.from('expediente_documentos').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
    softCount(supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
    softCount(supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('fraccion', 'is', null)),
    softCount(supabase.from('traficos').select('trafico', { count: 'exact', head: true }).eq('company_id', companyId).eq('estatus', 'Cruzado').gte('updated_at', sevenDaysAgoIso)),
    softCount(supabase.from('traficos').select('trafico', { count: 'exact', head: true }).eq('company_id', companyId).not('pedimento', 'is', null).gte('updated_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())),
    softFirst<{ updated_at: string }>(supabase.from('traficos').select('updated_at').eq('company_id', companyId).not('pedimento', 'is', null).order('updated_at', { ascending: false }).limit(1)),
    withHardTimeout(fetchClientMensajeriaFeed(supabase, companyId, 10), 3000, []),
    withHardTimeout(getClienteActivity(supabase, companyId, 12), 3000, []),
  ])

  const companyName = companyRow?.name ?? ''

  // Telemetry (fire-and-forget, guarded)
  try {
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
  } catch { /* telemetry should never crash the page */ }

  const traficosActivosSeries  = bucketDailySeries(traficosActivosSeriesRows as Array<Record<string, unknown>>, 'updated_at', 14, now)
  const pedimentosListosSeries = bucketDailySeries(pedimentosListosSeriesRows as Array<Record<string, unknown>>, 'updated_at', 14, now)
  const expedientesSeries      = bucketDailySeries(expedientesSeriesRows as Array<Record<string, unknown>>, 'uploaded_at', 14, now)
  const entradasSeries         = bucketDailySeries(entradasSeriesRows as Array<Record<string, unknown>>, 'fecha_llegada_mercancia', 14, now)
  const clasificacionesSeries  = bucketDailySeries(clasificacionesSeriesRows as Array<Record<string, unknown>>, 'fraccion_classified_at', 14, now)
  const cruzadosMesSeries      = bucketDailySeries(cruzadosMesSeriesRows as Array<Record<string, unknown>>, 'updated_at', 14, now)

  const daysSinceLastPedimento = lastPedimento?.updated_at
    ? Math.floor((Date.now() - new Date(lastPedimento.updated_at).getTime()) / 86400000)
    : null

  const heroKPIs: CockpitHeroKPI[] = [
    { key: 'traficos',   label: 'Embarques activos',     value: activeTraficos.length, series: traficosActivosSeries, href: '/embarques',                 tone: 'silver' },
    { key: 'entradas',   label: 'Entradas esta semana', value: entradasSemanaCount,   series: entradasSeries,         href: '/entradas',                 tone: 'silver' },
    { key: 'pedimentos', label: 'Pedimentos listos',    value: pedimentosListosCount, series: pedimentosListosSeries, href: '/pedimentos',               tone: 'silver' },
    { key: 'cruces',     label: 'Cruces este mes',      value: cruzadosMesCount,      series: cruzadosMesSeries,      href: '/embarques?estatus=Cruzado', tone: 'silver' },
  ]

  const navCounts: NavCounts = {
    traficos:        { count: activeTraficos.length,  series: traficosActivosSeries,  microStatus: `${cruzados7dCount} cruzaron esta semana` },
    pedimentos:      { count: pedimentosMonthCount,   series: pedimentosListosSeries, microStatus: daysSinceLastPedimento != null ? `Último hace ${daysSinceLastPedimento} día${daysSinceLastPedimento === 1 ? '' : 's'}` : 'Sin pedimentos recientes' },
    expedientes:     { count: expedientesCount,       series: expedientesSeries,      microStatus: `${documentos.length} documento${documentos.length === 1 ? '' : 's'} en tu expediente` },
    catalogo:        { count: catalogoCount,          series: [],                     microStatus: '—' },
    entradas:        { count: entradasSemanaCount,    series: entradasSeries,         microStatus: `${entradasSemanaCount} recibida${entradasSemanaCount === 1 ? '' : 's'} esta semana` },
    clasificaciones: { count: clasificacionesCount,   series: clasificacionesSeries,  microStatus: `${clasificacionesCount} fracciones clasificadas` },
  }

  const estadoSections = (
    <ClienteEstado activeTraficos={activeTraficos} documentos={documentos} />
  )

  const summaryLine = activeTraficos.length > 0
    ? `${activeTraficos.length} embarque${activeTraficos.length === 1 ? '' : 's'} en movimiento. Tu patente, en tiempo real.`
    : 'Sin embarques activos. Tus próximas operaciones aparecerán aquí.'

  const mensajeriaEnabled = mensajeriaClientEnabled()
  const activityHasContent = clienteActivity.length > 0
  const mensajeriaHasContent = mensajeriaEnabled && mensajeriaMessages.length > 0

  const actividadSlot = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {(activityHasContent || !mensajeriaHasContent) && (
        <TimelineFeed
          items={clienteActivity}
          max={10}
          emptyLabel="Tu operación está en calma · Todo en orden"
        />
      )}
      {mensajeriaEnabled ? (
        mensajeriaHasContent ? (
          <MensajeriaFeed
            messages={mensajeriaMessages}
            realtime={false}
            companyId={companyId}
            emptyLabel=""
            max={10}
          />
        ) : null
      ) : (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          Mensajería próximamente
        </div>
      )}
    </div>
  )

  const expPct = activeTraficos.length > 0
    ? Math.min(100, Math.round((documentos.length / Math.max(activeTraficos.length * 3, 1)) * 100))
    : 0

  // v10 — ActividadStrip: client sees Mensajería messages as chips at the top.
  const actividadStripItems: ActividadStripItem[] = (mensajeriaEnabled ? mensajeriaMessages : []).slice(0, 10).map((m) => ({
    id: m.id,
    label: m.sender_display_name ?? 'Renato Zapata & Company',
    detail: m.body.length > 60 ? `${m.body.slice(0, 57)}…` : m.body,
    timestamp: m.created_at,
    href: `/mensajes`,
    tone: 'silver',
  }))
  const actividadStripSlot = (
    <ActividadStrip
      items={actividadStripItems}
      emptyLabel="Tu operación está en calma · Todo en orden"
      title="Últimos mensajes"
    />
  )

  // v10 — Capability cards: Checklist, Clasificador, Mensajes (client scope).
  const capabilityCounts: CapabilityCounts = {
    checklist:    { count: Math.max(0, activeTraficos.length * 3 - documentos.length), microStatus: '61 tipos · auto-validado' },
    clasificador: { count: clasificacionesCount, countSuffix: '', microStatus: 'Sube · auto-clasifica · TIGIE' },
    mensajes:     { count: mensajeriaMessages.length, microStatus: mensajeriaMessages.length > 0 ? 'sin leer' : '@ menciona a tu equipo' },
  }
  const capabilitySlot = <CapabilityCardGrid counts={capabilityCounts} />

  return (
    <CockpitInicio
      role="client"
      name={companyName || 'Tu portal'}
      companyName={companyName || 'Tu portal'}
      heroKPIs={heroKPIs}
      navCounts={navCounts}
      estadoSections={estadoSections}
      actividadSlot={actividadSlot}
      actividadStripSlot={actividadStripSlot}
      capabilitySlot={capabilitySlot}
      summaryLine={summaryLine}
      pulseSignal={activeTraficos.length > 0}
      month={month}
    />
  )
}
