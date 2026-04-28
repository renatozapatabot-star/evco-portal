/**
 * CRUZ · V1.5 F15 — Smart Embarque Suggestions.
 *
 * Given a prefix typed into a "new embarque" form, surface the cliente
 * records that match by name (or clave_cliente) and aggregate their
 * historical embarque patterns so the operator can one-tap pre-fill the
 * form with sensible defaults: typical fracción, supplier, UMC, operator,
 * and average factura value.
 *
 * Contract:
 *   - Pure reader. Never writes. Never throws.
 *   - Defense-in-depth: every query is scoped by `company_id` when the
 *     caller supplies one (operators see their own roster of clientes;
 *     tenant admins pass null to scope company-wide).
 *   - Returns null fields gracefully when a cliente has no history —
 *     the UI should treat those as "no default, let the operator type".
 *
 * Aggregation strategy (keeps N+1 bounded at `limit`):
 *   1. Match up to `limit` clientes by prefix (case-insensitive, sorted
 *      by most-recently-active).
 *   2. For each match, run 4 bounded queries in parallel:
 *        a. last 10 traficos → lastTraficoAt, avgValue, currency (mode),
 *           trafico ids, trafico count total
 *        b. partidas joined to those traficos → typicalFraccion, typicalUmc
 *        c. workflow_events on those traficos → typicalOperator
 *        d. facturas on those traficos → typicalSupplier
 *   3. Fan-out is `limit ≤ 5`, fan-in is 4 queries per cliente → ≤ 20
 *      queries total. Each query is bounded by `.limit()`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

export interface TraficoSuggestion {
  clienteId: string
  nombre: string
  rfc: string | null
  lastTraficoAt: string | null
  diasDesdeUltimo: number | null
  avgValue: number | null
  currency: 'MXN' | 'USD' | null
  typicalFraccion: string | null
  typicalOperator: { id: string; name: string } | null
  typicalSupplier: string | null
  typicalUmc: string | null
  traficoCountTotal: number
}

interface CompanyRow {
  company_id: string
  name: string | null
  clave_cliente: string | null
  rfc: string | null
  created_at: string | null
}

interface TraficoRow {
  // traficos real columns: id + trafico (the ref string), created_at,
  // assigned_to_operator_id. `cve_trafico` was a phantom.
  id: string | null
  trafico: string | null
  created_at: string | null
  assigned_to_operator_id: string | null
}

interface FacturaRow {
  // globalpc_facturas real columns: folio, cve_trafico, cve_proveedor,
  // valor_comercial, moneda. The legacy iValorComercial/sCveMoneda/
  // sCveProveedor/nombre_proveedor names were MySQL source fields that
  // never got mirrored to Supabase under those names.
  folio: number | null
  cve_trafico: string | null
  cve_proveedor: string | null
  valor_comercial: number | null
  moneda: string | null
}

interface PartidaRow {
  // globalpc_partidas has NO cve_trafico, fraccion_arancelaria, cve_umc,
  // or umc. Real join: folio (→ facturas) + cve_producto (→ productos for
  // the fraccion + umt enrichment).
  folio: number | null
  cve_producto: string | null
}

interface ProductoRow {
  cve_producto: string | null
  fraccion: string | null
  umt: string | null
}

interface ProveedorRow {
  cve_proveedor: string | null
  nombre: string | null
}

interface OperatorRow {
  id: string
  full_name: string | null
}

/**
 * Safe select wrapper — degrades to [] on any failure so one missing
 * table doesn't break the aggregate.
 */
async function safeSelect<T>(
  run: () => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  try {
    const { data, error } = await run()
    if (error) return []
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.floor((Date.now() - ms) / 86_400_000))
}

/**
 * Return the single most common string value in an array, or null if empty.
 * Ignores null/empty strings. Deterministic on ties by insertion order.
 */
