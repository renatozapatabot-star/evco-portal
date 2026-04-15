'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts'
import { fmtUSDCompact } from '@/lib/format-utils'

const GOLD = 'var(--gold)'
const TEAL = '#0D9488'
const COLORS = [GOLD, TEAL, '#7E22CE', 'var(--danger-500)', 'var(--info)', 'var(--success)', 'var(--warning-500, #D97706)', '#6B7280']

type Report = 'volumen' | 'proveedores' | 'tmec' | 'despacho'

interface AnalyticsChartsProps {
  activeReport: Report
  monthlyData: { month: string; count: number; value: number }[]
  supplierData: { name: string; value: number }[]
  tmecData: { month: string; savings: number }[]
  despachoData: { range: string; count: number }[]
  isMobile: boolean
}

export default function AnalyticsCharts({ activeReport, monthlyData, supplierData, tmecData, despachoData, isMobile }: AnalyticsChartsProps) {
  return (
    <div className="card" style={{ padding: 24 }}>
      {/* Volumen mensual */}
      {activeReport === 'volumen' && (
        <>
          <div style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, marginBottom: 16 }}>Traficos por mes</div>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
              <XAxis dataKey="month" tick={{ fontSize: 'var(--aguila-fs-meta)' }} />
              <YAxis tick={{ fontSize: 'var(--aguila-fs-meta)' }} />
              <Tooltip formatter={(v) => [String(v), 'Traficos']} />
              <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Proveedores */}
      {activeReport === 'proveedores' && (
        <>
          <div style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, marginBottom: 16 }}>Top proveedores por valor</div>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
            <PieChart>
              <Pie data={supplierData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={isMobile ? 80 : 120} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                {supplierData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => [fmtUSDCompact(Number(v)), 'Valor']} />
            </PieChart>
          </ResponsiveContainer>
        </>
      )}

      {/* T-MEC savings */}
      {activeReport === 'tmec' && (
        <>
          <div style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, marginBottom: 16 }}>Ahorro T-MEC acumulado</div>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
            <LineChart data={tmecData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
              <XAxis dataKey="month" tick={{ fontSize: 'var(--aguila-fs-meta)' }} />
              <YAxis tick={{ fontSize: 'var(--aguila-fs-meta)' }} tickFormatter={v => fmtUSDCompact(v)} />
              <Tooltip formatter={(v) => [fmtUSDCompact(Number(v)), 'Ahorro']} />
              <Line type="monotone" dataKey="savings" stroke={TEAL} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Despacho */}
      {activeReport === 'despacho' && (
        <>
          <div style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, marginBottom: 16 }}>Distribucion de tiempo de despacho (dias)</div>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
            <BarChart data={despachoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
              <XAxis dataKey="range" tick={{ fontSize: 'var(--aguila-fs-meta)' }} />
              <YAxis tick={{ fontSize: 'var(--aguila-fs-meta)' }} />
              <Tooltip formatter={(v) => [String(v), 'Traficos']} />
              <Bar dataKey="count" fill={TEAL} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}
