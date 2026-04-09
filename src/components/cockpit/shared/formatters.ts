// Re-export canonical formatters — never duplicate logic
export {
  fmtUSD, fmtUSDCompact, fmtMXN, fmtMXNCompact, fmtMXNInt,
  fmtDate, fmtDateTime, fmtDateCompact, fmtRelativeTime,
  fmtPedimento, fmtDesc, fmtKg, fmtCurrency,
  formatAbsoluteDate, formatAbsoluteETA,
} from '@/lib/format-utils'

/** Month-over-month delta — "▲ 8%" or "▼ 3%" */
export function fmtDelta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '▲ ∞' : '—'
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100)
  if (pct === 0) return '→ 0%'
  return pct > 0 ? `▲ ${pct}%` : `▼ ${Math.abs(pct)}%`
}

/** Wrap a value in JetBrains Mono class for numeric display */
export function monoClass(): string {
  return 'font-mono'
}
