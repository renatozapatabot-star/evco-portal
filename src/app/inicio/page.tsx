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
import { softCount, softData, softFirst, createQuerySignals } from '@/lib/cockpit/safe-query'
import { getLatestCrossing } from '@/lib/queries/latest-crossing'
import { getActiveCveProductos } from '@/lib/anexo24/active-parts'
import { CockpitErrorCard, CockpitSkeleton, FreshnessBanner, type CockpitHeroKPI, type ActividadStripItem } from '@/components/aguila'
import { readFreshness } from '@/lib/cockpit/freshness'
import { computeSuccessRate } from '@/lib/cockpit/success-rate'
import { InicioClientShell } from './InicioClientShell'
import type { ActiveShipment } from '@/components/cockpit/client/ActiveShipmentTimeline'
import { buildClientHeroTiles } from '@/lib/cockpit/quiet-season'
import { fetchClientMensajeriaFeed, mensajeriaClientEnabled } from '@/lib/mensajeria/feed'
import { parseMonthParam } from '@/lib/cockpit/month-window'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'
import type { CapabilityCounts } from '@/lib/cockpit/capabilities'
import { withHardTimeout } from '@/lib/timeouts'

/**
 * Humanize technical query labels before surfacing them to Ursula.
 * Chrome audit 2026-04-19 found the partial-data banner leaking
 * raw labels like `expedientes.total · catalogo.mes · catalogo.series`.
 * Ursula should read "tus expedientes y tu catálogo", not a state path.
 */
const LABEL_TO_HUMAN: Record<string, string> = {
  'expedientes.total': 'tus expedientes',
  'expedientes.mes':   'tus expedientes del mes',
  'expedientes.series':'tu historial de expedientes',
  'catalogo.total':    'tu catálogo',
  'catalogo.mes':      'tu catálogo del mes',
  'catalogo.series':   'tu historial del catálogo',
  'catalogo.clasificaciones': 'tus clasificaciones',
  'traficos.activos':  'tus embarques activos',
  'traficos.series':   'tu historial de embarques',
  'pedimentos.total':  'tus pedimentos',
  'entradas.mes':      'tus entradas del mes',
  'entradas.series':   'tu historial de entradas',
  'facturas.mes':      'tus facturas del mes',
}
function humanizeFailedLabels(labels: string[]): string {
  if (labels.length === 0) return 'algunos datos'
  const phrases = labels
    .slice(0, 3)
    .map((l) => LABEL_TO_HUMAN[l] ?? l.split('.')[0])
  const unique = Array.from(new Set(phrases))
  if (unique.length === 1) return unique[0]!
  if (unique.length === 2) return `${unique[0]} y ${unique[1]}`
  return `${unique.slice(0, -1).join(', ')} y ${unique[unique.length - 1]}`
}

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
    return <CockpitErrorCard message={`No se pudo cargar tu panel: ${msg}`} />
  }
}

type SessionLike = { companyId: string; role: string }
type CookieJar = Awaited<ReturnType<typeof cookies>>

