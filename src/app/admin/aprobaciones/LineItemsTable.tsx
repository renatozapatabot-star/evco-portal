'use client'

import { fmtUSD } from '@/lib/format-utils'

interface Product {
  description?: string
  descripcion?: string
  quantity?: number
  cantidad?: number
  unit_value?: number
  valor_unitario?: number
  fraccion?: string
  confidence?: number
  source?: string
  igi_rate?: number
}

interface Props {
  products: Product[]
}

function confidenceDot(confidence: number) {
  const color = confidence >= 95 ? 'var(--portal-status-green-fg)' : confidence >= 80 ? 'var(--portal-status-amber-fg)' : 'var(--portal-status-red-fg)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0,
      }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-compact)', color: '#94a3b8' }}>
        {confidence}%
      </span>
    </span>
  )
}

function sourceBadge(source: string) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    historica: { bg: 'var(--portal-status-green-bg)', text: 'var(--portal-status-green-fg)', label: 'Histórica' },
    sugerida: { bg: 'var(--portal-status-gray-bg)', text: 'var(--portal-fg-3)', label: 'IA' },
    manual: { bg: 'var(--portal-status-gray-bg)', text: 'var(--portal-fg-4)', label: 'Manual' },
  }
  const c = config[source] || config.manual
  return (
    <span style={{
      fontSize: 'var(--aguila-fs-label)', fontWeight: 600,
      padding: '2px 6px', borderRadius: 4,
      background: c.bg, color: c.text,
    }}>
      {c.label}
    </span>
  )
}

export function LineItemsTable({ products }: Props) {
  if (products.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '24px 16px',
        color: '#64748b', fontSize: 'var(--aguila-fs-body)',
      }}>
        Sin líneas de producto
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', scrollbarWidth: 'thin' }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        fontSize: 'var(--aguila-fs-body)', color: '#E6EDF3',
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {['#', 'Descripción', 'Cant.', 'Valor USD', 'Fracción', 'IGI%', 'Confianza', 'Fuente'].map(h => (
              <th key={h} style={{
                padding: '8px 10px', textAlign: 'left',
                fontSize: 'var(--aguila-fs-label)', fontWeight: 700, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => {
            const desc = p.description || p.descripcion || '—'
            const qty = p.quantity || p.cantidad || 0
            const unitVal = p.unit_value || p.valor_unitario || 0
            const totalVal = qty * unitVal
            const fraccion = p.fraccion || '—'
            const conf = typeof p.confidence === 'number' ? p.confidence : 0
            const src = p.source || 'manual'

            return (
              <tr key={i} style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>{i + 1}</td>
                <td style={{
                  padding: '10px', maxWidth: 220,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {desc}
                </td>
                <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{qty}</td>
                <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {fmtUSD(totalVal)}
                </td>
                <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{fraccion}</td>
                <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                  {p.igi_rate != null ? `${(p.igi_rate * 100).toFixed(1)}%` : '—'}
                </td>
                <td style={{ padding: '10px' }}>{conf > 0 ? confidenceDot(conf) : '—'}</td>
                <td style={{ padding: '10px' }}>{sourceBadge(src)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
