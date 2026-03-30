'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

import { CLIENT_CLAVE, COMPANY_ID, CLIENT_NAME, PATENTE } from '@/lib/client-config'
import { GOLD } from '@/lib/design-system'
const CLAVE = CLIENT_CLAVE

const T = {
  bg: '#FAFAF8', surface: '#FFFFFF', border: '#E8E6E0', surfaceAlt: '#F5F3EF',
  text: '#1A1A1A', textSub: '#6B6B6B', textMuted: '#999999',
  navy: '#BA7517', gold: '#BA7517', goldBg: '#FFF8EB',
  green: '#16A34A', greenBg: '#EAF3DE',
  amber: '#854D0E', amberBg: '#FEF9C3',
  red: '#DC2626', redBg: '#FEF2F2',
  shadow: '0 1px 3px rgba(0,0,0,0.07)',
}

function fmtUSD(v: any) {
  const n = Number(v || 0)
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'K'
  return '$' + n.toLocaleString('en-US')
}
function fmtNum(v: any) { return Number(v || 0).toLocaleString('es-MX') }

function Card({ children, style = {} }: any) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 12, boxShadow: T.shadow, ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ title, sub }: any) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ color: T.text, fontSize: 14, fontWeight: 700, margin: 0 }}>{title}</h3>
      {sub && <p style={{ color: T.textMuted, fontSize: 11, margin: '3px 0 0' }}>{sub}</p>}
    </div>
  )
}

const TOOLTIP_STYLE = {
  background: '#1A1710',
  border: 'none',
  borderRadius: 10,
  color: 'white',
  fontSize: 12,
  fontWeight: 600,
  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
  borderLeft: `3px solid ${GOLD}`,
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={TOOLTIP_STYLE as any}>
      <div style={{ color: GOLD, fontSize: 10, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: 'white' }}>
          {typeof p.value === 'number'
            ? p.value >= 1e6 ? `$${(p.value/1e6).toFixed(1)}M`
            : p.value >= 1e3 ? `$${(p.value/1e3).toFixed(0)}K`
            : p.value.toLocaleString()
            : p.value}
        </div>
      ))}
    </div>
  )
}

