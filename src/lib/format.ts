import { CLIENT_CLAVE } from './client-config'

/** Ensure CLIENT_CLAVE- prefix on all tráfico IDs */
export const fmtTraficoId = (id: string | null | undefined): string => {
  if (!id) return '-'
  const clean = id.replace(/[\u2013\u2014]/g, '-')
  return clean.startsWith(`${CLIENT_CLAVE}-`) ? clean : `${CLIENT_CLAVE}-${clean}`
}

/** Format USD compact: $1.2M or $450K */
export const fmtUSDCompact = (n: number | null | undefined): string => {
  if (n == null) return ''
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

/** Format USD full: $1,234,567 */
export const fmtUSDFull = (n: number | null | undefined): string => {
  if (n == null) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

/** Format MXN: $1,234,567 */
export const fmtMXN = (n: number | null | undefined): string => {
  if (n == null) return ''
  return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`
}

/** Format date: 09 mar 2026 */
export const fmtDate = (s: string | Date | null | undefined): string => {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return String(s)
  }
}

/** Format peso: 46,098,659 kg */
export const fmtPeso = (n: number | null | undefined): string => {
  if (n == null) return ''
  return `${Number(n).toLocaleString('es-MX')} kg`
}

/** Shorten a supplier name for display */
export const fmtProveedor = (s: string | null | undefined, maxLen = 26): string => {
  if (!s) return ''
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s
}
