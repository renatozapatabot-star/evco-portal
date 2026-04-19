import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAnexo24Overlay, isAnexo24CanonicalEnabled } from '@/lib/reference/anexo24'
import { getActiveCveProductos, activeCvesArray } from './active-parts'
import { resolveProveedorName } from '@/lib/proveedor-names'

type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Anexo 24 by-fracción view — consolidates the 148K-row SKU catalog
 * into the ~500 tariff codes the client actually imports against.
 *
 * This is the view Ursula uses to defend an audit: "show me every SKU
 * we import under fracción 3901.20.01, which traficos carried them,
 * and what we paid for each." A flat SKU list is too wide; a grouped
 * fracción view is the mental model that matches SAT's own filing
 * format.
 *
 * Strategy: a single unscoped fetch (capped at 2000 rows) of all
 * classified productos for the client, grouped client-side. Running
 * hundreds of group-by-fraction aggregations per request would be
 * slower than one query + JS aggregation at current volumes. Will
 * move to a materialized view when any single client exceeds the
 * cap.
 */

export interface AnexoFraccionGroup {
  fraccion: string
  /** Formatted display: XXXX.XX.XX — drop to for-UI consumers. */
  fraccion_formatted: string | null
  /** The highest-usage descripcion in the group — the "name that best
   *  describes this fraccion" as far as Ursula is concerned. */
  primary_description: string
  sku_count: number
  total_imports: number
  total_valor_ytd_usd: number | null
  /** Distinct proveedores that supplied any SKU in this fraccion. */
  proveedor_names: string[]
  /** Distinct traficos that carried any SKU in this fraccion (up to 8
   *  most-recent). Each element is the cve_trafico for deep-linking. */
  recent_traficos: string[]
  last_trafico: string | null
  last_fecha: string | null
  /** Heuristic — the group's fracción chapter is in the T-MEC-likely
   *  set. Same rule as the per-SKU snapshot. */
  tmec_eligible_heuristic: boolean
  /** Top 5 SKUs by usage, for quick peek inside the group before
   *  drilling to /catalogo/fraccion/[code]. */
  top_skus: Array<{
    cve_producto: string | null
    descripcion: string
    veces_importado: number
    valor_ytd_usd: number | null
    proveedor_nombre: string | null
    pais_origen: string | null
  }>
}

const TMEC_LIKELY_CHAPTERS = new Set<string>([
  '39', '40', '72', '73', '76', '84', '85', '87', '90',
])

function chapter(fraccion: string): string | null {
  const digits = fraccion.replace(/\D/g, '')
  return digits.length >= 2 ? digits.slice(0, 2) : null
}

function formatFrac(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 8) return digits.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3')
  if (digits.length === 10) return digits.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})$/, '$1.$2.$3.$4')
  return raw
}

function toNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export interface ByFraccionSnapshot {
  groups: AnexoFraccionGroup[]
  total_skus_in_scope: number
  total_unclassified: number
  fraccion_count: number
  client_name: string
  company_id: string
}

