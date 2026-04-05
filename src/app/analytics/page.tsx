'use client'

import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts'
import { getCookieValue, getCompanyIdCookie } from '@/lib/client-config'
import { fmtUSDCompact } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { useIsMobile } from '@/hooks/use-mobile'

const GOLD = 'var(--gold)'
const TEAL = '#0D9488'
const COLORS = [GOLD, TEAL, '#7E22CE', 'var(--danger-500)', 'var(--info)', 'var(--success)', 'var(--warning-500, #D97706)', '#6B7280']

interface TraficoRow {
  trafico: string; estatus?: string | null; fecha_llegada?: string | null
  importe_total?: number | null; proveedores?: string | null
  regimen?: string | null; pais_procedencia?: string | null
  [k: string]: unknown
}

type Report = 'volumen' | 'proveedores' | 'tmec' | 'despacho'

export default function AnalyticsPage() {
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeReport, setActiveReport] = useState<Report>('volumen')
  const isMobile = useIsMobile()

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    fetch(`/api/data?table=traficos&company_id=${companyId}&limit=5000&gte_field=fecha_llegada&gte_value=2024-01-01&order_by=fecha_llegada&order_dir=desc`)
      .then(r => r.json()).then(d => setRows(d.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  // Monthly volume data
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; count: number; value: number }> = {}
    for (const r of rows) {
      const m = (r.fecha_llegada || '').substring(0, 7)
      if (!m) continue
      if (!map[m]) map[m] = { month: m, count: 0, value: 0 }
      map[m].count++
      map[m].value += Number(r.importe_total) || 0
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
  }, [rows])

  // Supplier breakdown
  const supplierData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of rows) {
      const sup = (r.proveedores || '').split(',')[0]?.trim() || 'Desconocido'
      map[sup] = (map[sup] || 0) + (Number(r.importe_total) || 0)
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name: name.substring(0, 20), value: Math.round(value) }))
  }, [rows])

  // T-MEC savings cumulative
  const tmecData = useMemo(() => {
    let cumulative = 0
    const map: Record<string, number> = {}
    for (const r of rows.slice().reverse()) {
      const m = (r.fecha_llegada || '').substring(0, 7)
      if (!m) continue
      const reg = (r.regimen || '').toUpperCase()
      if (reg === 'ITE' || reg === 'ITR' || reg === 'IMD') {
        cumulative += (Number(r.importe_total) || 0) * 0.05
      }
      map[m] = Math.round(cumulative)
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([month, savings]) => ({ month, savings }))
  }, [rows])

  // Processing time histogram
  const despachoData = useMemo(() => {
    const buckets: Record<string, number> = { '0-3': 0, '3-5': 0, '5-7': 0, '7-10': 0, '10-15': 0, '15+': 0 }
    for (const r of rows) {
      if (!r.fecha_llegada || !(r as Record<string, unknown>).fecha_cruce) continue
      const days = (new Date((r as Record<string, unknown>).fecha_cruce as string).getTime() - new Date(r.fecha_llegada).getTime()) / 86400000
      if (days < 0 || days > 60) continue
      if (days <= 3) buckets['0-3']++
      else if (days <= 5) buckets['3-5']++
      else if (days <= 7) buckets['5-7']++
      else if (days <= 10) buckets['7-10']++
      else if (days <= 15) buckets['10-15']++
      else buckets['15+']++
    }
    return Object.entries(buckets).map(([range, count]) => ({ range, count }))
  }, [rows])

  const reports: { key: Report; label: string }[] = [
    { key: 'volumen', label: 'Volumen mensual' },
    { key: 'proveedores', label: 'Proveedores' },
    { key: 'tmec', label: 'Ahorro T-MEC' },
    { key: 'despacho', label: 'Tiempo despacho' },
  ]

  return (
    <div style={{ padding: '24px 16px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Analytics</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        {rows.length.toLocaleString()} tráficos · ene 2024–presente
      </p>

      {/* Report selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, overflowX: 'auto' }}>
        {reports.map(r => (
          <button key={r.key} onClick={() => setActiveReport(r.key)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: activeReport === r.key ? 700 : 500,
            background: activeReport === r.key ? 'rgba(196,150,60,0.1)' : 'var(--bg-card)',
            border: `1px solid ${activeReport === r.key ? GOLD : 'var(--border)'}`,
            color: activeReport === r.key ? GOLD : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton-shimmer" style={{ height: 300, borderRadius: 8 }} />
      ) : rows.length === 0 ? (
        <EmptyState icon="📊" title="Sin datos para analytics" description="Los reportes aparecerán cuando haya tráficos registrados" />
      ) : (
        <div className="card" style={{ padding: 24 }}>
          {/* Volumen mensual */}
          {activeReport === 'volumen' && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Tráficos por mes</div>
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [String(v), 'Tráficos']} />
                  <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}

          {/* Proveedores */}
          {activeReport === 'proveedores' && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Top proveedores por valor</div>
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
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Ahorro T-MEC acumulado</div>
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
                <LineChart data={tmecData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtUSDCompact(v)} />
                  <Tooltip formatter={(v) => [fmtUSDCompact(Number(v)), 'Ahorro']} />
                  <Line type="monotone" dataKey="savings" stroke={TEAL} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}

          {/* Despacho */}
          {activeReport === 'despacho' && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Distribución de tiempo de despacho (días)</div>
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
                <BarChart data={despachoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [String(v), 'Tráficos']} />
                  <Bar dataKey="count" fill={TEAL} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}
    </div>
  )
}
