// Master currency formatter — use this EVERYWHERE
export const fmtCurrency = (
  n: number | null | undefined,
  opts: { decimals?: number; compact?: boolean; currency?: string } = {}
): string => {
  if (n == null) return '—'
  const { decimals = 2, compact = false, currency = 'USD' } = opts

  if (compact) {
    if (Math.abs(n) >= 1_000_000_000)
      return `$${(n / 1_000_000_000).toFixed(1)}B`
    if (Math.abs(n) >= 1_000_000)
      return `$${(n / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 1_000)
      return `$${(n / 1_000).toFixed(1)}K`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

// Compact for KPI cards
export const fmtUSDCompact = (n: number | null | undefined) =>
  fmtCurrency(n, { compact: true })

// Full with 2 decimals for financial tables
export const fmtUSDFull = (n: number | null | undefined) =>
  fmtCurrency(n, { decimals: 2 })

// Backwards compat alias
export const fmtUSD = fmtUSDFull

// MXN with 2 decimals
export const fmtMXN = (n: number | null | undefined) =>
  fmtCurrency(n, { decimals: 2, currency: 'MXN' })

// MXN full alias
export const fmtMXNFull = fmtMXN

// Integer amounts (DTA, IGI, IVA — whole pesos)
export const fmtMXNInt = (n: number | null | undefined) =>
  fmtCurrency(n, { decimals: 0, currency: 'MXN' })

// Compact alias
export const fmtCompact = fmtUSDCompact

// Weight
export const fmtKg = (n: number | null | undefined): string => {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n)
}

// Date — standardize to "27 mar 2026" everywhere
export const fmtDate = (s: any): string => {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch { return String(s) }
}

// Date with time — "27 mar 2026 · 04:31"
export const fmtDateTime = (s: any): string => {
  if (!s) return '—'
  try {
    const d = new Date(s)
    return `${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
  } catch { return String(s) }
}

// Short date — "27 mar"
export const fmtDateShort = (s: any): string => {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) }
  catch { return String(s) }
}

// ID formatter — no em-dashes
export const fmtId = (id: string | null | undefined): string => {
  if (!id) return '—'
  const clean = String(id).replace(/[\u2013\u2014\u2212\u2010\u2015\u2212]/g, '-').replace(/^9254[-]?/, '')
  return `9254-${clean}`
}

// Title case descriptions
export const fmtDesc = (s: string | null | undefined): string => {
  if (!s) return '—'
  const stops = new Set(['de','del','la','el','y','en','por','con','sin','a','e','o'])
  return s.toLowerCase().split(' ').map((w, i) =>
    w && (i === 0 || !stops.has(w)) ? w[0].toUpperCase() + w.slice(1) : w
  ).join(' ')
}

// Priority scoring
export const calcPriority = (row: any): number => {
  let score = 0
  if (!row.pedimento) score += 35
  if (row.estatus !== 'Cruzado' && row.fecha_llegada) {
    const days = (Date.now() - new Date(row.fecha_llegada).getTime()) / 86400000
    if (days > 14) score += 30
    else if (days > 7) score += 15
    else if (days > 3) score += 5
  }
  const val = Number(row.importe_total || 0)
  if (val > 100000) score += 15
  else if (val > 50000) score += 7
  return score
}

export const priorityClass = (score: number): string => {
  if (score >= 55) return 'p-crit'
  if (score >= 25) return 'p-high'
  if (score > 0) return 'p-norm'
  return 'p-low'
}
