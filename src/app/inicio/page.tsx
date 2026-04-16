// CRUZ · /inicio — cliente cockpit (v9.3 — defensive).
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
import { CockpitErrorCard, CockpitSkeleton, type CockpitHeroKPI, type ActividadStripItem } from '@/components/aguila'
import { InicioClientShell } from './InicioClientShell'
import type { ActiveShipment } from '@/components/cockpit/client/ActiveShipmentTimeline'
import { buildClientHeroTiles } from '@/lib/cockpit/quiet-season'
import { fetchClientMensajeriaFeed, mensajeriaClientEnabled } from '@/lib/mensajeria/feed'
import { parseMonthParam } from '@/lib/cockpit/month-window'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'
import type { CapabilityCounts } from '@/lib/cockpit/capabilities'
import { withHardTimeout } from '@/lib/timeouts'

/** Aggregate-query timeout wrapper — returns caller-supplied fallback
 *  on timeout or error. Used inside Promise.all for data that can
 *  degrade gracefully (hero numbers, activity feeds). Session-validity
 *  gates use the shared `withHardTimeout` from @/lib/timeouts which
 *  returns null on timeout so the caller can redirect cleanly. */
function withFallbackTimeout<T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
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
    // Next.js signals redirects by throwing. Depending on version /
    // minifier, the marker shows up as either:
    //   · err.digest starting with "NEXT_REDIRECT" / equal to "NEXT_NOT_FOUND"
    //   · err.message equal to "NEXT_REDIRECT" / "NEXT_NOT_FOUND"
    // Either way, re-throw so Next's page handler actually redirects.
    // Otherwise the user sees the error card with the word "NEXT_REDIRECT"
    // in it (this is the prod bug surfaced by the Block 1 dry-run).
    const msg = err instanceof Error ? err.message : String(err)
    const digest = typeof err === 'object' && err !== null && 'digest' in err
      ? String((err as { digest?: unknown }).digest ?? '')
      : ''
    if (
      digest.startsWith('NEXT_REDIRECT')
      || digest === 'NEXT_NOT_FOUND'
      || msg === 'NEXT_REDIRECT'
      || msg === 'NEXT_NOT_FOUND'
    ) {
      throw err
    }
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

  // Session-validity gate — own 8 s budget, separate from the cockpit
  // aggregate queries below. Pre-2026-04-18 this query shared the
  // Promise.all's 3 s softFirst budget and intermittently timed out on
  // serverless cold start, triggering a false `redirect('/login?stale=1')`
  // that landed Ursula on the login screen instead of her cockpit. Cold
  // start hardening per Block 1.
  type CompanyRow = { name: string | null; clave_cliente?: string | null }
  const companyRowResult = await withHardTimeout<{ data: CompanyRow[] | null }>(
    Promise.resolve(
      supabase.from('companies').select('name, clave_cliente').eq('company_id', companyId).limit(1)
    ) as unknown as Promise<{ data: CompanyRow[] | null }>,
    8000,
    'companyRow',
  )
  const companyRow: CompanyRow | null = companyRowResult?.data?.[0] ?? null
  if (!companyRow) {
    // Genuine session-invalidation (companyId not in table) OR 8 s
    // timeout exceeded. Both warrant a clean re-authentication.
    redirect('/login?stale=1')
  }

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
    activeTraficosCount,
    pedimentosListosCount,
    cruzadosMesCount,
    cruzadosLast7Count,
    entradasSemanaCount,
    expedientesCount,
    expedientesMesCount,
    catalogoCount,
    catalogoMesCount,
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
    withFallbackTimeout(getClienteActiveTraficos(supabase, companyId), 3500, []),
    withFallbackTimeout(getClienteDocuments(supabase, companyId), 3500, []),
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
    softCount(supabase.from('expediente_documentos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('uploaded_at', monthStartIso)),
    softCount(supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId)),
    softCount(supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('fraccion_classified_at', monthStartIso)),
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
    withFallbackTimeout(fetchClientMensajeriaFeed(supabase, companyId, 10), 3000, []),
    withFallbackTimeout(getClienteActivity(supabase, companyId, 12), 3000, []),
  ])

  // Stale-session self-heal: if the session encodes a companyId that no
  // companyRow invariant: validated + redirect handled in the
  // dedicated 8 s gate above. After this point it's guaranteed non-null.
  const companyName = companyRow.name ?? ''

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

  // heroKPIs assembled below — requires imminentShipment and lastCruzadoRow
  // which are fetched a few lines down. Declaration hoisted there.

  // Nav-card microcopy ranks after 1.3 demotion:
  //   Headline (huge): this-month count  (rendered by SmartNavCard.count)
  //   Subtitle:        contextual description (from UNIFIED_NAV_TILES — static)
  //   microStatus:     "this month · last action" — THE LIVE signal
  //   historicMicrocopy (tiny, muted): "(+214K en histórico)" — the lifetime total
  // Before 1.3, lifetime totals were inside microStatus and read as the primary
  // number. Now they're explicitly a footnote.
  function compactK(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`
    return n.toLocaleString('es-MX')
  }

  // Catálogo sad-zero logic split from the historical-footnote logic so the
  // microStatus is a live signal and the lifetime total sits in the microcopy.
  const catalogoMicroStatus = catalogoMesCount > 0
    ? `${catalogoMesCount.toLocaleString('es-MX')} clasificada${catalogoMesCount === 1 ? '' : 's'} este mes`
    : catalogoCount > 0
      ? 'Catálogo disponible — sin movimiento este mes'
      : 'Tu catálogo aparecerá cuando clasifiquemos tus productos'
  const catalogoHistoricMicrocopy = catalogoCount > 0
    ? `(+${compactK(catalogoCount)} en catálogo)`
    : undefined

  const expedientesMicroStatus = expedientesMesCount > 0
    ? `${expedientesMesCount.toLocaleString('es-MX')} documento${expedientesMesCount === 1 ? '' : 's'} este mes`
    : 'Sin documentos nuevos este mes'
  const expedientesHistoricMicrocopy = expedientesCount > 0
    ? `(+${compactK(expedientesCount)} en histórico)`
    : undefined

  const navCounts: NavCounts = {
    traficos:        { count: activeTraficosCount,    series: activosSeries,          microStatus: `${cruzadosLast7Count} cruzaron esta semana` },
    pedimentos:      { count: pedimentosListosCount,  series: pedimentosListosSeries, microStatus: daysSinceLastCruce != null ? `Último cruce hace ${daysSinceLastCruce} día${daysSinceLastCruce === 1 ? '' : 's'}` : 'Sin cruces recientes' },
    expedientes:     { count: expedientesMesCount,    series: expedientesSeries,      microStatus: expedientesMicroStatus, historicMicrocopy: expedientesHistoricMicrocopy },
    catalogo:        { count: catalogoMesCount,       series: [],                     microStatus: catalogoMicroStatus,    historicMicrocopy: catalogoHistoricMicrocopy },
    entradas:        { count: entradasSemanaCount,    series: entradasSeries,         microStatus: `${entradasSemanaCount} recibida${entradasSemanaCount === 1 ? '' : 's'} esta semana` },
    reportes:        { count: null,                   series: clasificacionesSeries },
  }
  // Sad-zero replacement on the Pedimentos nav card happens AFTER
  // heroBuild is computed — see below, once lastPedimentoIso is known.

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

  // Most-imminent tráfico for the "Próximo cruce" hero KPI + modal. Uses
  // actual estatus values (Cruzado/E1 are terminal; Pedimento Pagado +
  // En Proceso are in-flight). Sorted by fecha_llegada ascending → earliest
  // upcoming arrival first.
  const { data: imminentRow } = await supabase
    .from('traficos')
    .select('trafico, estatus, fecha_llegada, pedimento')
    .eq('company_id', companyId)
    .not('estatus', 'in', '("Cruzado","E1","Entregado","Cancelado")')
    .order('fecha_llegada', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const imminentShipment: ActiveShipment | null = imminentRow
    ? {
        trafico: String((imminentRow as { trafico: string }).trafico),
        estatus: (imminentRow as { estatus: string | null }).estatus ?? null,
        fechaLlegada: (imminentRow as { fecha_llegada: string | null }).fecha_llegada ?? null,
        pedimento: (imminentRow as { pedimento: string | null }).pedimento ?? null,
      }
    : null

  // Format helper for the Próximo/Último cruce date — es-MX short form,
  // Laredo timezone. JetBrains Mono is applied by KPITile's number slot.
  function formatCruceDate(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('es-MX', {
      timeZone: 'America/Chicago',
      day: '2-digit',
      month: 'short',
    })
  }

  // heroKPIs[0] is dynamic: "Próximo cruce · [fecha]" when there is an
  // active embarque (InicioClientShell wires the onClick → TimelineModal),
  // else "Último cruce · [fecha]" static (no onClick → not tappable).
  const firstKPI: CockpitHeroKPI = {
    key: 'proximo-cruce',
    label: imminentShipment ? 'Próximo cruce' : 'Último cruce',
    value: imminentShipment
      ? formatCruceDate(imminentShipment.fechaLlegada)
      : formatCruceDate(lastCruzadoRow ? (lastCruzadoRow as { fecha_cruce: string | null }).fecha_cruce ?? null : null),
    series: activosSeries,
    tone: 'silver',
    ariaLabel: imminentShipment ? 'Ver línea de tiempo del próximo embarque' : undefined,
  }

  const standardHeroKPIs: CockpitHeroKPI[] = [
    firstKPI,
    { key: 'entradas',   label: 'Entradas esta semana', value: entradasSemanaCount,    series: entradasSeries,         href: '/entradas',                 tone: 'silver' },
    { key: 'pedimentos', label: 'Pedimentos listos',    value: pedimentosListosCount,  series: pedimentosListosSeries, href: '/pedimentos',               tone: 'silver' },
    { key: 'cruces',     label: 'Cruces este mes',      value: cruzadosMesCount,       series: crucesSeries,           href: '/embarques?estatus=Cruzado', tone: 'silver' },
  ]

  // ── Quiet-season support data (only computed when no active embarques) ──
  // Prevents an empty-looking cockpit during seasonal lulls (invariant #24 —
  // the client surface should feel calm and confident, not sad).
  const activeCount = activeTraficos.length
  let daysSinceLastIncident = 30
  let tmecYtdUsd: number | null = null
  let lastPedimentoIso: string | null = null
  if (activeCount === 0) {
    // Most-recent tráfico with a non-happy terminal state (rejected/detained
    // proxies via estatus codes). soft-wrap all queries — nothing here is
    // load-bearing; on failure the UI simply shows the 30-day cap.
    try {
      const { data: lastIncident } = await supabase
        .from('traficos')
        .select('updated_at')
        .eq('company_id', companyId)
        .in('estatus', ['E2', 'E3', 'Rechazado', 'Detenido'])
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      if (lastIncident?.updated_at) {
        const days = Math.floor((Date.now() - new Date(lastIncident.updated_at as string).getTime()) / 86_400_000)
        daysSinceLastIncident = Math.max(0, Math.min(days, 365))
      }
    } catch { /* soft — keep default 30 */ }

    // T-MEC YTD savings — uses the same source as /ahorro
    // (src/app/api/cost-insights/route.ts: operations_savings table).
    // Soft-wrap so a schema drift / missing table drops the tile gracefully.
    try {
      const yearPrefix = String(new Date().getFullYear()) // e.g. "2026"
      // Fetch the most-recent 24 rows; filter client-side to rows whose
      // `month` string starts with the current year. Handles both
      // "2026-04" and "2026-04-01" month formats without depending on
      // a specific collation.
      const { data: savingsRows } = await supabase
        .from('operations_savings')
        .select('month, realized_savings_usd')
        .eq('company_id', companyId)
        .order('month', { ascending: false })
        .limit(24)
      if (savingsRows && savingsRows.length > 0) {
        const ytdRows = (savingsRows as Array<{ month: string | null; realized_savings_usd: number | null }>)
          .filter(r => typeof r.month === 'string' && r.month.startsWith(yearPrefix))
        if (ytdRows.length > 0) {
          tmecYtdUsd = ytdRows.reduce((acc, r) => acc + (r.realized_savings_usd ?? 0), 0)
        } else {
          tmecYtdUsd = 0 // table exists, no rows this year → explicit zero → tile drops
        }
      }
    } catch { /* soft — leave null so the tile is dropped per spec */ }

    // Most-recent pedimento date for the nav-card sad-zero swap.
    try {
      const { data: lastPed } = await supabase
        .from('pedimentos')
        .select('fecha_pago, created_at')
        .eq('company_id', companyId)
        .order('fecha_pago', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      const iso = (lastPed as { fecha_pago: string | null; created_at: string | null } | null)
      lastPedimentoIso = iso?.fecha_pago ?? iso?.created_at ?? null
    } catch { /* soft — override just won't fire */ }
  }

  const heroBuild = buildClientHeroTiles({
    activeCount,
    standardTiles: standardHeroKPIs,
    daysSinceLastIncident,
    lastCruceIso: (lastCruzadoRow as { fecha_cruce: string | null } | null)?.fecha_cruce ?? null,
    crucesThisMonth: cruzadosMesCount,
    tmecYtdUsd,
    lastPedimentoIso,
    pedimentosMonthCount: pedimentosListosCount,
  })
  const heroKPIs: CockpitHeroKPI[] = heroBuild.heroKPIs

  // Sad-zero replacement on the Pedimentos nav card (quiet-season only).
  // Requires navCounts.pedimentos to already exist (defined earlier).
  if (heroBuild.pedimentoMicroStatusOverride && navCounts.pedimentos) {
    navCounts.pedimentos = {
      count: navCounts.pedimentos.count,
      series: navCounts.pedimentos.series,
      microStatus: heroBuild.pedimentoMicroStatusOverride,
    }
  }

  function daysAgoLabel(iso: string | null): string {
    if (!iso) return '—'
    const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
    if (days === 0) return 'hoy'
    if (days === 1) return 'hace 1 día'
    return `hace ${days} días`
  }

  // When quiet-season is active, the builder emits the reassuring prose
  // line — override the standard computed summary with it. Otherwise keep
  // the existing behavior (N embarques / Último embarque · ref / default).
  // Morning briefing — soft-wrapped; if the `client_briefings` table
  // doesn't exist yet (pre-migration) the query silently returns null
  // and the component renders nothing. Zero load-bearing failure mode.
  type BriefingRow = {
    id: string
    briefing_text: string
    action_item: string | null
    action_url: string | null
  }
  let morningBriefing: BriefingRow | null = null
  try {
    const { data: briefingData } = await supabase
      .from('client_briefings')
      .select('id, briefing_text, action_item, action_url')
      .eq('company_id', companyId)
      .is('dismissed_at', null)
      .gt('generated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    morningBriefing = briefingData as BriefingRow | null
  } catch { /* table missing or RLS denied — briefing feature dormant */ }

  const computedSummary = activeTraficos.length > 0
    ? `${activeTraficos.length} embarque${activeTraficos.length === 1 ? '' : 's'} en tránsito · Patente en movimiento`
    : lastCruzadoRow
      ? `Último embarque · ${(lastCruzadoRow as { trafico: string }).trafico} · cruzó ${daysAgoLabel((lastCruzadoRow as { fecha_cruce: string | null }).fecha_cruce ?? (lastCruzadoRow as { updated_at: string | null }).updated_at)}`
      : 'Sin embarques activos. Tus próximas operaciones aparecerán aquí.'
  const summaryLine = heroBuild.summaryLine ?? computedSummary

  // Pulse the status dot when work is in motion (≥1 active embarque).
  // Solid dot = calm. Real-time subscription on traficos lives inside
  // CockpitInicio via CockpitBanner; this flag drives the CSS pulse.
  const pulseSignal = activeTraficos.length > 0

  const mensajeriaEnabled = mensajeriaClientEnabled()

  const expPct = activeTraficos.length > 0
    ? Math.min(100, Math.round((documentos.length / Math.max(activeTraficos.length * 3, 1)) * 100))
    : 0

  // v10 — ActividadStrip: client sees Mensajería messages as chips at the top.
  // Items are primitive-serializable so they cross to InicioClientShell cleanly.
  const actividadStripItems: ActividadStripItem[] = (mensajeriaEnabled ? mensajeriaMessages : []).slice(0, 10).map((m) => ({
    id: m.id,
    label: m.sender_display_name ?? 'Renato Zapata & Company',
    detail: m.body.length > 60 ? `${m.body.slice(0, 57)}…` : m.body,
    timestamp: m.created_at,
    href: `/mensajes`,
    tone: 'silver',
  }))

  // Capability cards — empty counts today; shell builds the grid client-side.
  const capabilityCounts: CapabilityCounts = {}

  // CRUCES 7D meta pill removed 2026-04-16 — it duplicated the hero
  // "Cruces este mes" / quiet-season "Volumen del mes" tile and added
  // header noise. ACTIVOS + ÚLT. CRUCE remain because they pair with
  // the dynamic first-KPI ("Próximo cruce" / "Último cruce").
  const clientMetaPills: Array<{ label: string; value: string | number; tone?: 'silver' | 'warning' }> = [
    { label: 'ACTIVOS', value: activeTraficosCount, tone: 'silver' },
    ...(daysSinceLastCruce != null
      ? [{ label: 'ÚLT. CRUCE', value: daysSinceLastCruce === 0 ? 'hoy' : `hace ${daysSinceLastCruce}d`, tone: 'silver' as const }]
      : []),
  ]

  return (
    <InicioClientShell
      role="client"
      name={companyName || 'Tu portal'}
      companyName={companyName || 'Tu portal'}
      heroKPIs={heroKPIs}
      navCounts={navCounts}
      actividadStripItems={actividadStripItems}
      capabilityCounts={capabilityCounts}
      summaryLine={summaryLine}
      pulseSignal={pulseSignal}
      month={month}
      metaPills={clientMetaPills}
      imminentShipment={imminentShipment}
      morningBriefing={morningBriefing ? {
        ...morningBriefing,
        greeting_name: (companyName || 'Tu portal').split(' ')[0] || 'Equipo',
      } : null}
    />
  )
}
