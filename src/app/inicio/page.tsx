// ZAPATA AI · /inicio — cliente cockpit (v9.3 — defensive).
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
import { AsistenteButton } from '@/components/aguila/AsistenteButton'
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
  const ninetyDaysAgoIso = daysAgo(90, now).toISOString()
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // KPI accuracy contract (added 2026-04-15 after audit):
  //   - "Embarques activos"  → fecha_cruce IS NULL AND fecha_llegada >= last 90d
  //   - "Entradas esta semana" → entradas.fecha_llegada_mercancia >= last 7d
  //   - "Pedimentos listos"  → pedimento set AND fecha_cruce IS NULL
  //   - "Cruces este mes"    → fecha_cruce >= start-of-current-month
  // NEVER use updated_at for time-window KPIs — sync touches every row,
  // making "this month" mean "everything that was synced this month".
  const [
    activeTraficos,
    documentos,
    companyRow,
    activeTraficosCount,
    pedimentosListosCount,
    cruzadosMesCount,
    cruzadosLast7Count,
    entradasSemanaCount,
    expedientesCount,
    catalogoCount,
    clasificacionesCount,
    activosSeriesRows,
    pedimentosListosSeriesRows,
    expedientesSeriesRows,
    entradasSeriesRows,
    clasificacionesSeriesRows,
    crucesSeriesRows,
    lastCruce,
    mensajeriaMessages,
    clienteActivity,
  ] = await Promise.all([
    withHardTimeout(getClienteActiveTraficos(supabase, companyId), 3500, []),
    withHardTimeout(getClienteDocuments(supabase, companyId), 3500, []),
    softFirst<{ name: string | null; clave_cliente?: string | null }>(
      supabase.from('companies').select('name, clave_cliente').eq('company_id', companyId).limit(1)
    ),
    // Embarques activos: not crossed yet, with recent arrival activity (90d window).
    softCount(supabase.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('fecha_cruce', null).gte('fecha_llegada', ninetyDaysAgoIso)),
    // Pedimentos listos: estatus=Pedimento Pagado, awaiting actual cruce,
    // with recency filter (90d) to exclude historical ghosts where the sync
    // never populated fecha_cruce. Without recency, EVCO has 900 hits but
    // only 18 represent real "waiting to cross right now."
    softCount(supabase.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('estatus', 'Pedimento Pagado').is('fecha_cruce', null).gte('fecha_llegada', ninetyDaysAgoIso)),
    // Cruces este mes: real fecha_cruce >= start-of-month.
    softCount(supabase.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('fecha_cruce', monthStartIso)),
    // Cruces last 7d for nav microStatus.
    softCount(supabase.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('fecha_cruce', sevenDaysAgoIso)),
    // Entradas esta semana — entradas.fecha_llegada_mercancia is the truth source.
    softCount(supabase.from('entradas').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('fecha_llegada_mercancia', sevenDaysAgoIso)),
    softCount(supabase.from('expediente_documentos').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
    softCount(supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
    softCount(supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('fraccion', 'is', null)),
    // Sparkline series — bucket by the SAME field the headline KPI uses.
    softData<{ fecha_llegada: string }>(
      supabase.from('traficos').select('fecha_llegada').eq('company_id', companyId).is('fecha_cruce', null).gte('fecha_llegada', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{ fecha_llegada: string }>(
      // Pedimentos-listos sparkline = arrivals trend among Pagado-but-pending-cruce embarques.
      supabase.from('traficos').select('fecha_llegada').eq('company_id', companyId).eq('estatus', 'Pedimento Pagado').is('fecha_cruce', null).gte('fecha_llegada', fourteenDaysAgoIso).limit(2000)
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
    softData<{ fecha_cruce: string }>(
      supabase.from('traficos').select('fecha_cruce').eq('company_id', companyId).gte('fecha_cruce', fourteenDaysAgoIso).limit(2000)
    ),
    softFirst<{ fecha_cruce: string }>(supabase.from('traficos').select('fecha_cruce').eq('company_id', companyId).not('fecha_cruce', 'is', null).order('fecha_cruce', { ascending: false }).limit(1)),
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

  const activosSeries          = bucketDailySeries(activosSeriesRows as Array<Record<string, unknown>>, 'fecha_llegada', 14, now)
  const pedimentosListosSeries = bucketDailySeries(pedimentosListosSeriesRows as Array<Record<string, unknown>>, 'fecha_llegada', 14, now)
  const expedientesSeries      = bucketDailySeries(expedientesSeriesRows as Array<Record<string, unknown>>, 'uploaded_at', 14, now)
  const entradasSeries         = bucketDailySeries(entradasSeriesRows as Array<Record<string, unknown>>, 'fecha_llegada_mercancia', 14, now)
  const clasificacionesSeries  = bucketDailySeries(clasificacionesSeriesRows as Array<Record<string, unknown>>, 'fraccion_classified_at', 14, now)
  const crucesSeries           = bucketDailySeries(crucesSeriesRows as Array<Record<string, unknown>>, 'fecha_cruce', 14, now)

  const daysSinceLastCruce = lastCruce?.fecha_cruce
    ? Math.floor((Date.now() - new Date(lastCruce.fecha_cruce).getTime()) / 86400000)
    : null

  const heroKPIs: CockpitHeroKPI[] = [
    { key: 'traficos',   label: 'Embarques activos',     value: activeTraficosCount,    series: activosSeries,          href: '/embarques',                 tone: 'silver' },
    { key: 'entradas',   label: 'Entradas esta semana', value: entradasSemanaCount,    series: entradasSeries,         href: '/entradas',                 tone: 'silver' },
    { key: 'pedimentos', label: 'Pedimentos listos',    value: pedimentosListosCount,  series: pedimentosListosSeries, href: '/pedimentos',               tone: 'silver' },
    { key: 'cruces',     label: 'Cruces este mes',      value: cruzadosMesCount,       series: crucesSeries,           href: '/embarques?estatus=Cruzado', tone: 'silver' },
  ]

  const navCounts: NavCounts = {
    traficos:        { count: activeTraficosCount,    series: activosSeries,          microStatus: `${cruzadosLast7Count} cruzaron esta semana` },
    pedimentos:      { count: pedimentosListosCount,  series: pedimentosListosSeries, microStatus: daysSinceLastCruce != null ? `Último cruce hace ${daysSinceLastCruce} día${daysSinceLastCruce === 1 ? '' : 's'}` : 'Sin cruces recientes' },
    expedientes:     { count: expedientesCount,       series: expedientesSeries,      microStatus: `${documentos.length} documento${documentos.length === 1 ? '' : 's'} en tu expediente` },
    catalogo:        { count: catalogoCount,          series: [],                     microStatus: clasificacionesCount > 0 ? `${clasificacionesCount.toLocaleString('es-MX')} fracciones clasificadas` : 'Sin clasificar' },
    entradas:        { count: entradasSemanaCount,    series: entradasSeries,         microStatus: `${entradasSemanaCount} recibida${entradasSemanaCount === 1 ? '' : 's'} esta semana` },
    reportes:        { count: null,                   series: clasificacionesSeries },
  }

  const estadoSections = (
    <ClienteEstado activeTraficos={activeTraficos} documentos={documentos} />
  )

  // Dynamic zero-state — when no active tráficos, show the most-recent
  // crossed embarque instead of a blank "nothing happening" line.
  const { data: lastCruzadoRow } = await supabase
    .from('traficos')
    .select('trafico, fecha_cruce, updated_at')
    .eq('company_id', companyId)
    .eq('estatus', 'Cruzado')
    .order('fecha_cruce', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  function daysAgoLabel(iso: string | null): string {
    if (!iso) return '—'
    const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
    if (days === 0) return 'hoy'
    if (days === 1) return 'hace 1 día'
    return `hace ${days} días`
  }

  const summaryLine = activeTraficos.length > 0
    ? `${activeTraficos.length} embarque${activeTraficos.length === 1 ? '' : 's'} en tránsito · Patente en movimiento`
    : lastCruzadoRow
      ? `Último embarque · ${(lastCruzadoRow as { trafico: string }).trafico} · cruzó ${daysAgoLabel((lastCruzadoRow as { fecha_cruce: string | null }).fecha_cruce ?? (lastCruzadoRow as { updated_at: string | null }).updated_at)}`
      : 'Sin embarques activos. Tus próximas operaciones aparecerán aquí.'

  // Pulse the status dot when work is in motion (≥1 active embarque).
  // Solid dot = calm. Real-time subscription on traficos lives inside
  // CockpitInicio via CockpitBanner; this flag drives the CSS pulse.
  const pulseSignal = activeTraficos.length > 0

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
      ) : null}
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
  // V1 fix — microStatus must be DYNAMIC info only; the static `subtitle`
  // already renders once from CAPABILITY_CARDS. Passing the same string as
  // Capability cards moved to LauncherTray (top-nav `+ TOOLS`).
  const capabilityCounts: CapabilityCounts = {}
  const capabilitySlot = <CapabilityCardGrid counts={capabilityCounts} />

  const clientMetaPills: Array<{ label: string; value: string | number; tone?: 'silver' | 'warning' }> = [
    { label: 'ACTIVOS', value: activeTraficosCount, tone: 'silver' },
    { label: 'CRUCES 7D', value: cruzadosLast7Count, tone: 'silver' },
    ...(daysSinceLastCruce != null
      ? [{ label: 'ÚLT. CRUCE', value: daysSinceLastCruce === 0 ? 'hoy' : `hace ${daysSinceLastCruce}d`, tone: 'silver' as const }]
      : []),
  ]

  return (
    <>
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
        pulseSignal={pulseSignal}
        month={month}
        metaPills={clientMetaPills}
      />
      {/* V1 marathon — fixed-position Asistente on every cockpit */}
      <AsistenteButton roleTag="client" />
    </>
  )
}
