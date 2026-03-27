export const fmtId = (id: string | null | undefined): string => {
  if (!id) return '-'
  const clean = String(id).replace(/[\u2013\u2014\u2212\u2010]/g, '-').replace(/^9254[-]?/, '')
  return `9254-${clean}`
}

export const fmtDesc = (s: string | null | undefined): string => {
  if (!s) return '-'
  const stops = new Set(['de','del','la','el','y','en','por','con','sin','a','e'])
  return s.toLowerCase().split(' ').map((w, i) => {
    if (!w) return w
    return (i === 0 || !stops.has(w)) ? w[0].toUpperCase() + w.slice(1) : w
  }).join(' ')
}

export const fmtUSD = (n: number | null | undefined): string => {
  if (n == null || n === 0) return '-'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export const fmtKg = (n: number | null | undefined): string => {
  if (n == null) return '-'
  return Number(n).toLocaleString('es-MX')
}

export const fmtDate = (s: any): string => {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return String(s) }
}

export const fmtDateShort = (s: any): string => {
  if (!s) return '-'
  try { return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) }
  catch { return String(s) }
}

export const fmtCompact = (n: number): string =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`

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
