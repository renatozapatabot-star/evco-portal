/**
 * ZAPATA AI · V1.5 F15 — Smart Embarque Suggestions.
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
  razon_social: string | null
  name: string | null
  clave_cliente: string | null
  rfc: string | null
  updated_at: string | null
}

interface TraficoRow {
  id: string | null
  cve_trafico: string | null
  created_at: string | null
  assigned_to_operator_id: string | null
}

interface FacturaRow {
  cve_trafico: string | null
  iValorComercial: number | null
  sCveMoneda: string | null
  sCveProveedor: string | null
  nombre_proveedor: string | null
}

interface PartidaRow {
  cve_trafico: string | null
  fraccion_arancelaria: string | null
  cve_umc: string | null
  umc: string | null
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
  let companyQ = supabase
    .from('companies')
    .select('company_id, razon_social, name, clave_cliente, rfc, updated_at')
    .or(
      `razon_social.ilike.${safe}%,name.ilike.${safe}%,clave_cliente.ilike.${safe}%`,
    )
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(20)

  if (companyIdOrNull) companyQ = companyQ.eq('company_id', companyIdOrNull)

  const companies = await safeSelect<CompanyRow>(() => companyQ)
  if (companies.length === 0) return []

  const top = companies.slice(0, bounded)

  // 2) For each candidate, aggregate patterns in parallel.
  const results = await Promise.all(
    top.map(async (c): Promise<TraficoSuggestion> => {
      const nombre = c.razon_social ?? c.name ?? c.clave_cliente ?? c.company_id

      // Last 10 traficos for this cliente — ordered by recency.
      const traficos = await safeSelect<TraficoRow>(() =>
        supabase
          .from('traficos')
          .select('id, cve_trafico, created_at, assigned_to_operator_id')
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
      const cveTraficos = traficos
        .map((t) => t.cve_trafico)
        .filter((x): x is string => !!x)

      // Factura aggregation (value + currency + supplier).
      const facturas =
        cveTraficos.length > 0
          ? await safeSelect<FacturaRow>(() =>
              supabase
                .from('globalpc_facturas')
                .select(
                  'cve_trafico, iValorComercial, sCveMoneda, sCveProveedor, nombre_proveedor',
                )
                .in('cve_trafico', cveTraficos)
                .limit(200),
            )
          : []

      const values = facturas
        .map((f) => (f.iValorComercial != null ? Number(f.iValorComercial) : null))
        .filter((v): v is number => v != null && Number.isFinite(v))
      const avgValue =
        values.length > 0
          ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
          : null
      const currency = safeCurrency(mode(facturas.map((f) => f.sCveMoneda)))
      const typicalSupplier =
        mode(facturas.map((f) => f.nombre_proveedor)) ??
        mode(facturas.map((f) => f.sCveProveedor))

      // Partidas aggregation (fracción + UMC).
      const partidas =
        cveTraficos.length > 0
          ? await safeSelect<PartidaRow>(() =>
              supabase
                .from('globalpc_partidas')
                .select('cve_trafico, fraccion_arancelaria, cve_umc, umc')
                .in('cve_trafico', cveTraficos)
                .limit(500),
            )
          : []

      const typicalFraccion = mode(partidas.map((p) => p.fraccion_arancelaria))
      const typicalUmc =
        mode(partidas.map((p) => p.umc)) ?? mode(partidas.map((p) => p.cve_umc))

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
