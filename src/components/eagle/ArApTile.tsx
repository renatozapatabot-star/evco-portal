'use client'

import { ACCENT_SILVER_BRIGHT, TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'
import { TileShell, MONO } from './tile-shell'
import type { AgingResult } from '@/lib/contabilidad/aging'

function formatAmount(amount: number, currency: 'MXN' | 'USD'): string {
  // V1 guard — force MXN default. Missing/undefined currency on some edge
  // cases was rendering `¥` because the locale fallback resolved to JPY.
  const safeCurrency: 'MXN' | 'USD' = currency || 'MXN'
  const locale = safeCurrency === 'USD' ? 'en-US' : 'es-MX'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: safeCurrency, maximumFractionDigits: 0 }).format(amount)
}

function overdueTotal(r: AgingResult): number {
  return r.byBucket.filter((b) => b.bucket !== '0-30').reduce((s, b) => s + b.amount, 0)
}

export function ArApTile({ ar, ap }: { ar: AgingResult; ap: AgingResult }) {
  const arOverdue = overdueTotal(ar)
  const apOverdue = overdueTotal(ap)
  return (
    <TileShell title="AR / AP resumen" subtitle="vencido" href="/contabilidad">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Cuentas por cobrar
          </div>
          <div style={{ fontFamily: MONO, fontSize: 22, color: ACCENT_SILVER_BRIGHT, fontWeight: 700 }}>
            {formatAmount(arOverdue, ar.currency)}
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: MONO }}>
            {ar.count} facturas · {ar.currency}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Cuentas por pagar
          </div>
          <div style={{ fontFamily: MONO, fontSize: 22, color: ACCENT_SILVER_BRIGHT, fontWeight: 700 }}>
            {ap.sourceMissing ? '—' : formatAmount(apOverdue, ap.currency)}
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: MONO }}>
            {ap.sourceMissing ? 'Datos pendientes' : `${ap.count} facturas · ${ap.currency}`}
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, fontSize: 12, color: TEXT_PRIMARY }}>
          Neto: <span style={{ fontFamily: MONO }}>{formatAmount(arOverdue - apOverdue, ar.currency)}</span>
        </div>
      </div>
    </TileShell>
  )
}
