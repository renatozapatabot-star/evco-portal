/**
 * Canonical formatters — V1 audit lock-in (2026-04-25).
 *
 * Three exports used everywhere on the six V1 surfaces:
 *   /entradas, /pedimentos/[id], /expedientes, /expedientes/[id],
 *   /catalogo, /anexo-24
 *
 * Do not duplicate this logic. Extend here, re-export here.
 */

const ES_MX_NUMBER = new Intl.NumberFormat('es-MX')

const ES_MX_NUMBER_DECIMAL_CACHE = new Map<number, Intl.NumberFormat>()
function esMxNumberWith(decimals: number): Intl.NumberFormat {
  let f = ES_MX_NUMBER_DECIMAL_CACHE.get(decimals)
  if (!f) {
    f = new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    ES_MX_NUMBER_DECIMAL_CACHE.set(decimals, f)
  }
  return f
}

const EN_US_USD = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * DD/MM/YYYY — shipper-friendly, locale-agnostic, no-throw.
 * Returns '' for null/undefined/invalid input.
 */
export function formatDateDMY(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = String(iso).split('T')[0]
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

/**
 * Number with es-MX thousand separators.
 * Default: integer (Math.trunc). Pass `decimals` to keep fixed precision.
 * Returns '' for null/undefined/NaN.
 */
export function formatNumber(
  n: number | null | undefined,
  opts: { decimals?: number } = {},
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  const num = Number(n)
  if (!Number.isFinite(num)) return ''
  if (opts.decimals === undefined) {
    return ES_MX_NUMBER.format(Math.trunc(num))
  }
  return esMxNumberWith(opts.decimals).format(num)
}

/**
 * `$X,XXX.XX USD` — single-line inline. Always 2 decimals, en-US comma
 * thousand separators, dollar-sign prefix, ' USD' suffix.
 * Returns '' for null/undefined/NaN.
 */
export function formatCurrencyUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  const num = Number(n)
  if (!Number.isFinite(num)) return ''
  return `$${EN_US_USD.format(num)} USD`
}
