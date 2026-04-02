import { getCookieValue } from '@/lib/client-config'

// ── Number Formatting Rules ──
// KPI cards / summaries: use compact format → fmtUSDCompact ("$2.6M USD")
// Table cells / detail: use full precision → fmtUSD ("$276,603.31")
// MXN duties/taxes: use integer → fmtMXNInt ("$48,000 MXN")
// All monetary values MUST carry a currency suffix (USD or MXN)

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

// Compact for KPI cards — with USD suffix
export const fmtUSDCompact = (n: number | null | undefined): string => {
  if (n == null) return ''
  if (Math.abs(n) >= 1_000_000_000) return `$${(n/1e9).toFixed(1)}B USD`
  if (Math.abs(n) >= 1_000_000)     return `$${(n/1e6).toFixed(1)}M USD`
  if (Math.abs(n) >= 1_000)         return `$${(n/1e3).toFixed(1)}K USD`
  return `$${n.toFixed(2)} USD`
}

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

// MXN compact
export const fmtMXNCompact = (n: number | null | undefined): string => {
  if (n == null) return ''
  if (Math.abs(n) >= 1_000_000) return `$${(n/1e6).toFixed(1)}M MXN`
  if (Math.abs(n) >= 1_000)     return `$${(n/1e3).toFixed(0)}K MXN`
  return `$${n.toFixed(2)} MXN`
}

// Integer amounts (DTA, IGI, IVA — whole pesos)
export const fmtMXNInt = (n: number | null | undefined) =>
  fmtCurrency(n, { decimals: 0, currency: 'MXN' })

// Compact alias
export const fmtCompact = fmtUSDCompact

// Weight
export const fmtKg = (n: number | null | undefined): string => {
  if (n == null) return ''
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n)
}

// Date — standardize to "27 mar 2026" everywhere
export const fmtDate = (date: string | Date | null | undefined): string => {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Chicago'
    })
  } catch { return '—' }
}

// Date with time — "27 mar 2026 · 04:31"
export const fmtDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Chicago'
    })
  } catch { return '—' }
}

// Short date — "27 mar"
export const fmtDateShort = (date: string | Date | null | undefined): string => {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Chicago'
    })
  } catch { return '—' }
}

// Compact date — "27 mar" (alias for fmtDateShort with explicit typing)
export const fmtDateCompact = (date: string | Date | null | undefined): string => {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Chicago'
    })
  } catch { return '—' }
}

// ID formatter — no em-dashes, client-prefix aware
export const fmtId = (id: string | null | undefined): string => {
  if (!id) return ''
  return String(id).replace(/[\u2013\u2014\u2212\u2010\u2015]/g, '-')
}

// Pedimento short — show only the 7-digit sequential number for client-facing display
// Input: "26 24 3596 5500017" → Output: "5500017"
export const fmtPedimentoShort = (ped: string | null | undefined): string => {
  if (!ped) return ''
  const s = String(ped).trim()
  // If it matches the full format "DD AD PPPP SSSSSSS", extract the last segment
  const match = s.match(/^\d{2}\s\d{2}\s\d{4}\s(\d{7})$/)
  if (match) return match[1]
  // If it's already short (7 digits) or unrecognized, return as-is
  return s
}

// Title case descriptions
export const fmtDesc = (s: string | null | undefined): string => {
  if (!s) return ''
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

// ── Timezone-aware formatters (Laredo CST/CDT) ──────

const LAREDO_TZ = 'America/Chicago'

export const fmtDateLocal = (s: any): string => {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('es-MX', {
      timeZone: LAREDO_TZ, day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return String(s) }
}

export const fmtDateTimeLocal = (s: any): string => {
  if (!s) return '—'
  try {
    const d = new Date(s)
    return `${d.toLocaleDateString('es-MX', { timeZone: LAREDO_TZ, day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString('es-MX', { timeZone: LAREDO_TZ, hour: '2-digit', minute: '2-digit' })}`
  } catch { return String(s) }
}

// ── Pluralization ────────────────────────────────────

export const pluralize = (count: number, singular: string, plural: string): string =>
  count === 1 ? singular : plural

// v6.0 — Absolute ETA format. Never relative. es-MX locale with CST suffix.
export const formatAbsoluteETA = (s: any): string => {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleString('es-MX', {
      timeZone: 'America/Chicago',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) + ' CST'
  } catch { return '—' }
}

// v6.0 — Absolute date only (no time). es-MX locale.
export const formatAbsoluteDate = (s: any): string => {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('es-MX', {
      timeZone: 'America/Chicago',
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return '—' }
}
