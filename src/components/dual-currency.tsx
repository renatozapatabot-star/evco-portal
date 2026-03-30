import { fmtUSD, fmtMXN } from '@/lib/format-utils'

export function DualCurrency({ usd, rate = 17.50 }: { usd: number | null | undefined; rate?: number }) {
  if (usd == null) return <span className="c-dim">—</span>
  return (
    <span className="dual-currency">
      <span className="dc-primary">{fmtUSD(usd)}</span>
      <span className="dc-secondary">≈ MX${(usd * rate).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
    </span>
  )
}
