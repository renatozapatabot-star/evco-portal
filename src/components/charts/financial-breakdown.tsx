'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  facturas: Array<{ valor_usd: number | null; dta: number | null; igi: number | null; iva: number | null; fecha_pago: string | null }>
}

const COLORS = ['var(--gold)', 'var(--info)', 'var(--success)', '#7E22CE']

/**
 * Financial breakdown chart — monthly DTA, IGI, IVA contributions.
 */
export function FinancialBreakdown({ facturas }: Props) {
  const data = useMemo(() => {
    const months: Record<string, { month: string; dta: number; igi: number; iva: number; valor: number }> = {}
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
      months[key] = { month: label, dta: 0, igi: 0, iva: 0, valor: 0 }
    }

    for (const f of facturas) {
      if (!f.fecha_pago) continue
      const key = f.fecha_pago.substring(0, 7)
      if (months[key]) {
        months[key].dta += Number(f.dta) || 0
        months[key].igi += Number(f.igi) || 0
        months[key].iva += Number(f.iva) || 0
        months[key].valor += Number(f.valor_usd) || 0
      }
    }

    return Object.values(months)
  }, [facturas])

  if (data.every(d => d.valor === 0)) return null

  return (
    <div className="card card-enter" style={{ padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
        Contribuciones — últimos 6 meses
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9B9B9B' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9B9B9B' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #E8E5E0', borderRadius: 8, fontSize: 12 }}
            formatter={(value) => [`$${Math.round(Number(value)).toLocaleString()}`]}
          />
          <Bar dataKey="dta" stackId="a" fill="#eab308" radius={[0, 0, 0, 0]} />
          <Bar dataKey="igi" stackId="a" fill="#2563EB" radius={[0, 0, 0, 0]} />
          <Bar dataKey="iva" stackId="a" fill="#16A34A" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
        {[{ label: 'DTA', color: '#eab308' }, { label: 'IGI', color: '#2563EB' }, { label: 'IVA', color: '#16A34A' }].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  )
}