export async function getAnexoByFraccion(
  supabase: AnyClient,
  companyId: string,
  opts: { q?: string; limit?: number } = {},
): Promise<ByFraccionSnapshot> {
  if (!companyId) {
    return {
      groups: [],
      total_skus_in_scope: 0,
      total_unclassified: 0,
      fraccion_count: 0,
      client_name: '',
      company_id: '',
    }
  }

  const limit = Math.min(Math.max(opts.limit ?? 2000, 1), 5000)
  const q = (opts.q ?? '').trim()

  // Active-parts filter — same contract as the SKU snapshot. Only
  // parts this company has actually imported feed the fracción
  // grouping. Without this, fracciones would contain noise SKUs that
  // drag down the primary_description picker and inflate sku_count.
  const active = await getActiveCveProductos(supabase, companyId)
  const activeList = activeCvesArray(active)
  const hasActive = activeList.length > 0

  // Classified-only SKU fetch, capped at 2000. With 693 used-in-24-months
  // for EVCO (per CLAUDE.md), this covers most clients' active fraction
  // set without materialized views.
  let productoQuery = supabase
    .from('globalpc_productos')
    .select('id, cve_producto, descripcion, fraccion, cve_proveedor, pais_origen')
    .eq('company_id', companyId)
    .not('fraccion', 'is', null)
    .order('fraccion_classified_at', { ascending: false, nullsFirst: false })
    .order('cve_producto', { ascending: true })
    .limit(limit)
  if (hasActive) productoQuery = productoQuery.in('cve_producto', activeList)

  if (q.length > 0) {
    const safe = q.replace(/[%_]/g, '')
    productoQuery = productoQuery.or(
      `descripcion.ilike.%${safe}%,fraccion.ilike.%${safe}%,cve_producto.ilike.%${safe}%`,
    )
  }

  const [productosRes, totalInScopeRes, unclassifiedRes] = await Promise.all([
    productoQuery,
    hasActive
      ? supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('cve_producto', activeList).not('fraccion', 'is', null)
      : supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('fraccion', 'is', null).limit(0),
    hasActive
      ? supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('cve_producto', activeList).is('fraccion', null)
      // allowlist-ok:globalpc_productos — zero-active-parts fallback via .limit(0).
      : supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('fraccion', null).limit(0),
  ])

  const productos = (productosRes.data ?? []) as Array<{
    id: string | number
    cve_producto: string | null
    descripcion: string | null
    fraccion: string | null
    cve_proveedor: string | null
    pais_origen: string | null
  }>

  // Canonical overlay (Phase 3 feature flag) — replaces description +
  // fraccion with Formato 53 truth when flag + row present.
  const overlay = await loadAnexo24Overlay(
    supabase,
    companyId,
    productos.map((p) => p.cve_producto),
  )
  const canonicalEnabled = isAnexo24CanonicalEnabled()

  // Resolve proveedor names for the grouped set.
  const proveedorIds = Array.from(new Set(productos.map((p) => p.cve_proveedor).filter((x): x is string => !!x)))
  const proveedorMap = new Map<string, string>()
  if (proveedorIds.length > 0) {
    const { data: provRows } = await supabase
      .from('globalpc_proveedores')
      .select('cve_proveedor, nombre')
      .eq('company_id', companyId)
      .in('cve_proveedor', proveedorIds)
    for (const p of (provRows ?? [])) {
      if (p.cve_proveedor && p.nombre) proveedorMap.set(p.cve_proveedor, p.nombre)
    }
  }

  // Partida aggregate — usage count + YTD value + last trafico,
  // joined by cve_producto (direct) instead of descripcion so we
  // don't miss parts whose descripcion differs between productos and
  // partidas (a very common drift that the Phase 3 canonical helper
  // will eliminate entirely).
  const cveProductos = Array.from(new Set(productos.map((p) => p.cve_producto).filter((x): x is string => !!x)))
  const aggByCve = new Map<string, {
    count: number
    valor: number
    lastTrafico: string | null
    lastFecha: string | null
    traficos: Map<string, string>
  }>()
  if (cveProductos.length > 0) {
    const thisYearStart = `${new Date().getUTCFullYear()}-01-01`
    const { data: partidaRows } = await supabase
      .from('globalpc_partidas')
      .select('cve_producto, cve_trafico, valor_comercial, fecha_llegada')
      .eq('company_id', companyId)
      .in('cve_producto', cveProductos)
      .gte('fecha_llegada', thisYearStart)
      .limit(20_000)
    for (const row of (partidaRows ?? [])) {
      const cve = row.cve_producto as string | null
      if (!cve) continue
      const entry = aggByCve.get(cve) ?? { count: 0, valor: 0, lastTrafico: null, lastFecha: null, traficos: new Map<string, string>() }
      entry.count += 1
      entry.valor += toNumber(row.valor_comercial)
      if (row.fecha_llegada && (!entry.lastFecha || row.fecha_llegada > entry.lastFecha)) {
        entry.lastFecha = row.fecha_llegada
        entry.lastTrafico = row.cve_trafico
      }
      if (row.cve_trafico && row.fecha_llegada) {
        const prev = entry.traficos.get(row.cve_trafico)
        if (!prev || row.fecha_llegada > prev) entry.traficos.set(row.cve_trafico, row.fecha_llegada)
      }
      aggByCve.set(cve, entry)
    }
  }

  // Group by resolved fracción.
  type GroupInProgress = {
    variants: Array<{
      cve_producto: string | null
      descripcion: string
      veces: number
      valor: number
      proveedor_nombre: string | null
      pais_origen: string | null
    }>
    total_imports: number
    total_valor: number
    hasValor: boolean
    proveedores: Set<string>
    traficoDates: Map<string, string>
    lastTrafico: string | null
    lastFecha: string | null
  }
  const byFrac = new Map<string, GroupInProgress>()

  for (const p of productos) {
    const cve = p.cve_producto
    const canonical = canonicalEnabled && cve ? overlay.get(cve) : undefined
    const resolvedFraccion = canonical?.fraccion_official ?? p.fraccion ?? ''
    if (!resolvedFraccion) continue
    const resolvedDesc = canonical?.merchandise_name_official ?? p.descripcion ?? ''
    // Never surface raw PRV_#### codes — route every proveedor through
    // the canonical name resolver.
    const proveedorName = resolveProveedorName(
      p.cve_proveedor,
      p.cve_proveedor ? proveedorMap.get(p.cve_proveedor) : null,
    )
    const agg = cve ? aggByCve.get(cve) : undefined

    const gp = byFrac.get(resolvedFraccion) ?? {
      variants: [],
      total_imports: 0,
      total_valor: 0,
      hasValor: false,
      proveedores: new Set<string>(),
      traficoDates: new Map<string, string>(),
      lastTrafico: null as string | null,
      lastFecha: null as string | null,
    }
    gp.variants.push({
      cve_producto: cve,
      descripcion: resolvedDesc,
      veces: agg?.count ?? 0,
      valor: agg?.valor ?? 0,
      proveedor_nombre: proveedorName,
      pais_origen: canonical?.pais_origen_official ?? p.pais_origen ?? null,
    })
    gp.total_imports += agg?.count ?? 0
    if (agg && agg.valor > 0) {
      gp.total_valor += agg.valor
      gp.hasValor = true
    }
    if (proveedorName) gp.proveedores.add(proveedorName)
    if (agg?.traficos) {
      for (const [trafico, date] of agg.traficos) {
        const prev = gp.traficoDates.get(trafico)
        if (!prev || date > prev) gp.traficoDates.set(trafico, date)
      }
    }
    if (agg?.lastFecha && (!gp.lastFecha || agg.lastFecha > gp.lastFecha)) {
      gp.lastFecha = agg.lastFecha
      gp.lastTrafico = agg.lastTrafico
    }
    byFrac.set(resolvedFraccion, gp)
  }

  // Compose final groups — sorted by variant count desc then usage.
  const groups: AnexoFraccionGroup[] = []
  for (const [fraccion, gp] of byFrac) {
    const ch = chapter(fraccion)
    const recentTraficos = Array.from(gp.traficoDates.entries())
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, 8)
      .map(([trafico]) => trafico)
    const topSkus = [...gp.variants]
      .sort((a, b) => (b.veces - a.veces) || (b.descripcion.length - a.descripcion.length))
      .slice(0, 5)
      .map((v) => ({
        cve_producto: v.cve_producto,
        descripcion: v.descripcion,
        veces_importado: v.veces,
        valor_ytd_usd: v.valor > 0 ? Math.round(v.valor * 100) / 100 : null,
        proveedor_nombre: v.proveedor_nombre,
        pais_origen: v.pais_origen,
      }))
    const primaryDesc = topSkus[0]?.descripcion || gp.variants[0]?.descripcion || 'Sin descripción'
    groups.push({
      fraccion,
      fraccion_formatted: formatFrac(fraccion),
      primary_description: primaryDesc,
      sku_count: gp.variants.length,
      total_imports: gp.total_imports,
      total_valor_ytd_usd: gp.hasValor ? Math.round(gp.total_valor * 100) / 100 : null,
      proveedor_names: Array.from(gp.proveedores).sort(),
      recent_traficos: recentTraficos,
      last_trafico: gp.lastTrafico,
      last_fecha: gp.lastFecha,
      tmec_eligible_heuristic: ch ? TMEC_LIKELY_CHAPTERS.has(ch) : false,
      top_skus: topSkus,
    })
  }
  groups.sort((a, b) => {
    if (b.sku_count !== a.sku_count) return b.sku_count - a.sku_count
    return b.total_imports - a.total_imports
  })

  return {
    groups,
    total_skus_in_scope: totalInScopeRes.count ?? productos.length,
    total_unclassified: unclassifiedRes.count ?? 0,
    fraccion_count: groups.length,
    client_name: '',
    company_id: companyId,
  }
}