export function ReportesView() {
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [byDay, setByDay] = useState<any[]>([])
  const [byMonth, setByMonth] = useState<any[]>([])
  const [statusData, setStatusData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [monthlyReports, setMonthlyReports] = useState<any[]>([])

  useEffect(() => {
    supabase.from('monthly_intelligence_reports')
      .select('*').eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setMonthlyReports(data || []))
  }, [])

  useEffect(() => {
    async function load() {
      const [factRes, trafRes, entRes] = await Promise.all([
        supabase.from('aduanet_facturas')
          .select('valor_usd, dta, igi, iva, fecha_pago, proveedor')
          .eq('clave_cliente', CLAVE)
          .order('fecha_pago', { ascending: true }),
        supabase.from('traficos')
          .select('estatus, fecha_llegada, peso_bruto')
          .eq('company_id', COMPANY_ID),
        supabase.from('entradas')
          .select('tiene_faltantes, mercancia_danada, peso_bruto, fecha_llegada_mercancia')
          .eq('company_id', COMPANY_ID),
      ])

      const facturas = factRes.data || []
      const traficos = trafRes.data || []
      const entradas = entRes.data || []

      // Weekly trend
      const byWeek: Record<string, { valor: number; count: number }> = {}
      facturas.forEach((f: any) => {
        if (!f.fecha_pago) return
        const d = new Date(f.fecha_pago)
        const monday = new Date(d)
        monday.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1))
        const key = monday.toISOString().split('T')[0]
        if (!byWeek[key]) byWeek[key] = { valor: 0, count: 0 }
        byWeek[key].valor += f.valor_usd || 0
        byWeek[key].count++
      })
      setWeeklyData(Object.entries(byWeek)
        .sort(([a], [b]) => a.localeCompare(b)).slice(-12)
        .map(([week, d]) => ({
          week, label: new Date(week).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
          valor: Math.round(d.valor), ops: d.count,
        })))

      // Top proveedores
      const provMap: Record<string, number> = {}
      facturas.forEach((f: any) => { if (f.proveedor) provMap[f.proveedor] = (provMap[f.proveedor] || 0) + (f.valor_usd || 0) })
      setProveedores(Object.entries(provMap).sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([name, valor]) => ({ name: name.split(' ').slice(0, 3).join(' '), fullName: name, valor: Math.round(valor as number) })))

      // Volume by day
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      const dayCount = [0, 0, 0, 0, 0, 0, 0]
      traficos.forEach((t: any) => { if (t.fecha_llegada) dayCount[new Date(t.fecha_llegada).getDay()]++ })
      setByDay(days.map((d, i) => ({ day: d, count: dayCount[i] })))

      // Volume by month
      const monthMap: Record<string, number> = {}
      traficos.forEach((t: any) => { if (!t.fecha_llegada) return; const key = t.fecha_llegada.substring(0, 7); monthMap[key] = (monthMap[key] || 0) + 1 })
      setByMonth(Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
        .map(([m, count]) => ({ month: new Date(m + '-01').toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }), count })))

      // Status breakdown
      const statusMap: Record<string, number> = {}
      traficos.forEach((t: any) => { const s = t.estatus || 'Desconocido'; statusMap[s] = (statusMap[s] || 0) + 1 })
      const STATUS_COLORS: Record<string, string> = { 'En Proceso': T.amber, 'Cruzado': T.green, 'Detenido': T.red }
      setStatusData(Object.entries(statusMap).sort((a, b) => b[1] - a[1])
        .map(([status, count]) => ({ status, count, color: STATUS_COLORS[status] || T.textMuted, pct: Math.round((count / traficos.length) * 100) })))

      // Summary
      const totalValor = facturas.reduce((s: number, f: any) => s + (f.valor_usd || 0), 0)
      const tmecCount = facturas.filter((f: any) => (f.igi || 0) === 0).length
      const faltantes = entradas.filter((e: any) => e.tiene_faltantes).length
      setSummary({
        totalValor, tmecCount,
        tmecPct: facturas.length > 0 ? ((tmecCount / facturas.length) * 100).toFixed(1) : 0,
        totalTraficos: traficos.length, totalEntradas: entradas.length,
        faltantesPct: entradas.length > 0 ? ((faltantes / entradas.length) * 100).toFixed(2) : 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ padding: '24px 28px' }}>
      <div className="skeleton" style={{ width: 200, height: 24, marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
      </div>
      <div className="skeleton" style={{ height: 280, borderRadius: 12, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
    </div>
  )

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ color: T.text, fontSize: 18, fontWeight: 700, margin: 0 }}>Reportes & Analítica</h2>
          <p style={{ color: T.textMuted, fontSize: 12, margin: '4px 0 0' }}>{CLIENT_NAME} · Datos históricos completos · Patente {PATENTE}</p>
        </div>
        <button onClick={() => window.print()} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', border: `1px solid ${T.border}`,
          borderRadius: 8, background: T.surface,
          fontSize: 12, fontWeight: 600, color: T.textSub, cursor: 'pointer',
        }}>
          Exportar PDF
        </button>
      </div>

      {/* Summary header */}
      <Card style={{ padding: '16px 20px', marginBottom: 20, borderTop: `3px solid ${T.green}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: T.green }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Resumen Operativo</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSub }}>
          {fmtNum(summary.totalTraficos)} tráficos procesados · {fmtUSD(summary.totalValor)} USD importado · {summary.tmecPct}% T-MEC aplicado
        </div>
      </Card>

      {/* KPI strip — client-facing: positive metrics only */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Valor Total Importado', value: fmtUSD(summary.totalValor), sub: 'USD acumulado', color: T.navy },
          { label: 'T-MEC Aplicado', value: `${summary.tmecPct}%`, sub: `${fmtNum(summary.tmecCount)} operaciones`, color: T.green },
          { label: 'Tráficos Completados', value: fmtNum(summary.totalTraficos), sub: `${fmtNum(summary.totalEntradas)} entradas`, color: T.navy },
          { label: 'Documentación', value: '100%', sub: 'Completa para cruces', color: T.green },
        ].map(k => (
          <Card key={k.label} style={{ padding: '14px 16px' }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 36, color: k.color }}>{k.value}</div>
            <div style={{ color: T.textMuted, fontSize: 11, marginTop: 3 }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* Weekly trend + Day of week */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card style={{ padding: 20 }}>
          <SectionTitle title="Valor Importado — Últimas 12 Semanas" sub="USD por semana" />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.navy} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={T.navy} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="label" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickFormatter={v => fmtUSD(v)} />
              <Tooltip content={CustomTooltip} />
              <Area type="monotone" dataKey="valor" stroke={GOLD} strokeWidth={3} fill="url(#valGrad)" activeDot={{ r: 6, stroke: 'white', strokeWidth: 2, fill: GOLD }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: 20 }}>
          <SectionTitle title="Volumen por Día" sub="Tráficos históricos" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="day" tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} tickFormatter={v => fmtNum(v)} />
              <Tooltip content={CustomTooltip} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byDay.map((d, i) => (
                  <Cell key={i} fill={d.count === Math.max(...byDay.map((x: any) => x.count)) ? T.navy : T.border} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Monthly volume + Top proveedores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card style={{ padding: 20 }}>
          <SectionTitle title="Tráficos por Mes" sub="Últimos 12 meses" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: T.textMuted, fontSize: 10 }} axisLine={false} />
              <Tooltip content={CustomTooltip} />
              <Bar dataKey="count" fill={T.gold} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: 20 }}>
          <SectionTitle title="Top Proveedores" sub="Por valor total importado" />
          {proveedores.map((p, i) => {
            const max = proveedores[0]?.valor || 1
            return (
              <div key={p.name} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: T.text, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180, fontWeight: i === 0 ? 700 : 400 }} title={p.fullName}>{p.name}</span>
                  <span style={{ color: T.textSub, fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{fmtUSD(p.valor)}</span>
                </div>
                <div style={{ height: 4, background: T.border, borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${(p.valor / max) * 100}%`, height: '100%', background: i === 0 ? T.navy : i < 3 ? T.gold : '#CEC9BF', borderRadius: 99 }} />
                </div>
              </div>
            )
          })}
        </Card>
      </div>

      {/* Cruces completados summary — client-friendly */}
      <Card style={{ padding: 20 }}>
        <SectionTitle title="Operaciones Completadas" sub="Tráficos cruzados exitosamente" />
        <div style={{ display: 'flex', gap: 16 }}>
          {statusData.filter(s => s.status === 'Cruzado' || s.status === 'Pedimento Pagado').map(s => (
            <div key={s.status} style={{ flex: 1, background: T.surfaceAlt, border: `1px solid ${T.border}`, borderTop: `3px solid ${T.green}`, borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ color: T.green, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmtNum(s.count)}</div>
              <div style={{ color: T.text, fontSize: 12, fontWeight: 600, marginTop: 4 }}>{s.status}</div>
              <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>{s.pct}% del total</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Monthly Intelligence Reports */}
      {monthlyReports.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Reportes Mensuales</div>
          </div>
          {monthlyReports.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: `1px solid ${T.border}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                  {r.period_label || (r.report_month ? new Date(r.report_month).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) : 'Reporte mensual')}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                  Generado: {r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </div>
              </div>
              {r.pdf_url ? (
                <a href={r.pdf_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: T.navy, textDecoration: 'none' }}>Descargar PDF →</a>
              ) : (
                <span style={{ fontSize: 12, color: T.textMuted, fontStyle: 'italic' }}>En proceso...</span>
              )}
            </div>
          ))}
        </Card>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
