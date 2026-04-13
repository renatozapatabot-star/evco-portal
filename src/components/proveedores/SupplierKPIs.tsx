'use client'

import { fmtUSDCompact } from '@/lib/format-utils'

const T = {
  surface: 'var(--bg-card)',
  border: 'var(--border)',
  textMuted: 'var(--text-muted)',
  gold: 'var(--gold)',
  text: 'var(--text-primary)',
  green: 'var(--success)',
  mono: 'var(--font-jetbrains-mono)',
} as const

interface SupplierKPIsProps {
  supplierCount: number
  traficoCount: number
  totalValue: number
  isMobile: boolean
}

export function SupplierKPIs({ supplierCount, traficoCount, totalValue, isMobile }: SupplierKPIsProps) {
  const kpis = [
    { label: 'Proveedores', value: String(supplierCount), color: T.gold },
    { label: 'Embarques con proveedor', value: String(traficoCount), color: T.text },
    { label: 'Valor total', value: fmtUSDCompact(totalValue), color: T.green },
    { label: 'Promedio por embarque', value: totalValue > 0 && supplierCount > 0 ? fmtUSDCompact(totalValue / traficoCount) : '\u2014', color: T.text },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
      {kpis.map(kpi => (
        <div key={kpi.label} style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: '16px 20px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textMuted, marginBottom: 6 }}>
            {kpi.label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: T.mono, color: kpi.color }}>
            {kpi.value}
          </div>
        </div>
      ))}
    </div>
  )
}
