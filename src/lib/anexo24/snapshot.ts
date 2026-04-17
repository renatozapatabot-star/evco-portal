import type { SupabaseClient } from '@supabase/supabase-js'

type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Anexo 24 snapshot — the canonical view of a client's IMMEX
 * inventory as CRUZ knows it today. Sources from globalpc_productos
 * (the synced mirror of the client's Formato 53). Phase 3 of the
 * Anexo 24 plan (Marathon 3) will replace this with a dedicated
 * anexo24_parts table that carries the official Formato 53 truth +
 * drift detection. Until then, this module is the source of truth
 * for every `/anexo-24` surface.
 *
 * SAT-audit reality check: the numbers Ursula sees on /anexo-24 MUST
 * match what a Formato 53 export from GlobalPC.net would show. That
 * is the one-line test for this module.
 */

export interface AnexoSku {
  id: string
  cve_producto: string | null
  descripcion: string
  fraccion: string | null
  fraccion_source: string | null
  fraccion_classified_at: string | null
  cve_proveedor: string | null
  proveedor_nombre: string | null
  pais_origen: string | null
  umt: string | null
  veces_importado: number
  valor_ytd_usd: number | null
  ultimo_cve_trafico: string | null
  ultima_fecha_llegada: string | null
  /** Heuristic: fraccion starts with a T-MEC-preferential chapter.
   *  Real T-MEC eligibility is a per-fraction datum from
   *  preferential_rate_tmec that we don't yet surface on every row —
   *  Phase 3 will join it. For now this is best-effort. */
  tmec_eligible_heuristic: boolean | null
}

export interface AnexoKpis {
  /** Total SKUs in the client's Anexo 24 (globalpc_productos count). */
  total_skus: number
  /** SKUs with a resolved fracción arancelaria. */
  classified_count: number
  /** SKUs without a fracción — Renato's work queue. */
  unclassified_count: number
  /** classified_count / total_skus as a percentage (0–100). */
  classified_pct: number
  /** Distinct fracción arancelaria values — the unique tariff codes
   *  the client imports against. */
  unique_fracciones: number
  /** Distinct cve_proveedor values with at least one SKU today. */
  active_proveedores: number
  /** MAX fraccion_classified_at — when CRUZ last saw movement in
   *  this client's Anexo 24. null = never classified. */
  last_updated_iso: string | null
}

export interface AnexoDocRef {
  /** Stable id — combines kind+resource+timestamp so React keys stay
   *  stable across re-renders even when two traficos generate the
   *  same doc type on the same day. */
  id: string
  kind: 'pedimento' | 'anexo24_export' | 'oca' | 'certificate' | 'invoice'
  label: string
  sub?: string
  href?: string
  storage_url?: string
  timestamp_iso: string
}

export interface AnexoSnapshot {
  kpis: AnexoKpis
  skus: AnexoSku[]
  recent_docs: AnexoDocRef[]
  client_name: string
  company_id: string
}

/** T-MEC chapters where imports typically qualify under USMCA. Used as
 *  a rendering hint only — never as a substitute for the real
 *  preferential_rate_tmec lookup. */
const TMEC_LIKELY_CHAPTERS = new Set<string>([
  '39', '40', '72', '73', '76', '84', '85', '87', '90', // common EVCO + tier-1 client ranges
])

function toNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function chapter(fraccion: string | null): string | null {
  if (!fraccion) return null
  const digits = fraccion.replace(/\D/g, '')
  return digits.length >= 2 ? digits.slice(0, 2) : null
}

/**
 * Fetch the full Anexo 24 snapshot for a client. Bundles three parallel
 * Supabase queries: productos (SKU master), proveedores (name resolve),
 * and recent docs (linked document index).
 *
 * Used by /anexo-24 page.tsx. Cap at 500 SKUs for Phase 1 — the table
 * renders the first page; Phase 2 introduces server-side pagination.
 */
export async function getAnexoSnapshot(
  supabase: AnyClient,
  companyId: string,
  opts: { q?: string; limit?: number } = {},
): Promise<AnexoSnapshot> {
  if (!companyId) {
    return {
      kpis: {
        total_skus: 0,
        classified_count: 0,
        unclassified_count: 0,
        classified_pct: 0,
        unique_fracciones: 0,
        active_proveedores: 0,
        last_updated_iso: null,
      },
      skus: [],
      recent_docs: [],
      client_name: '',
      company_id: '',
    }
  }

  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500)
  const q = (opts.q ?? '').trim()

  // Base SKU query — mirrors the catalog's deterministic ordering so
  // /anexo-24 and /catalogo show the same slice when a client flips
  // between them during an audit.
  let productoQuery = supabase
    .from('globalpc_productos')
    .select('id, cve_producto, descripcion, fraccion, fraccion_source, fraccion_classified_at, cve_proveedor, pais_origen, umt')
    .eq('company_id', companyId)
    .order('fraccion_classified_at', { ascending: false, nullsFirst: false })
    .order('cve_producto', { ascending: true })
    .limit(limit)

  if (q.length > 0) {
    const safe = q.replace(/[%_]/g, '')
    productoQuery = productoQuery.or(
      `descripcion.ilike.%${safe}%,fraccion.ilike.%${safe}%,cve_producto.ilike.%${safe}%`,
    )
  }

  // Parallel fetches:
  //   (a) SKU slice for display
  //   (b) full-count queries for headline KPIs (not slice-capped)
  //   (c) recent Anexo 24 exports from storage metadata (if present)
  const [productosRes, totalRes, classifiedRes, fraccionesRes, proveedoresRes] = await Promise.all([
    productoQuery,
    supabase
      .from('globalpc_productos')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId),
    supabase
      .from('globalpc_productos')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('fraccion', 'is', null),
    supabase
      .from('globalpc_productos')
      .select('fraccion')
      .eq('company_id', companyId)
      .not('fraccion', 'is', null)
      .limit(10000),
    supabase
      .from('globalpc_productos')
      .select('cve_proveedor')
      .eq('company_id', companyId)
      .not('cve_proveedor', 'is', null)
      .limit(10000),
  ])

  const productos = (productosRes.data ?? []) as Array<{
    id: string | number
    cve_producto: string | null
    descripcion: string | null
    fraccion: string | null
    fraccion_source: string | null
    fraccion_classified_at: string | null
    cve_proveedor: string | null
    pais_origen: string | null
    umt: string | null
  }>

  // Resolve proveedor names for the rendered slice.
  const proveedorIds = Array.from(new Set(
    productos.map((p) => p.cve_proveedor).filter((x): x is string => !!x),
  ))
  const proveedoresData = proveedorIds.length > 0
    ? await supabase
        .from('globalpc_proveedores')
        .select('cve_proveedor, nombre')
        .in('cve_proveedor', proveedorIds)
    : { data: [] as Array<{ cve_proveedor: string | null; nombre: string | null }> }
  const proveedorMap = new Map<string, string>()
  for (const p of (proveedoresData.data ?? [])) {
    if (p.cve_proveedor && p.nombre) proveedorMap.set(p.cve_proveedor, p.nombre)
  }

  // Partida-level aggregate per descripcion (for "times imported" + YTD).
  // We lookup by descripcion (not cve_producto) because partidas rows
  // historically carry their own descripcion freetext that may diverge
  // from globalpc_productos; match on the text EVCO's team sees.
  const descripciones = Array.from(new Set(
    productos.map((p) => (p.descripcion ?? '').trim().toUpperCase()).filter((x) => x.length > 0),
  )).slice(0, 200)
  const partidaAggRes = descripciones.length > 0
    ? await supabase
        .from('globalpc_partidas')
        .select('cve_trafico, descripcion, valor_comercial, fecha_llegada')
        .eq('company_id', companyId)
        .in('descripcion', descripciones)
        .limit(5000)
    : { data: [] as Array<{ cve_trafico: string | null; descripcion: string | null; valor_comercial: number | string | null; fecha_llegada: string | null }> }

  const partidaAgg = new Map<string, { count: number; valor: number; lastTrafico: string | null; lastFecha: string | null }>()
  const thisYearStart = `${new Date().getUTCFullYear()}-01-01`
  for (const row of (partidaAggRes.data ?? [])) {
    const key = (row.descripcion ?? '').trim().toUpperCase()
    if (!key) continue
    const prev = partidaAgg.get(key) ?? { count: 0, valor: 0, lastTrafico: null, lastFecha: null }
    prev.count += 1
    if ((row.fecha_llegada ?? '') >= thisYearStart) prev.valor += toNumber(row.valor_comercial)
    if (!prev.lastFecha || (row.fecha_llegada ?? '') > prev.lastFecha) {
      prev.lastFecha = row.fecha_llegada
      prev.lastTrafico = row.cve_trafico
    }
    partidaAgg.set(key, prev)
  }

  // Compose rendered SKUs.
  const skus: AnexoSku[] = productos.map((p) => {
    const key = (p.descripcion ?? '').trim().toUpperCase()
    const agg = partidaAgg.get(key)
    const ch = chapter(p.fraccion)
    return {
      id: String(p.id),
      cve_producto: p.cve_producto,
      descripcion: p.descripcion ?? '',
      fraccion: p.fraccion,
      fraccion_source: p.fraccion_source,
      fraccion_classified_at: p.fraccion_classified_at,
      cve_proveedor: p.cve_proveedor,
      proveedor_nombre: p.cve_proveedor ? proveedorMap.get(p.cve_proveedor) ?? null : null,
      pais_origen: p.pais_origen,
      umt: p.umt,
      veces_importado: agg?.count ?? 0,
      valor_ytd_usd: agg && agg.valor > 0 ? Math.round(agg.valor * 100) / 100 : null,
      ultimo_cve_trafico: agg?.lastTrafico ?? null,
      ultima_fecha_llegada: agg?.lastFecha ?? null,
      tmec_eligible_heuristic: ch ? TMEC_LIKELY_CHAPTERS.has(ch) : null,
    }
  })

  // KPIs — pulled from the count queries, not the slice.
  const totalSkus = totalRes.count ?? 0
  const classifiedCount = classifiedRes.count ?? 0
  const fraccionRows = (fraccionesRes.data ?? []) as Array<{ fraccion: string | null }>
  const uniqueFracciones = new Set(fraccionRows.map((r) => r.fraccion).filter(Boolean)).size
  const proveedorRows = (proveedoresRes.data ?? []) as Array<{ cve_proveedor: string | null }>
  const activeProveedores = new Set(proveedorRows.map((r) => r.cve_proveedor).filter(Boolean)).size
  const lastUpdated = productos.find((p) => p.fraccion_classified_at)?.fraccion_classified_at ?? null

  const kpis: AnexoKpis = {
    total_skus: totalSkus,
    classified_count: classifiedCount,
    unclassified_count: Math.max(0, totalSkus - classifiedCount),
    classified_pct: totalSkus > 0 ? Math.round((classifiedCount / totalSkus) * 100) : 0,
    unique_fracciones: uniqueFracciones,
    active_proveedores: activeProveedores,
    last_updated_iso: lastUpdated,
  }

  // Recent docs — best-effort index of Anexo 24 generated PDFs/XLSX
  // and pedimento PDFs from the storage bucket metadata.
  const recent_docs: AnexoDocRef[] = []
  try {
    const { data: anexoExports } = await supabase
      .storage
      .from('anexo-24-exports')
      .list(companyId, { limit: 5, sortBy: { column: 'created_at', order: 'desc' } })
    for (const file of (anexoExports ?? [])) {
      if (!file.name) continue
      const kind: AnexoDocRef['kind'] = 'anexo24_export'
      const label = file.name.endsWith('.pdf') ? 'Anexo 24 PDF' : 'Anexo 24 Excel'
      const { data: pub } = supabase.storage.from('anexo-24-exports').getPublicUrl(`${companyId}/${file.name}`)
      recent_docs.push({
        id: `anexo-${file.name}`,
        kind,
        label,
        sub: file.name,
        storage_url: pub.publicUrl,
        timestamp_iso: file.created_at ?? new Date().toISOString(),
      })
    }
  } catch {
    // Bucket may not exist in dev or for a fresh tenant — non-fatal.
  }

  return {
    kpis,
    skus,
    recent_docs,
    client_name: '',
    company_id: companyId,
  }
}