export function mode<T extends string>(values: (T | null | undefined)[]): T | null {
  const counts = new Map<T, number>()
  for (const v of values) {
    if (!v) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  let best: T | null = null
  let bestCount = 0
  for (const [k, c] of counts) {
    if (c > bestCount) {
      best = k
      bestCount = c
    }
  }
  return best
}

function safeCurrency(raw: string | null): 'MXN' | 'USD' | null {
  if (raw === 'MXN' || raw === 'USD') return raw
  return null
}

function safePrefix(raw: string): string {
  // Escape Postgres ilike wildcards so a cliente typing "%" or "_" doesn't
  // run a full scan. Trim whitespace. Preserve case — ilike is case-insensitive.
  return raw.replace(/[%_\\]/g, '\\$&').trim()
}

export const MAX_LIMIT = 10

/**
 * Clamp a prefix limit into [1, MAX_LIMIT]. Defaults to 5.
 */
export function clampLimit(raw: number | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return 5
  const n = Math.floor(raw)
  if (n < 1) return 1
  if (n > MAX_LIMIT) return MAX_LIMIT
  return n
}

/**
 * Suggest cliente pre-fill patterns for a new-embarque form.
 */
export async function suggestClientePatterns(
  supabase: AnyClient,
  companyIdOrNull: string | null,
  prefix: string,
  limit: number = 5,
): Promise<TraficoSuggestion[]> {
  const safe = safePrefix(prefix)
  if (safe.length < 3) return []

  const bounded = clampLimit(limit)

  // 1) Match candidate clientes by prefix. Cliente-scoped portals pin
  //    to their own company; broker/admin portals scope by auth but
  //    still surface only active companies.
  // companies real columns: name (not razon_social), created_at (no
  // updated_at on this table).
  let companyQ = supabase
    .from('companies')
    .select('company_id, name, clave_cliente, rfc, created_at')
    .or(`name.ilike.${safe}%,clave_cliente.ilike.${safe}%`)
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(20)

  if (companyIdOrNull) companyQ = companyQ.eq('company_id', companyIdOrNull)

  const companies = await safeSelect<CompanyRow>(() => companyQ)
  if (companies.length === 0) return []

  const top = companies.slice(0, bounded)

  // 2) For each candidate, aggregate patterns in parallel.
  const results = await Promise.all(
    top.map(async (c): Promise<TraficoSuggestion> => {
      const nombre = c.name ?? c.clave_cliente ?? c.company_id

      // Last 10 traficos for this cliente — ordered by recency.
      const traficos = await safeSelect<TraficoRow>(() =>
        supabase
          .from('traficos')
          .select('id, trafico, created_at, assigned_to_operator_id')
          .eq('company_id', c.company_id)
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(10),
      )

      if (traficos.length === 0) {
        return {
          clienteId: c.company_id,
          nombre,
          rfc: c.rfc,
          lastTraficoAt: null,
          diasDesdeUltimo: null,
          avgValue: null,
          currency: null,
          typicalFraccion: null,
          typicalOperator: null,
          typicalSupplier: null,
          typicalUmc: null,
          traficoCountTotal: 0,
        }
      }

      const lastTraficoAt = traficos[0]?.created_at ?? null
      const traficoIds = traficos
        .map((t) => t.trafico)
        .filter((x): x is string => !!x)

      // Factura aggregation (value + currency + supplier code).
      const facturas =
        traficoIds.length > 0
          ? await safeSelect<FacturaRow>(() =>
              supabase
                .from('globalpc_facturas')
                .select('folio, cve_trafico, cve_proveedor, valor_comercial, moneda')
                .eq('company_id', c.company_id)
                .in('cve_trafico', traficoIds)
                .limit(200),
            )
          : []

      const values = facturas
        .map((f) => (f.valor_comercial != null ? Number(f.valor_comercial) : null))
        .filter((v): v is number => v != null && Number.isFinite(v))
      const avgValue =
        values.length > 0
          ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
          : null
      const currency = safeCurrency(mode(facturas.map((f) => f.moneda)))

      // Resolve supplier name via globalpc_proveedores (facturas only
      // carries the code). Fall back to the code if no row.
      const proveedorCodes = Array.from(
        new Set(facturas.map((f) => f.cve_proveedor).filter((x): x is string => !!x)),
      )
      const proveedores =
        proveedorCodes.length > 0
          ? await safeSelect<ProveedorRow>(() =>
              supabase
                .from('globalpc_proveedores')
                .select('cve_proveedor, nombre')
                .eq('company_id', c.company_id)
                .in('cve_proveedor', proveedorCodes)
                .limit(100),
            )
          : []
      const proveedorNombreByCode = new Map<string, string>()
      for (const p of proveedores) {
        if (p.cve_proveedor && p.nombre) proveedorNombreByCode.set(p.cve_proveedor, p.nombre)
      }
      const topProveedorCode = mode(facturas.map((f) => f.cve_proveedor))
      const typicalSupplier = topProveedorCode
        ? proveedorNombreByCode.get(topProveedorCode) ?? topProveedorCode
        : null

      // Partidas aggregation (fracción + UMC). 3-hop join:
      // traficoIds → facturas.folio → partidas → productos(fraccion + umt).
      const folios = Array.from(
        new Set(facturas.map((f) => f.folio).filter((f): f is number => f != null)),
      )
      const partidas =
        folios.length > 0
          ? await safeSelect<PartidaRow>(() =>
              supabase
                .from('globalpc_partidas')
                .select('folio, cve_producto')
                .eq('company_id', c.company_id)
                .in('folio', folios)
                .limit(500),
            )
          : []

      const cves = Array.from(
        new Set(partidas.map((p) => p.cve_producto).filter((c): c is string => !!c)),
      )
      const productos =
        cves.length > 0
          ? await safeSelect<ProductoRow>(() =>
              supabase
                .from('globalpc_productos')
                .select('cve_producto, fraccion, umt')
                .eq('company_id', c.company_id)
                .in('cve_producto', cves)
                .limit(500),
            )
          : []
      const productoByCve = new Map<string, ProductoRow>()
      for (const p of productos) {
        if (p.cve_producto) productoByCve.set(p.cve_producto, p)
      }

      const fracciones = partidas
        .map((p) => (p.cve_producto ? productoByCve.get(p.cve_producto)?.fraccion ?? null : null))
      const umts = partidas
        .map((p) => (p.cve_producto ? productoByCve.get(p.cve_producto)?.umt ?? null : null))
      const typicalFraccion = mode(fracciones)
      const typicalUmc = mode(umts)

      // Operator aggregation — prefer assigned_to_operator_id on the embarque
      // itself; workflow_events fallback not reliable without actor column.
      const operatorIds = traficos
        .map((t) => t.assigned_to_operator_id)
        .filter((x): x is string => !!x)
      const topOperatorId = mode(operatorIds)
      let typicalOperator: { id: string; name: string } | null = null
      if (topOperatorId) {
        const opRows = await safeSelect<OperatorRow>(() =>
          supabase
            .from('operators')
            .select('id, full_name')
            .eq('id', topOperatorId)
            .limit(1),
        )
        const op = opRows[0]
        typicalOperator = {
          id: topOperatorId,
          name: op?.full_name ?? topOperatorId,
        }
      }

      return {
        clienteId: c.company_id,
        nombre,
        rfc: c.rfc,
        lastTraficoAt,
        diasDesdeUltimo: daysSince(lastTraficoAt),
        avgValue,
        currency,
        typicalFraccion,
        typicalOperator,
        typicalSupplier,
        typicalUmc,
        traficoCountTotal: traficos.length,
      }
    }),
  )

  return results
}
