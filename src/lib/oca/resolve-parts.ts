/**
 * PORTAL · OCA Classifier — auto-resolver.
 *
 * Given a list of parts extracted from an invoice, decide for each:
 *   - resolved:             we know the fracción already (SAT-filed or
 *                           Tito-signed). Don't send to Opus.
 *   - needs_classification: no match — send to Opus for a formal OCA.
 *   - disputed:             multiple sources disagree — Tito must decide.
 *
 * Priority order (highest confidence first):
 *   1. anexo24_numeros_parte      — SAT-filed, already cleared customs
 *                                   (confidence 1.00)
 *   2. oca_database (approved)    — Tito previously signed this NP
 *                                   (confidence 0.95)
 *   3. classification_log.supertito_agreed=true
 *                                 — Tito reviewed + agreed in a prior
 *                                   pass (confidence 0.90)
 *   4. globalpc_productos.fraccion non-null
 *                                 — Qwen/Haiku auto-classifier suggested
 *                                   (confidence 0.70 — below Tito threshold)
 *   5. no match                   — needs_classification (confidence 0.00)
 *
 * Tenant isolation (Block EE contract):
 *   - role='client'   → only the caller's own company_id is queried.
 *                       Cross-tenant matches never surface.
 *   - role='admin'|'broker' → cross-tenant matches included, each marked
 *                       `cross_tenant: true` so Tito sees "this same
 *                       cve was classified for a different client."
 *   - role='operator' → same as client (tenant-scoped), by convention.
 *
 * Pure function from DB rows. Tests mock the Supabase client.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { InvoicePart } from './invoice-extract'

export type ResolveVerdict = 'resolved' | 'needs_classification' | 'disputed'

export type ResolveSourceTable =
  | 'anexo24'
  | 'oca_database'
  | 'classification_log'
  | 'globalpc_productos'

export interface ResolveSourceRef {
  table: ResolveSourceTable
  fraccion: string | null
  nico: string | null
  descripcion: string | null
  confidence: number
  cross_tenant: boolean
  detail: string | null
}

export interface ResolvedPart {
  item_no: string
  description: string | null
  verdict: ResolveVerdict
  fraccion: string | null
  nico: string | null
  confidence: number
  sources: ResolveSourceRef[]
}

export type CallerRole = 'admin' | 'broker' | 'operator' | 'client'

export interface ResolveContext {
  companyId: string
  role: CallerRole
}

type NormalizedFraccion = string | null

function normalizeFraccion(raw: string | null | undefined): NormalizedFraccion {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Preserve dots — HARD invariant #8. XXXX.XX.XX or XXXX.XX shapes only.
  if (/^\d{4}\.\d{2}(\.\d{2})?$/.test(trimmed)) return trimmed
  return trimmed
}

function sourceConfidence(table: ResolveSourceTable): number {
  switch (table) {
    case 'anexo24': return 1.0
    case 'oca_database': return 0.95
    case 'classification_log': return 0.9
    case 'globalpc_productos': return 0.7
  }
}

/**
 * Pick the winning fracción from sources. All fracciones agree →
 * resolved. Any disagreement on the (XXXX.XX.XX) granular level →
 * disputed (Tito decides). No sources at all → needs_classification.
 */
export function decideVerdict(sources: ResolveSourceRef[]): {
  verdict: ResolveVerdict
  fraccion: string | null
  nico: string | null
  confidence: number
} {
  if (sources.length === 0) {
    return { verdict: 'needs_classification', fraccion: null, nico: null, confidence: 0 }
  }

  // De-dupe on (table, fraccion, nico) to avoid one table dominating.
  const byFraccion = new Map<string, ResolveSourceRef[]>()
  for (const s of sources) {
    if (!s.fraccion) continue
    const key = s.fraccion
    const bucket = byFraccion.get(key) ?? []
    bucket.push(s)
    byFraccion.set(key, bucket)
  }

  if (byFraccion.size === 0) {
    return { verdict: 'needs_classification', fraccion: null, nico: null, confidence: 0 }
  }

  const withFraccion = sources.filter((s) => s.fraccion != null)
  const best = withFraccion.reduce((a, b) => (b.confidence > a.confidence ? b : a))

  if (byFraccion.size > 1) {
    // Multiple fracciones seen across sources — conflict. Tito decides.
    return {
      verdict: 'disputed',
      fraccion: best.fraccion,
      nico: best.nico,
      confidence: best.confidence,
    }
  }

  // All sources agree on one fracción. Winner = highest-confidence source
  // among the agreeing ones (usually anexo24 wins, Tito next, etc.).
  return {
    verdict: 'resolved',
    fraccion: best.fraccion,
    nico: best.nico,
    confidence: best.confidence,
  }
}

