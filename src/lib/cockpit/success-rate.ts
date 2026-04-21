/**
 * Success-rate computation — the "Tasa de éxito" hero tile.
 *
 * Why this lives in its own file: the parameters (maturity window +
 * minimum-sample floor) are load-bearing for what Ursula sees. If the
 * numbers drift, either she sees a too-low rate (in-flight tráficos
 * counted against the broker) or a too-high rate (stuck shipments
 * hidden by premature filtering). Both break the trust contract.
 *
 * Canonical thresholds — reuse these constants rather than redefining.
 */

export const SUCCESS_RATE_MATURITY_DAYS = 14
export const SUCCESS_RATE_MIN_SAMPLES = 10

/**
 * A tráfico is "successful" when it reaches any terminal state
 * downstream of SAT acceptance. Why this set:
 *
 *   Cruzado / E1 / Entregado   — physical crossing signals
 *   Pedimento Pagado            — SAT accepted, payment cleared. The
 *                                 broker's work is done; physical
 *                                 crossing is logistics from there.
 *   Desaduanado                 — alternate terminal used by some
 *                                 clients' sync pipelines.
 *
 * Estatus strings lag behind fecha_cruce by up to a business day, so
 * we also treat `fecha_cruce IS NOT NULL` as authoritative — whichever
 * signal is present first wins.
 */
const SUCCESS_ESTATUSES = new Set([
  'Cruzado', 'E1', 'Entregado', 'Pedimento Pagado', 'Desaduanado',
])

export interface SuccessRateRow {
  estatus: string | null
  fecha_llegada: string | null
  fecha_cruce?: string | null
}

export interface SuccessRateOptions {
  /** Now timestamp (ms). Injected for deterministic tests. */
  now?: number
  maturityDays?: number
  minSamples?: number
}

/**
 * Return the broker-success rate as a whole-number percentage, or null
 * when the sample is too small / too young to be meaningful.
 *
 * Numerator: mature tráficos that reached a success milestone — either
 *   `fecha_cruce` populated (physically crossed) or `estatus` in the
 *   SUCCESS_ESTATUSES set (pedimento paid → broker's work complete).
 *   Whichever signal lands first wins; this tolerates the ~business-
 *   day lag between physical crossing and estatus-string flips.
 *
 * Denominator: tráficos with a fecha_llegada older than `maturityDays`.
 *
 * Maturity floor prevents in-flight shipments from collapsing the
 * ratio; a tráfico that arrived yesterday isn't a broker-performance
 * signal, it's noise.
 */
export function computeSuccessRate(
  rows: SuccessRateRow[],
  opts: SuccessRateOptions = {},
): number | null {
  const now = opts.now ?? Date.now()
  const maturityDays = opts.maturityDays ?? SUCCESS_RATE_MATURITY_DAYS
  const minSamples = opts.minSamples ?? SUCCESS_RATE_MIN_SAMPLES
  const maturityMs = maturityDays * 86_400_000

  const mature = rows.filter((r) => {
    if (!r.fecha_llegada) return false
    const t = new Date(r.fecha_llegada).getTime()
    if (Number.isNaN(t)) return false
    return now - t >= maturityMs
  })
  if (mature.length < minSamples) return null

  const crossed = mature.filter(
    (r) => (r.fecha_cruce != null && r.fecha_cruce !== '')
      || SUCCESS_ESTATUSES.has(r.estatus ?? ''),
  )
  return Math.round((crossed.length / mature.length) * 100)
}
