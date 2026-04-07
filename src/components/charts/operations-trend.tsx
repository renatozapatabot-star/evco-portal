'use client'

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  traficos: Array<{ fecha_llegada: string | null; estatus: string | null }>
}

/**
 * Operations trend chart — 12-month area chart showing monthly operations.
 * Gold fill for active, green overlay for completed.
 */
export function OperationsTrend({ traficos }: Props) {
  const data = useMemo(() => {
    const months: Record<string, { month: string; total: number; cruzado: number }> = {}
    const now = new Date()

    // Last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
      months[key] = { month: label, total: 0, cruzado: 0 }
    }

    for (const t of traficos) {
      if (!t.fecha_llegada) continue
      const key = t.fecha_llegada.substring(0, 7)
      if (months[key]) {
        months[key].total++
        if ((t.estatus || '').toLowerCase().includes('cruz')) months[key].cruzado++
      }
    }

    return Object.values(months)
  }, [traficos])

  if (data.every(d => d.total === 0)) return null

  return (
    <div className="card card-enter" style={{ padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
        Operaciones — últimos 12 meses
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#C9A84C" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16A34A" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#16A34A" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9B9B9B' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9B9B9B' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #E8E5E0', borderRadius: 8, fontSize: 12, backdropFilter: 'blur(8px)' }}
            formatter={(value) => [String(value)]}
          />
          <Area type="monotone" dataKey="total" stroke="#C9A84C" strokeWidth={2} fill="url(#goldGrad)" />
          <Area type="monotone" dataKey="cruzado" stroke="#16A34A" strokeWidth={1.5} fill="url(#greenGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