interface Anexo24Row {
  company_id: string | null
  numero_parte: string
  fraccion: string | null
  descripcion: string | null
}

interface OcaRow {
  id: string
  company_id: string | null
  np_code: string | null
  fraccion_recomendada: string | null
  nico: string | null
  opinion_number: string | null
}

interface ClassLogRow {
  client_id: string | null
  numero_parte: string | null
  fraccion_assigned: string | null
  supertito_agreed: boolean | null
  ts: string | null
}

interface GlobalpcProductoRow {
  company_id: string | null
  cve_producto: string | null
  fraccion: string | null
  nico: string | null
  fraccion_classified_at: string | null
  descripcion: string | null
}

function matchesTenant(rowCompany: string | null, ctx: ResolveContext): boolean {
  return rowCompany === ctx.companyId
}

function includeCrossTenant(ctx: ResolveContext): boolean {
  return ctx.role === 'admin' || ctx.role === 'broker'
}

function rowsForItem<T extends { numero_parte?: string | null; cve_producto?: string | null; np_code?: string | null }>(
  rows: T[],
  itemNo: string,
): T[] {
  return rows.filter((r) => {
    const candidate = r.numero_parte ?? r.cve_producto ?? r.np_code ?? null
    return candidate === itemNo
  })
}

/**
 * Resolve a batch of extracted invoice parts against the four ground-truth
 * tables. Returns one ResolvedPart per input, in the same order. Never
 * throws — missing tables / errors degrade silently to needs_classification
 * (matching the soft-query pattern on cockpit SSR).
 */
export async function resolveInvoiceParts(
  supabase: SupabaseClient,
  parts: Pick<InvoicePart, 'item_no' | 'description'>[],
  ctx: ResolveContext,
): Promise<ResolvedPart[]> {
  const itemNos = parts
    .map((p) => p.item_no)
    .filter((s): s is string => typeof s === 'string' && s.length > 0)

  if (itemNos.length === 0) {
    return parts.map((p) => ({
      item_no: p.item_no ?? '',
      description: p.description ?? null,
      verdict: 'needs_classification' as const,
      fraccion: null,
      nico: null,
      confidence: 0,
      sources: [],
    }))
  }

  const crossTenant = includeCrossTenant(ctx)

  // Query all four sources in parallel. Each query is forgiving: on error
  // we log + default to [] and continue. The resolver degrades but never
  // crashes.
  const [anexo24, oca, classLog, productos] = await Promise.all([
    queryAnexo24(supabase, itemNos, ctx, crossTenant),
    queryOcaDatabase(supabase, itemNos, ctx, crossTenant),
    queryClassificationLog(supabase, itemNos, ctx, crossTenant),
    queryGlobalpcProductos(supabase, itemNos, ctx, crossTenant),
  ])

  return parts.map((p) => {
    const itemNo = p.item_no ?? ''
    if (!itemNo) {
      return {
        item_no: '', description: p.description ?? null,
        verdict: 'needs_classification' as const,
        fraccion: null, nico: null, confidence: 0, sources: [],
      }
    }

    const sources: ResolveSourceRef[] = []

    for (const row of rowsForItem(anexo24, itemNo)) {
      const fraccion = normalizeFraccion(row.fraccion)
      if (!fraccion) continue
      sources.push({
        table: 'anexo24',
        fraccion,
        nico: null,
        descripcion: row.descripcion ?? null,
        confidence: sourceConfidence('anexo24'),
        cross_tenant: !matchesTenant(row.company_id, ctx),
        detail: 'SAT-filed pedimento',
      })
    }

    for (const row of rowsForItem(oca, itemNo)) {
      const fraccion = normalizeFraccion(row.fraccion_recomendada)
      if (!fraccion) continue
      sources.push({
        table: 'oca_database',
        fraccion,
        nico: row.nico ?? null,
        descripcion: null,
        confidence: sourceConfidence('oca_database'),
        cross_tenant: !matchesTenant(row.company_id, ctx),
        detail: row.opinion_number ?? 'OCA previa',
      })
    }

    for (const row of rowsForItem(classLog, itemNo)) {
      if (!row.supertito_agreed) continue
      const fraccion = normalizeFraccion(row.fraccion_assigned)
      if (!fraccion) continue
      sources.push({
        table: 'classification_log',
        fraccion,
        nico: null,
        descripcion: null,
        confidence: sourceConfidence('classification_log'),
        cross_tenant: !matchesTenant(row.client_id, ctx),
        detail: 'Revisado por Tito',
      })
    }

    for (const row of rowsForItem(productos, itemNo)) {
      const fraccion = normalizeFraccion(row.fraccion)
      if (!fraccion) continue
      // Only counts when the classifier actually ran (fraccion_classified_at).
      if (!row.fraccion_classified_at) continue
      sources.push({
        table: 'globalpc_productos',
        fraccion,
        nico: row.nico ?? null,
        descripcion: row.descripcion ?? null,
        confidence: sourceConfidence('globalpc_productos'),
        cross_tenant: !matchesTenant(row.company_id, ctx),
        detail: 'Auto-clasificado (Qwen/Haiku)',
      })
    }

    const { verdict, fraccion, nico, confidence } = decideVerdict(sources)
    return {
      item_no: itemNo,
      description: p.description ?? null,
      verdict,
      fraccion,
      nico,
      confidence,
      sources,
    }
  })
}

