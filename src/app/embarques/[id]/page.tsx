import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { getRequiredDocs, type DocType } from '@/lib/doc-requirements'
import type { Category } from '@/lib/events-catalog'
import { DetailPageShell } from '@/components/aguila'
import { TraficoDetail } from './TraficoDetail'
import { TraficoTimeline, type TimelineInput } from './TraficoTimeline'
import { buildChain, type FacturaRow as ChainFacturaRow, type EntradaRow as ChainEntradaRow, type PedimentoRow as ChainPedimentoRow } from './buildChain'
import type {
  AvailableUserLite,
  DocRow,
  EventRow,
  NoteRow,
  PartidaRow,
  TraficoRow,
} from './types'

/**
 * Embarque detail — Block 1B server component.
 *
 * Parallel-fetches the 7 row sets the new detail page needs
 * (trafico, events, expediente, partidas, notes, users, company),
 * then passes props into the <TraficoDetail> client shell.
 *
 * V1 — legacy escape-hatch removed (marathon batch 1). The new surface
 * is the only surface. Pre-existing bookmarks with `?legacy=1` now render
 * the standard detail page.
 */
export default async function TraficoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const traficoId = decodeURIComponent(rawId).trim()

  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const supabase = createServerClient()

  // Only columns that actually exist on traficos. The 7 fields the legacy
  // page expected (tipo_operacion, doda_status, u_level, peso_volumetrico,
  // prevalidador, banco_operacion_numero, sat_transaccion_numero) are
  // schema-absent — querying them returns "column does not exist" and
  // collapses traficoRes.data to null, triggering a false 404. We coerce
  // them to null below so the TraficoRow shape stays satisfied.
  const TRAFICO_COLS =
    'trafico, estatus, pedimento, fecha_llegada, importe_total, regimen, company_id, proveedores, descripcion_mercancia, patente, aduana, tipo_cambio, peso_bruto, fecha_cruce, fecha_pago, semaforo, assigned_to_operator_id, updated_at, created_at'

  let traficoQ = supabase.from('traficos').select(TRAFICO_COLS).eq('trafico', traficoId)
  if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)

  const [traficoRes, eventsRes, docsRes, facturasRes, notesRes, pedimentoRes, entradasRes] = await Promise.all([
    traficoQ.maybeSingle(),
    supabase
      .from('workflow_events')
      .select('id, trigger_id, event_type, workflow, payload, created_at')
      .eq('trigger_id', traficoId)
      .order('created_at', { ascending: false })
      .limit(500),
    // expediente_documentos real columns: id, doc_type, file_name, uploaded_at.
    // `pedimento_id` here stores the trafico slug (e.g. "9254-X3435"), not a
    // pedimento number — confusing naming but that is the canonical link.
    // Columns `document_type`, `document_type_confidence`, `created_at`,
    // `trafico_id` do NOT exist (M15 phantom-column sweep).
    supabase
      .from('expediente_documentos')
      .select('id, doc_type, file_name, uploaded_at')
      .eq('pedimento_id', traficoId)
      .order('uploaded_at', { ascending: false })
      .limit(200),
    // Step 1 of the partidas chain: get folios for this embarque from globalpc_facturas.
    // `fecha_pago` lives on traficos, NOT facturas (M15 phantom fix).
    supabase
      .from('globalpc_facturas')
      .select('folio')
      .eq('cve_trafico', traficoId)
      .limit(100),
    supabase
      .from('trafico_notes')
      .select('id, author_id, content, mentions, created_at')
      .eq('trafico_id', traficoId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('pedimentos')
      .select('id, pedimento_number, status, updated_at')
      .eq('trafico_id', traficoId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('entradas')
      .select('id, fecha_ingreso, fecha_llegada_mercancia')
      .eq('trafico', traficoId)
      .order('fecha_ingreso', { ascending: false, nullsFirst: false })
      .limit(50),
  ])

  // Hydrate trafico — coerce schema-absent legacy fields to null so the
  // TraficoRow shape is satisfied without those columns existing in Postgres.
  function hydrateTrafico(raw: Record<string, unknown> | null): TraficoRow | null {
    if (!raw) return null
    return {
      ...(raw as Omit<TraficoRow, 'tipo_operacion' | 'doda_status' | 'u_level' | 'peso_volumetrico' | 'prevalidador' | 'banco_operacion_numero' | 'sat_transaccion_numero'>),
      tipo_operacion: null,
      doda_status: null,
      u_level: null,
      peso_volumetrico: null,
      prevalidador: null,
      banco_operacion_numero: null,
      sat_transaccion_numero: null,
    }
  }

  let trafico: TraficoRow | null = hydrateTrafico(traficoRes.data as Record<string, unknown> | null)

  // Silent 404 diagnostics: a miss can be (a) no such clave, (b) clave exists
  // but belongs to a different company_id (stale session/cross-tenant), or
  // (c) case/whitespace drift between the list and DB. Probe before surrendering.
  if (!trafico) {
    const { data: looseRows } = await supabase
      .from('traficos')
      .select('trafico, company_id')
      .ilike('trafico', traficoId)
      .limit(2)
    const crossTenant = (looseRows ?? []).some(
      (r) => !isInternal && r.company_id && r.company_id !== session.companyId,
    )
    console.info('[trafico-detail] miss', {
      traficoId,
      isInternal,
      sessionCompanyId: session.companyId,
      looseHits: looseRows?.length ?? 0,
      crossTenant,
    })
    // Case/whitespace tolerance: if exactly one case-insensitive match and the
    // caller is allowed to see it, re-query using that canonical value.
    if (looseRows?.length === 1) {
      const canonical = looseRows[0]?.trafico
      const canonicalCompany = looseRows[0]?.company_id
      const allowed = isInternal || canonicalCompany === session.companyId
      if (canonical && allowed && canonical !== traficoId) {
        let recoverQ = supabase.from('traficos').select(TRAFICO_COLS).eq('trafico', canonical)
        if (!isInternal) recoverQ = recoverQ.eq('company_id', session.companyId)
        const recovered = await recoverQ.maybeSingle()
        trafico = hydrateTrafico(recovered.data as Record<string, unknown> | null)
      }
    }
    if (!trafico) notFound()
  }

  const rawEvents =
    (eventsRes.data as Array<{
      id: string
      trigger_id: string
      event_type: string
      workflow: string | null
      payload: Record<string, unknown> | null
      created_at: string
    }> | null) ?? []

  // Hydrate events with events_catalog metadata (icon/category/copy).
  // One round-trip, keyed by the distinct event_types in the page's events.
  const eventTypeKeys = Array.from(new Set(rawEvents.map((r) => r.event_type)))
  const catalog: Record<
    string,
    {
      category: Category
      visibility: 'public' | 'private'
      display_name_es: string
      description_es: string | null
      icon_name: string | null
      color_token: string | null
    }
  > = {}
  if (eventTypeKeys.length > 0) {
    const { data: catalogRows } = await supabase
      .from('events_catalog')
      .select('event_type, category, visibility, display_name_es, description_es, icon_name, color_token')
      .in('event_type', eventTypeKeys)
    if (Array.isArray(catalogRows)) {
      for (const row of catalogRows as Array<{
        event_type: string
        category: Category
        visibility: 'public' | 'private'
        display_name_es: string
        description_es: string | null
        icon_name: string | null
        color_token: string | null
      }>) {
        catalog[row.event_type] = {
          category: row.category,
          visibility: row.visibility,
          display_name_es: row.display_name_es,
          description_es: row.description_es,
          icon_name: row.icon_name,
          color_token: row.color_token,
        }
      }
    }
  }

  const events: EventRow[] = rawEvents.map((r) => {
    const meta = catalog[r.event_type]
    return {
      ...r,
      category: meta?.category ?? null,
      visibility: meta?.visibility ?? null,
      display_name_es: meta?.display_name_es ?? null,
      description_es: meta?.description_es ?? null,
      icon_name: meta?.icon_name ?? null,
      color_token: meta?.color_token ?? null,
    }
  })

  const docs = ((docsRes.data as DocRow[] | null) ?? [])
  const notes = ((notesRes.data as NoteRow[] | null) ?? [])

  // Step 2 of partidas chain: facturas → folios → partidas → product enrichment.
  // globalpc_partidas does NOT have cve_trafico; you must hop through facturas.
  // `fecha_pago` lives on traficos (single value per embarque) — we project it
  // onto every factura row so the downstream chain + timeline logic keeps the
  // existing shape without an additional join.
  const rawFacturaRows =
    (facturasRes.data as Array<{ folio: number | null }> | null) ?? []
  const facturasChainRows = rawFacturaRows.map((f) => ({
    folio: f.folio,
    fecha_pago: trafico.fecha_pago ?? null,
  }))
  const folios = facturasChainRows
    .map(f => f.folio)
    .filter((f): f is number => f != null)

  let partidas: PartidaRow[] = []
  if (folios.length > 0) {
    // Defense-in-depth: the folios set is already tenant-scoped (parent
    // facturas were scoped to this trafico), but a folio collision across
    // tenants would leak a row. Explicit company_id filter closes the edge.
    let partidasQ = supabase
      .from('globalpc_partidas')
      .select('id, folio, cve_producto, cve_cliente, cantidad, precio_unitario, peso, pais_origen')
      .in('folio', folios)
      .limit(500)
    if (!isInternal) partidasQ = partidasQ.eq('company_id', session.companyId)
    const { data: rawPartidas } = await partidasQ
    const partidaRows = (rawPartidas ?? []) as Array<{
      id: number
      folio: number | null
      cve_producto: string | null
      cve_cliente: string | null
      cantidad: number | null
      precio_unitario: number | null
      peso: number | null
      pais_origen: string | null
    }>

    // Enrich descriptions + fracciones from globalpc_productos (cve_producto, cve_cliente).
    const productKeys = Array.from(
      new Set(partidaRows.map(p => `${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`).filter(k => k !== '|'))
    )
    const productMap = new Map<string, { descripcion: string | null; fraccion: string | null }>()
    if (productKeys.length > 0) {
      const cves = Array.from(new Set(partidaRows.map(p => p.cve_producto).filter((c): c is string => !!c)))
      // Defense-in-depth: scope the productos enrichment query to this
      // trafico's company_id. The input cves are already tenant-
      // scoped (they came from partidas under a tenant-scoped trafico),
      // but cve_producto values could theoretically collide across
      // tenants and leak a description/fraccion from another client's
      // identical key. Adding the eq filter closes that edge case.
      const { data: prods } = await supabase
        .from('globalpc_productos')
        .select('cve_producto, cve_cliente, descripcion, fraccion')
        .eq('company_id', trafico.company_id ?? session.companyId)
        .in('cve_producto', cves)
        .limit(2000)
      for (const p of (prods ?? []) as Array<{
        cve_producto: string | null
        cve_cliente: string | null
        descripcion: string | null
        fraccion: string | null
      }>) {
        productMap.set(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`, {
          descripcion: p.descripcion,
          fraccion: p.fraccion,
        })
      }
    }

    partidas = partidaRows.map((p, i): PartidaRow => {
      const enr = productMap.get(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`)
      const cantidad = Number(p.cantidad) || 0
      const precio = Number(p.precio_unitario) || 0
      return {
        id: p.id ?? i,
        numero_parte: p.cve_producto,
        descripcion: enr?.descripcion ?? null,
        fraccion_arancelaria: enr?.fraccion ?? null,
        fraccion: enr?.fraccion ?? null,
        cantidad,
        cantidad_bultos: null,
        peso_bruto: p.peso ?? null,
        valor_comercial: cantidad * precio,
        umc: null,
        pais_origen: p.pais_origen,
        regimen: null,
        tmec: null,
      }
    })
  }

  // Best-effort operator roster. The app has `client_users` only; we map
  // role IN (operator, admin, broker) into {companyId}:{role} composites
  // so mentions resolve against what already exists.
  let availableUsers: AvailableUserLite[] = []
  try {
    const { data: roster } = await supabase
      .from('client_users')
      .select('company_id, role, display_name')
      .in('role', ['operator', 'admin', 'broker'])
      .limit(200)
    if (Array.isArray(roster)) {
      availableUsers = (
        roster as Array<{ company_id: string | null; role: string | null; display_name: string | null }>
      )
        .filter((u) => u.company_id && u.role)
        .map((u) => ({
          id: `${u.company_id}:${u.role}`,
          label: u.display_name ? `${u.display_name} (${u.role})` : `${u.company_id}:${u.role}`,
        }))
    }
  } catch {
    // client_users may not exist in every env — graceful empty fallback.
    availableUsers = []
  }

  // Company name — one-shot lookup.
  let clientName = trafico.company_id ?? '—'
  let clientRfc: string | null = null
  if (trafico.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('company_id, name, rfc')
      .eq('company_id', trafico.company_id)
      .maybeSingle()
    const c = company as { name: string | null; rfc: string | null } | null
    if (c?.name) clientName = c.name
    clientRfc = c?.rfc ?? null
  }

  // Missing-docs computation — drives hero tile color + solicitud modal.
  const requiredDocs = getRequiredDocs(trafico.regimen)
  const uploadedDocTypes = new Set(
    docs.map((d) => (d.document_type ?? d.doc_type ?? '') as string).filter(Boolean),
  )
  const missingDocs: DocType[] = requiredDocs.filter((d) => !uploadedDocTypes.has(d))
  const uploadedRequiredCount = requiredDocs.length - missingDocs.length

  const currentUserId = `${session.companyId}:${session.role}`

  const pedimentoChainRow =
    (pedimentoRes.data as ChainPedimentoRow | null) ?? null
  const entradasChainRows =
    (entradasRes.data as ChainEntradaRow[] | null) ?? []
  const facturasForChain: ChainFacturaRow[] = facturasChainRows

  const chain = buildChain({
    traficoId,
    fechaCruce: trafico.fecha_cruce,
    facturas: facturasForChain,
    entradas: entradasChainRows,
    pedimento: pedimentoChainRow,
    docCount: docs.length,
    requiredDocsCount: requiredDocs.length,
    uploadedRequiredCount,
    // V1 · chain-truth inputs so header estatus + chain state can't contradict
    traficoEstatus: trafico.estatus ?? null,
    traficoPedimentoNumber: trafico.pedimento ?? null,
  })

  // Timeline input — reuses the data the page already fetched so the
  // timeline is cheap to render. Each milestone's ts/href derives from
  // the same source-of-truth columns the legacy chain + hero strip use.
  const timelineInput: TimelineInput = {
    trafico_id: traficoId,
    created_at: trafico.created_at ?? null,
    fecha_llegada: trafico.fecha_llegada ?? null,
    fecha_cruce: trafico.fecha_cruce ?? null,
    pedimento_number: trafico.pedimento ?? null,
    estatus: trafico.estatus ?? null,
    // semaforo column is text in some legacy rows, integer in newer —
    // coerce to number for the timeline component which expects 0/1/2/null.
    semaforo: (() => {
      const raw = trafico.semaforo
      if (raw == null) return null
      const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
      return Number.isFinite(n) ? n : null
    })(),
    entradas: entradasChainRows.map((e) => ({
      fecha_ingreso: e.fecha_ingreso ?? null,
      fecha_llegada_mercancia: e.fecha_llegada_mercancia ?? null,
    })),
    docs_count: docs.length,
    required_docs_count: requiredDocs.length,
    uploaded_required_count: uploadedRequiredCount,
    facturas: facturasChainRows,
  }

  return (
    <DetailPageShell
      breadcrumb={[
        { label: 'Embarques', href: '/embarques' },
        { label: traficoId },
      ]}
      title={traficoId}
      titleKind="id"
      subtitle={clientName ?? undefined}
      maxWidth={1400}
    >
      {/* Timeline — renders above the detail shell so the cinematic
          vertical status rail is the primary UX. The legacy hero +
          below-fold sections remain untouched underneath for deep data
          (partidas, notas, events log). When document uploads ramp up
          post-Marathon 3, the timeline absorbs more context without
          needing layout changes. */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '12px 0 0' }}>
        <TraficoTimeline input={timelineInput} />
      </div>

      <TraficoDetail
        traficoId={traficoId}
        trafico={trafico}
        events={events}
        docs={docs}
        partidas={partidas}
        notes={notes}
        availableUsers={availableUsers}
        clientName={clientName}
        clientRfc={clientRfc}
        isInternal={isInternal}
        role={session.role}
        currentUserId={currentUserId}
        missingDocs={missingDocs}
        requiredDocsCount={requiredDocs.length}
        uploadedRequiredCount={uploadedRequiredCount}
        chain={chain}
      />
    </DetailPageShell>
  )
}