async function renderClientCockpit(session: SessionLike, cookieStore: CookieJar, month: string) {
  const supabase = createServerClient()
  const companyId = session.companyId
  // Per-render signal collector — each softCount/softData receives it and
  // records suppressed errors. If ≥ 2 queries fail in this SSR, we render
  // a partial-data banner instead of silent zeros (Phase 1 of v9.4).
  const signals = createQuerySignals()
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
  //
  // Active-parts allowlist resolved ahead of the Promise.all so every
  // catálogo count on the client cockpit shows ONLY parts Ursula has
  // actually imported — not the 149K legacy synced mirror. Per
  // src/lib/anexo24/active-parts.ts: "A part this client never imported
  // shouldn't show up on the anexo 24, catalog, or search." Applied
  // 2026-04-19 Sunday marathon Phase 9+ under Renato's "don't defer"
  // directive. ~30ms extra round-trip; acceptable for correctness.
  const activeCves = await getActiveCveProductos(supabase, companyId)
  const activeCvesListInicio = Array.from(activeCves.cves)
  const hasActiveCves = activeCvesListInicio.length > 0
  const activeSkuCount = activeCves.cves.size

  const [
    activeTraficos,
    documentos,
    activeTraficosCount,
    pedimentosListosCount,
    pedimentosMesCount,
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
    softCount(supabase.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('fecha_cruce', null).gte('fecha_llegada', ninetyDaysAgoIso), { label: 'traficos.activos', signals }),
    // Pedimentos listos: estatus=Pedimento Pagado, awaiting actual cruce,
    // with recency filter (90d) to exclude historical ghosts where the sync
    // never populated fecha_cruce. Without recency, EVCO has 900 hits but
    // only 18 represent real "waiting to cross right now."
    softCount(supabase.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('estatus', 'Pedimento Pagado').is('fecha_cruce', null).gte('fecha_llegada', ninetyDaysAgoIso), { label: 'traficos.listos', signals }),
    // Pedimentos nav-card count: mirrors the /pedimentos list-view filter
    // (pedimento set AND fecha_llegada within current month). Before this
    // helper the nav-card showed `pedimentosListosCount` ("awaiting cruce")
    // while the list showed every pedimento this month — so the nav-card
    // read "0" on pages with data. The hero KPI still uses the listos
    // count for the "Próximo cruce" signal.
    softCount(supabase.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('pedimento', 'is', null).gte('fecha_llegada', monthStartIso), { label: 'traficos.pedimentos_mes', signals }),
    // Cruces este mes: real fecha_cruce >= start-of-month.
    softCount(supabase.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('fecha_cruce', monthStartIso), { label: 'traficos.cruzados_mes', signals }),
    // Cruces last 7d for nav microStatus.
    softCount(supabase.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('fecha_cruce', sevenDaysAgoIso), { label: 'traficos.cruzados_7d', signals }),
    // Entradas esta semana — entradas.fecha_llegada_mercancia is the truth source.
    softCount(supabase.from('entradas').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('fecha_llegada_mercancia', sevenDaysAgoIso), { label: 'entradas.semana', signals }),
    softCount(supabase.from('expediente_documentos').select('id', { count: 'exact', head: true }).eq('company_id', companyId), { label: 'expedientes.total', signals }),
    softCount(supabase.from('expediente_documentos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('uploaded_at', monthStartIso), { label: 'expedientes.mes', signals }),
    // allowlist-ok:globalpc_productos — catálogo KPI counts filtered by
    // activeCvesListInicio so Ursula's hero numbers reflect her real
    // imported catalog (~693) not the legacy mirror (~149K). Short-circuit
    // to 0 when the tenant has no partidas yet (fresh onboarding).
    hasActiveCves
      ? softCount(supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('cve_producto', activeCvesListInicio), { label: 'catalogo.total', signals })
      : Promise.resolve(0),
    hasActiveCves
      ? softCount(supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('cve_producto', activeCvesListInicio).gte('fraccion_classified_at', monthStartIso), { label: 'catalogo.mes', signals })
      : Promise.resolve(0),
    hasActiveCves
      ? softCount(supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('cve_producto', activeCvesListInicio).not('fraccion', 'is', null), { label: 'catalogo.clasificaciones', signals })
      : Promise.resolve(0),
    // Sparkline series — bucket by the SAME field the headline KPI uses.
    softData<{ fecha_llegada: string }>(
      supabase.from('traficos').select('fecha_llegada').eq('company_id', companyId).is('fecha_cruce', null).gte('fecha_llegada', fourteenDaysAgoIso).limit(2000),
      { label: 'traficos.activos_series', signals }
    ),
    softData<{ fecha_llegada: string }>(
      supabase.from('traficos').select('fecha_llegada').eq('company_id', companyId).eq('estatus', 'Pedimento Pagado').is('fecha_cruce', null).gte('fecha_llegada', fourteenDaysAgoIso).limit(2000),
      { label: 'traficos.listos_series', signals }
    ),
    softData<{ uploaded_at: string }>(
      supabase.from('expediente_documentos').select('uploaded_at').eq('company_id', companyId).gte('uploaded_at', fourteenDaysAgoIso).limit(2000),
      { label: 'expedientes.series', signals }
    ),
    softData<{ fecha_llegada_mercancia: string }>(
      supabase.from('entradas').select('fecha_llegada_mercancia').eq('company_id', companyId).gte('fecha_llegada_mercancia', fourteenDaysAgoIso).limit(2000),
      { label: 'entradas.series', signals }
    ),
    // allowlist-ok:globalpc_productos — classification-velocity series
    // filtered to active parts; matches the headline KPIs above.
    hasActiveCves
      ? softData<{ fraccion_classified_at: string }>(
          supabase.from('globalpc_productos').select('fraccion_classified_at').eq('company_id', companyId).in('cve_producto', activeCvesListInicio).not('fraccion_classified_at', 'is', null).gte('fraccion_classified_at', fourteenDaysAgoIso).limit(2000),
          { label: 'catalogo.series', signals }
        )
      : Promise.resolve([] as { fraccion_classified_at: string }[]),
    softData<{ fecha_cruce: string }>(
      supabase.from('traficos').select('fecha_cruce').eq('company_id', companyId).gte('fecha_cruce', fourteenDaysAgoIso).limit(2000),
      { label: 'traficos.cruces_series', signals }
    ),
    // Último cruce — canonical helper, same source as WorkflowCard topbar
    // and hero "Último cruce" KPI. Collapsed from two divergent queries.
    withFallbackTimeout(getLatestCrossing(supabase, companyId), 3000, null),
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

  // Catálogo microcopy — live metric only. Previous versions exposed
  // the lifetime "+149K en catálogo" count as a parenthetical which
  // read as noise on the home tile (Renato 2026-04-20 screenshot
  // audit). Active-parts filter applies to the catalog too, so the
  // lifetime number stopped being a useful reference point. Keep
  // the live signal; drop the ghost count.
  const catalogoMicroStatus = catalogoMesCount > 0
    ? `${catalogoMesCount.toLocaleString('es-MX')} clasificada${catalogoMesCount === 1 ? '' : 's'} este mes`
    : 'Tu catálogo aparecerá conforme clasifiquemos tus productos'
  const catalogoHistoricMicrocopy: string | undefined = undefined

  const expedientesMicroStatus = expedientesMesCount > 0
    ? `${expedientesMesCount.toLocaleString('es-MX')} documento${expedientesMesCount === 1 ? '' : 's'} este mes`
    : 'Sin documentos nuevos este mes'
  const expedientesHistoricMicrocopy = expedientesCount > 0
    ? `(+${compactK(expedientesCount)} en histórico)`
    : undefined

  // Anexo 24 nav count — ACTIVE SKUs only. activeCves + activeSkuCount
  // are resolved once at the top of the render (right above the
  // Promise.all) so the catálogo KPI counts can apply the same allowlist.
  // Do not re-resolve here.
  const anexo24MicroStatus = activeSkuCount > 0
    ? `${activeSkuCount.toLocaleString('es-MX')} SKU${activeSkuCount === 1 ? '' : 's'} en tu Anexo 24`
    : 'Anexo 24 aparecerá cuando empieces a importar'
  // 2026-04-20 audit: drop the "148K más en el catálogo histórico"
  // parenthetical that Renato flagged as ghost noise on the nav card.
  // The this-month classification count reads cleaner as a live signal.
  const anexo24HistoricMicrocopy = catalogoMesCount > 0
    ? `${catalogoMesCount} nuevo${catalogoMesCount === 1 ? '' : 's'} este mes`
    : undefined

  // Phase 5 — client's own open-invoice count from econta_cartera.
  // Join via companies.clave_cliente (resolved above as companyRow.clave_cliente).
  // Soft-wrapped so a missing RLS or table hiccup doesn't crash the cockpit.
  const clave = companyRow.clave_cliente ?? null
  const contabilidadAbiertasCount = clave
    ? await softCount(
        supabase.from('econta_cartera').select('id', { count: 'exact', head: true }).eq('cve_cliente', clave).gt('saldo', 0),
        { label: 'contabilidad.abiertas', signals },
      )
    : 0
  const contabilidadMicroStatus = contabilidadAbiertasCount > 0
    ? `${contabilidadAbiertasCount} factura${contabilidadAbiertasCount === 1 ? '' : 's'} abierta${contabilidadAbiertasCount === 1 ? '' : 's'}`
    : 'Tu cuenta al corriente'

  const navCounts: NavCounts = {
    traficos:        { count: activeTraficosCount,    series: activosSeries,          microStatus: `${cruzadosLast7Count} cruzaron esta semana` },
    // 2026-04-19 override: Pedimentos tile retired from nav grid; Contabilidad takes tile #2.
    // Count = client's own open invoices (saldo>0) from econta_cartera.
    contabilidad:    { count: contabilidadAbiertasCount, series: [],                  microStatus: contabilidadMicroStatus },
    pedimentos:      { count: pedimentosMesCount,     series: pedimentosListosSeries, microStatus: daysSinceLastCruce != null ? `Último cruce hace ${daysSinceLastCruce} día${daysSinceLastCruce === 1 ? '' : 's'}` : 'Sin cruces recientes' },
    expedientes:     { count: expedientesMesCount,    series: expedientesSeries,      microStatus: expedientesMicroStatus, historicMicrocopy: expedientesHistoricMicrocopy },
    catalogo:        { count: catalogoMesCount,       series: [],                     microStatus: catalogoMicroStatus,    historicMicrocopy: catalogoHistoricMicrocopy },
    entradas:        { count: entradasSemanaCount,    series: entradasSeries,         microStatus: `${entradasSemanaCount} recibida${entradasSemanaCount === 1 ? '' : 's'} esta semana` },
    anexo24:         { count: activeSkuCount,         series: clasificacionesSeries,  microStatus: anexo24MicroStatus,     historicMicrocopy: anexo24HistoricMicrocopy },
  }
  // Sad-zero replacement on the Pedimentos nav card happens AFTER
  // heroBuild is computed — see below, once lastPedimentoIso is known.

  // Dynamic zero-state — when no active tráficos, show the most-recent
  // crossed embarque instead of a blank "nothing happening" line.
  // Reuses the canonical lastCruce result so the hero "Último cruce"
  // KPI and the nav-card "hace N días" microstatus agree on the same
  // trafico + fecha. The older .eq('estatus', 'Cruzado') query drifted
  // when data used 'E1' or 'Entregado' instead.
  const lastCruzadoRow = lastCruce
    ? { trafico: lastCruce.trafico, fecha_cruce: lastCruce.fecha_cruce }
    : null

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
      : formatCruceDate(lastCruzadoRow?.fecha_cruce ?? null),
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
  let tmecYtdUsd: number | null = null
  let lastPedimentoIso: string | null = null
  // v3.3: replaced the old daysSinceLastIncident cap with real signals —
  // successRatePct (cruzados / total in 90d) + avgClearanceDays (llegada →
  // cruce). Both are computed from one 90-day tráficos scan below.
  // v3.5 (2026-04-20): adds greenLightPct (semáforo verde rate) — the
  // broker-performance metric that replaces the truncation-prone
  // "Velocidad promedio" tile with a consistent 95-99% signal.
  let successRatePct: number | null = null
  let avgClearanceDays: number | null = null
  let greenLightPct: number | null = null
  if (activeCount === 0) {
    // Single 90-day window fetch that computes success rate + clearance
    // time + semáforo-verde rate. Capped at 2000 rows — EVCO crosses a
    // few dozen per month so 2000 covers multiple years for any
    // realistic tenant.
    try {
      const ninetyAgo = daysAgo(90).toISOString()
      const { data: windowRows } = await supabase
        .from('traficos')
        .select('estatus, fecha_llegada, fecha_cruce, semaforo')
        .eq('company_id', companyId)
        .gte('fecha_llegada', ninetyAgo)
        .limit(2000)
      if (Array.isArray(windowRows) && windowRows.length > 0) {
        const rows = windowRows as Array<{ estatus: string | null; fecha_llegada: string | null; fecha_cruce: string | null; semaforo: number | string | null }>
        const crossedEstatuses = new Set(['Cruzado', 'E1', 'Entregado'])
        const crossed = rows.filter((r) => crossedEstatuses.has(r.estatus ?? ''))
        const crossedWithBoth = crossed.filter((r) => r.fecha_cruce && r.fecha_llegada)
        // Tasa de éxito uses a mature denominator (14 days minimum age)
        // and a 10-sample floor — both defined once in success-rate.ts
        // so the parameters never drift out of sync. Below the floor
        // or with only in-flight tráficos, returns null → the tile
        // falls back to the "Operación estable" variant instead of
        // showing a misleading 43%.
        successRatePct = computeSuccessRate(rows)
        if (crossedWithBoth.length > 0) {
          const sum = crossedWithBoth.reduce((acc, r) => {
            const delta = (new Date(r.fecha_cruce as string).getTime() - new Date(r.fecha_llegada as string).getTime()) / 86_400_000
            return acc + (delta >= 0 ? delta : 0)
          }, 0)
          avgClearanceDays = sum / crossedWithBoth.length
        }
        // Semáforo-verde rate — the broker's job-performance metric.
        // `semaforo` arrives as either 0/1/2 (numeric) or "0"/"1"/"2"
        // (string from upstream sync); normalize before comparison.
        // Verde = 0. A scored crossing is any row with a non-null
        // semáforo on a fecha_cruce-completed tráfico.
        const scored = crossed.filter((r) => r.semaforo !== null && r.semaforo !== undefined && r.semaforo !== '')
        if (scored.length > 0) {
          const verde = scored.filter((r) => String(r.semaforo).trim() === '0').length
          greenLightPct = Math.round((verde / scored.length) * 100)
        }
      }
    } catch { /* soft — leave metrics null so quiet-season falls back to "Operación estable" / "Historial confiable" */ }

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

  // Freshness — query last successful sync for this tenant. Soft-fails
  // to hasData=false so the banner simply doesn't render if sync_log
  // is empty / unreachable (contract: sync-contract.md).
  const freshness = await readFreshness(supabase, companyId)

  const heroBuild = buildClientHeroTiles({
    activeCount,
    standardTiles: standardHeroKPIs,
    successRatePct,
    avgClearanceDays,
    greenLightPct,
    lastCruceIso: lastCruzadoRow?.fecha_cruce ?? null,
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

  // When there's a recent crossing, surface its semáforo in-line so the
  // subtitle reads "cruzó verde hace 3 días" instead of the plain "cruzó
  // hace 3 días". The verde adjective lands as a micro-delight moment
  // without adding a new component — pure copy enrichment. Fallbacks to
  // the plain form when semaforo is null/unknown.
  const lastCruceSemaforoWord: string | null =
    lastCruce?.semaforo === 0
      ? 'verde'
      : lastCruce?.semaforo === 1
        ? 'amarillo'
        : lastCruce?.semaforo === 2
          ? 'rojo'
          : null
  const computedSummary = activeTraficos.length > 0
    ? `${activeTraficos.length} embarque${activeTraficos.length === 1 ? '' : 's'} en tránsito · Patente en movimiento`
    : lastCruzadoRow
      ? `Último embarque · ${lastCruzadoRow.trafico} · cruzó${lastCruceSemaforoWord ? ` ${lastCruceSemaforoWord}` : ''} ${daysAgoLabel(lastCruzadoRow.fecha_cruce)}`
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

  // PORTAL ticker (Block DD · 2026-04-17) — three live signals above the hero.
  // Each reads from data already fetched server-side; no extra query cost.
  const tickerItems = [
    { label: 'ACTIVOS', value: String(activeTraficosCount), tone: (activeTraficosCount > 0 ? 'live' : 'neutral') as 'live' | 'neutral' },
    { label: 'CRUCES · MES', value: String(cruzadosMesCount ?? 0), tone: 'neutral' as const },
    { label: 'PEDIMENTOS · MES', value: String(pedimentosMesCount ?? 0), tone: 'neutral' as const },
    ...(daysSinceLastCruce != null
      ? [{ label: 'ÚLT. CRUCE', value: daysSinceLastCruce === 0 ? 'hoy' : `${daysSinceLastCruce}d`, tone: 'neutral' as const }]
      : []),
  ]

  return (
    <InicioClientShell
      role="client"
      name={companyName || 'Tu portal'}
      companyName={companyName || 'Tu portal'}
      heroKPIs={heroKPIs}
      navCounts={navCounts}
      tickerItems={tickerItems}
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
      freshnessSlot={
        <>
          {/*
           * Demo-polish 2026-04-22 — the amber "Estamos revalidando…"
           * partial-data banner is hidden for the EVCO launch. It fires
           * when ≥2 soft-queries fail on render — legit during the PM2
           * outage earlier today, but reads as an alert-bar next to
           * Ursula's calm greeting. With PM2 back (globalpc_delta + 9
           * other syncs green), the trigger condition is rare; when it
           * DOES fire, it scares more than it helps.
           *
           * FreshnessBanner stays: fresh-mode renders as quiet silver
           * microcopy ("Sincronizado hace 3 min") — the signal we
           * actually want Ursula to read. Stale-mode remains load-
           * bearing per .claude/rules/sync-contract.md.
           *
           * To re-enable: set `NEXT_PUBLIC_PARTIAL_DATA_BANNER=true` in
           * Vercel env + redeploy. The humanizeFailedLabels helper +
           * amber styling + dedup-against-stale rule are all intact;
           * only the render is gated.
           */}
          {process.env.NEXT_PUBLIC_PARTIAL_DATA_BANNER === 'true'
            && signals.failureCount >= 2
            && !freshness.isStale && (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 12,
                background: 'var(--portal-status-amber-bg)',
                border: '1px solid rgba(251,191,36,0.28)',
                color: 'var(--portal-status-amber-fg)',
                fontSize: 12, // WHY: partial-data banner — sub-header warning, between meta (11) and body (13).
                fontWeight: 500,
                letterSpacing: '0.01em',
                lineHeight: 1.45,
              }}
            >
              Estamos revalidando {humanizeFailedLabels(signals.failedLabels)}. Los números volverán en unos minutos.
            </div>
          )}
          <FreshnessBanner reading={freshness} />
        </>
      }
    />
  )
}