async function queryAnexo24(
  supabase: SupabaseClient,
  itemNos: string[],
  ctx: ResolveContext,
  crossTenant: boolean,
): Promise<Anexo24Row[]> {
  try {
    let q = supabase
      .from('anexo24_numeros_parte')
      .select('company_id, numero_parte, fraccion, descripcion')
      .in('numero_parte', itemNos)
      .limit(500)
    if (!crossTenant) q = q.eq('company_id', ctx.companyId)
    const { data, error } = await q
    if (error) return []
    return (data ?? []) as Anexo24Row[]
  } catch {
    return []
  }
}

async function queryOcaDatabase(
  supabase: SupabaseClient,
  itemNos: string[],
  ctx: ResolveContext,
  crossTenant: boolean,
): Promise<OcaRow[]> {
  try {
    let q = supabase
      .from('oca_database')
      .select('id, company_id, np_code, fraccion_recomendada, nico, opinion_number')
      .in('np_code', itemNos)
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(500)
    if (!crossTenant) q = q.eq('company_id', ctx.companyId)
    const { data, error } = await q
    if (error) return []
    return (data ?? []) as OcaRow[]
  } catch {
    return []
  }
}

async function queryClassificationLog(
  supabase: SupabaseClient,
  itemNos: string[],
  ctx: ResolveContext,
  crossTenant: boolean,
): Promise<ClassLogRow[]> {
  try {
    let q = supabase
      .from('classification_log')
      .select('client_id, numero_parte, fraccion_assigned, supertito_agreed, ts')
      .in('numero_parte', itemNos)
      .eq('supertito_agreed', true)
      .order('ts', { ascending: false })
      .limit(500)
    if (!crossTenant) q = q.eq('client_id', ctx.companyId)
    const { data, error } = await q
    if (error) return []
    return (data ?? []) as ClassLogRow[]
  } catch {
    return []
  }
}

async function queryGlobalpcProductos(
  supabase: SupabaseClient,
  itemNos: string[],
  ctx: ResolveContext,
  crossTenant: boolean,
): Promise<GlobalpcProductoRow[]> {
  try {
    let q = supabase
      .from('globalpc_productos')
      .select('company_id, cve_producto, fraccion, nico, fraccion_classified_at, descripcion')
      .in('cve_producto', itemNos)
      .not('fraccion', 'is', null)
      .limit(500)
    if (!crossTenant) q = q.eq('company_id', ctx.companyId)
    const { data, error } = await q
    if (error) return []
    return (data ?? []) as GlobalpcProductoRow[]
  } catch {
    return []
  }
}
