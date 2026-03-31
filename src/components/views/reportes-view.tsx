'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

import { CLIENT_CLAVE, COMPANY_ID, CLIENT_NAME } from '@/lib/client-config'
import { GOLD } from '@/lib/design-system'
import { useIsMobile } from '@/hooks/use-mobile'
import { TrendArrow } from '@/components/TrendArrow'
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
function fmtUSDCompact(v: number | undefined | null) {
  const n = Number(v || 0)
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M USD'
  if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'K USD'
  return '$' + n.toLocaleString('en-US') + ' USD'
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

function fmtMXN(v: number) {
  return 'MX$' + v.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function ExecutiveHero({ summary, isMobile }: { summary: Record<string, number | string>; isMobile: boolean }) {
  const executiveSentence = useMemo(() => {
    if (!summary || !summary.totalTraficos) return 'Cargando resumen...'
    const parts: string[] = []
    if (Number(summary.totalTraficos) > 0) parts.push(`${Number(summary.totalTraficos).toLocaleString()} tráficos procesados`)
    if (Number(summary.totalValor) > 0) parts.push(`${fmtUSDCompact(Number(summary.totalValor))} importados`)
    if (Number(summary.tmecCount) > 0) parts.push(`${summary.tmecPct}% con T-MEC`)
    return `${CLIENT_NAME}: ${parts.join(' · ')}.`
  }, [summary])

  const heroKPIs = useMemo(() => {
    const totalTraficos = Number(summary?.totalTraficos || 0)
    const docsCompletosPct = Number(summary?.docsCompletosPct || 0)
    const tasaExito = totalTraficos > 0
      ? Math.round((Number(summary.docsCompletos || 0) / totalTraficos) * 100)
      : 0
    return [
      { label: 'Importado', value: fmtUSDCompact(Number(summary?.totalValor)), trend: null as string | null },
      { label: 'T-MEC', value: `${summary?.tmecPct ?? 0}%`, trend: null as string | null },
      { label: 'Multas', value: '$0', trend: null as string | null },
      { label: 'Tasa éxito', value: `${tasaExito}%`, trend: null as string | null },
      { label: 'Docs completos', value: `${docsCompletosPct}%`, trend: null as string | null },
    ]
  }, [summary])

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1E1A16 0%, #2A2520 100%)',
      borderRadius: 16, padding: isMobile ? '20px' : '28px 32px', marginBottom: 24,
      color: '#EAE6DC',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#B8973A', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Resumen Ejecutivo
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16, letterSpacing: '0.05em' }}>
        {CLIENT_NAME} &middot; Patente 3596 &middot; Aduana 240, Nuevo Laredo
      </div>
      <div style={{ fontSize: 14, color: '#EAE6DC', marginBottom: 20, lineHeight: 1.5 }}>
        {executiveSentence}
      </div>
      <div style={{ display: 'flex', gap: isMobile ? 16 : 28, flexWrap: 'wrap' }}>
        {heroKPIs.map(kpi => (
          <div key={kpi.label} style={{ textAlign: 'center', minWidth: 60 }}>
            <div style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#FFF' }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 10, color: '#7C7870', marginTop: 2 }}>{kpi.label}</div>
            {kpi.trend && <div style={{ fontSize: 10, color: '#B8973A' }}>{kpi.trend}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function EstadoDeCuenta() {
  const [data, setData] = useState<{ totalFacturado: number; porCobrar: number; promDias: number; ultimosPagos: Array<{ fecha: string; importe: number }> } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: cartera } = await supabase.from('econta_cartera')
        .select('tipo, importe, saldo, fecha')
        .eq('cve_cliente', CLAVE)
        .order('fecha', { ascending: false })
        .limit(2000)

      if (!cartera || cartera.length === 0) { setLoading(false); return }

      const totalFacturado = cartera.filter((r: any) => r.tipo === 'C').reduce((s: number, r: any) => s + (r.importe || 0), 0)
      const porCobrar = cartera.reduce((s: number, r: any) => s + (r.saldo || 0), 0)

      // Find last 3 payments (abonos)
      const pagos = cartera.filter((r: any) => r.tipo === 'A').slice(0, 3)

      // Average days between charges and payments (rough estimate)
      const cargos = cartera.filter((r: any) => r.tipo === 'C' && r.fecha)
      const abonos = cartera.filter((r: any) => r.tipo === 'A' && r.fecha)
      let promDias = 0
      if (cargos.length > 0 && abonos.length > 0) {
        const avgCargoDate = cargos.slice(0, 20).reduce((s: number, r: any) => s + new Date(r.fecha).getTime(), 0) / Math.min(cargos.length, 20)
        const avgAbonoDate = abonos.slice(0, 20).reduce((s: number, r: any) => s + new Date(r.fecha).getTime(), 0) / Math.min(abonos.length, 20)
        promDias = Math.max(0, Math.round((avgAbonoDate - avgCargoDate) / (1000 * 60 * 60 * 24)))
      }

      setData({
        totalFacturado,
        porCobrar: Math.abs(porCobrar),
        promDias,
        ultimosPagos: pagos.map((p: any) => ({ fecha: p.fecha, importe: p.importe || 0 })),
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <Card style={{ padding: 20, marginTop: 20 }}>
      <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
    </Card>
  )

  if (!data) return null

  return (
    <Card style={{ padding: 20, marginTop: 20 }}>
      <SectionTitle title="Estado de Cuenta" sub="Resumen financiero del cliente" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: T.surfaceAlt, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Facturado</div>
          <div style={{ color: T.text, fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-jetbrains-mono)', marginTop: 4 }}>{fmtMXN(data.totalFacturado)}</div>
        </div>
        <div style={{ background: T.surfaceAlt, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Por Cobrar</div>
          <div style={{ color: data.porCobrar > 0 ? T.amber : T.green, fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-jetbrains-mono)', marginTop: 4 }}>{fmtMXN(data.porCobrar)}</div>
        </div>
        <div style={{ background: T.surfaceAlt, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Promedio Días Pago</div>
          <div style={{ color: T.text, fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-jetbrains-mono)', marginTop: 4 }}>{data.promDias} días</div>
        </div>
      </div>
      {data.ultimosPagos.length > 0 && (
        <div>
          <div style={{ color: T.textSub, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Últimos 3 Pagos</div>
          {data.ultimosPagos.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < data.ultimosPagos.length - 1 ? `1px solid ${T.border}` : 'none' }}>
              <span style={{ color: T.textSub, fontSize: 12, fontFamily: 'var(--font-jetbrains-mono)' }}>
                {p.fecha ? new Date(p.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Chicago' }) : '—'}
              </span>
              <span style={{ color: T.green, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtMXN(p.importe)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <a href="/cuentas" style={{ color: T.navy, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Ver estado completo →</a>
      </div>
    </Card>
  )
}

function getDateFilter(range: '7d' | '30d' | 'year' | 'all'): string | null {
  const now = new Date()
  if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  if (range === 'year') return new Date(now.getFullYear(), 0, 1).toISOString()
  return null // 'all' = no date filter
}

const DATE_RANGE_OPTIONS: { key: '7d' | '30d' | 'year' | 'all'; label: string }[] = [
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: 'year', label: 'Este año' },
  { key: 'all', label: 'Histórico' },
]

export function ReportesView() {
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [byDay, setByDay] = useState<any[]>([])
  const [byMonth, setByMonth] = useState<any[]>([])
  const [statusData, setStatusData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [monthlyReports, setMonthlyReports] = useState<any[]>([])
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'year' | 'all'>('30d')
  const isMobile = useIsMobile()

  useEffect(() => {
    supabase.from('monthly_intelligence_reports')
      .select('*').eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setMonthlyReports(data || []))
  }, [])

  useEffect(() => {
    async function load() {
      const dateFilter = getDateFilter(dateRange)

      let factQuery = supabase.from('aduanet_facturas')
        .select('valor_usd, dta, igi, iva, fecha_pago, proveedor')
        .eq('clave_cliente', CLAVE)
        .order('fecha_pago', { ascending: true })
      if (dateFilter) factQuery = factQuery.gte('fecha_pago', dateFilter)

      let trafQuery = supabase.from('traficos')
        .select('estatus, fecha_llegada, peso_bruto')
        .eq('company_id', COMPANY_ID)
      if (dateFilter) trafQuery = trafQuery.gte('fecha_llegada', dateFilter)

      let entQuery = supabase.from('entradas')
        .select('tiene_faltantes, mercancia_danada, peso_bruto, fecha_llegada_mercancia')
        .eq('company_id', COMPANY_ID)
      if (dateFilter) entQuery = entQuery.gte('fecha_llegada_mercancia', dateFilter)

      const [factRes, trafRes, entRes] = await Promise.all([
        factQuery, trafQuery, entQuery,
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
      const noTmecCount = facturas.length - tmecCount
      const noTmecValor = facturas.filter((f: any) => (f.igi || 0) > 0).reduce((s: number, f: any) => s + (f.valor_usd || 0), 0)
      const faltantes = entradas.filter((e: any) => e.tiene_faltantes).length
      // Estimated savings: ~5% of non-T-MEC value as potential IGI savings
      const estimatedSavings = Math.round(noTmecValor * 0.05)
      const docsCompletos = traficos.filter((t: any) => t.estatus === 'Cruzado' || t.estatus === 'Pedimento Pagado').length
      const docsCompletosPct = traficos.length > 0 ? Math.round((docsCompletos / traficos.length) * 100) : 0
      // Estimated savings from T-MEC applied: ~5% of T-MEC value as avoided IGI
      const tmecValor = facturas.filter((f: any) => (f.igi || 0) === 0).reduce((s: number, f: any) => s + (f.valor_usd || 0), 0)
      const tmecSavings = Math.round(tmecValor * 0.05)
      setSummary({
        totalValor, tmecCount, totalFacturas: facturas.length,
        tmecPct: facturas.length > 0 ? ((tmecCount / facturas.length) * 100).toFixed(0) : 0,
        noTmecCount, noTmecValor, estimatedSavings, tmecSavings, tmecValor,
        totalTraficos: traficos.length, totalEntradas: entradas.length,
        docsCompletos, docsCompletosPct,
        faltantesPct: entradas.length > 0 ? ((faltantes / entradas.length) * 100).toFixed(2) : 0,
      })
      setLoading(false)
    }
    load()
  }, [dateRange])

  const isHistorico = dateRange === 'all'

  if (loading) return (
    <div style={{ padding: '24px 28px' }}>
      <div className="skeleton" style={{ width: 200, height: 24, marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
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
          <p style={{ color: T.textMuted, fontSize: 12, margin: '4px 0 0' }}>{CLIENT_NAME} · Datos históricos</p>
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

      {/* Date range filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {DATE_RANGE_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setDateRange(opt.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 9999,
              border: `1px solid ${dateRange === opt.key ? T.navy : T.border}`,
              background: dateRange === opt.key ? T.goldBg : T.surface,
              color: dateRange === opt.key ? T.navy : T.textSub,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 150ms',
              minHeight: 36,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Executive hero card — CFO screenshot target */}
      <ExecutiveHero summary={summary} isMobile={isMobile} />

      {/* Summary header — shows data NOT in ExecutiveHero (rectificaciones, entradas, faltantes) */}
      <div style={{
        background: 'rgba(45,133,64,0.06)', border: '1px solid rgba(45,133,64,0.2)',
        borderRadius: 10, padding: '12px 16px', marginBottom: 20,
      }}>
        <span style={{ fontSize: 13, color: T.text }}>
          <strong>Período actual:</strong>{' '}
          {fmtNum(summary.totalTraficos)} tráficos · {fmtNum(summary.totalEntradas || 0)} entradas · {summary.faltantesPct || 0}% con faltantes
        </span>
      </div>

      {/* KPI strip — client-facing: positive metrics only */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Valor Total Importado', value: fmtUSD(summary.totalValor), sub: isHistorico ? 'USD acumulado · histórico' : 'USD acumulado', color: T.navy, trend: null as string | null },
          { label: 'T-MEC Aplicado', value: `${summary.tmecPct}%`, sub: `${fmtNum(summary.tmecCount)} de ${fmtNum(summary.totalFacturas)} pedimentos`, color: T.green, trend: Number(summary.tmecPct) >= 50 ? '↑' : null as string | null },
          { label: 'Tráficos Completados', value: fmtNum(summary.docsCompletos), sub: `${fmtNum(summary.docsCompletos)} de ${fmtNum(summary.totalTraficos)} tráficos`, color: T.navy, trend: null as string | null },
          { label: 'Tasa de Éxito', value: summary.totalTraficos > 0 ? `${summary.docsCompletosPct}%` : '—', sub: 'Incluye rectificaciones y reclasificaciones', color: T.green, trend: Number(summary.docsCompletosPct) >= 90 ? '↑' : null as string | null },
        ].map(k => (
          <Card key={k.label} style={{ padding: '14px 16px' }}>
            <div className="kpi-label">{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div className="kpi-value" style={{ fontSize: isMobile ? 28 : 36, color: k.color }}>{k.value}</div>
              {k.trend && (
                <span style={{ fontSize: 14, fontWeight: 700, color: T.green }}>{k.trend}</span>
              )}
            </div>
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
                  <span style={{ color: T.textSub, fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 8, fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtUSD(p.valor)}</span>
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
              <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>{s.pct}% del total ({fmtNum(s.count)} de {fmtNum(summary.totalTraficos)})</div>
            </div>
          ))}
        </div>
      </Card>

      {/* T-MEC Analysis — two-panel: applied vs opportunity */}
      <Card style={{ padding: 20, marginTop: 20 }}>
        <SectionTitle title="Análisis T-MEC" sub="Cobertura de tratado y oportunidades" />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {/* Left panel — T-MEC applied (green) */}
          <div style={{ background: '#F0FAF2', border: `1px solid #BBF0C8`, borderTop: `3px solid ${T.green}`, borderRadius: 8, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>T-MEC Aplicado</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.green, fontFamily: 'var(--font-jetbrains-mono)' }}>{summary.tmecPct ?? 0}%</div>
            <div style={{ fontSize: 12, color: T.textSub, marginTop: 4 }}>{fmtNum(summary.tmecCount)} de {fmtNum(summary.totalFacturas)} pedimentos</div>
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#E0F5E5', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 2 }}>Ahorro estimado por T-MEC</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.green, fontFamily: 'var(--font-jetbrains-mono)' }}>~{fmtUSD(summary.tmecSavings)}</div>
            </div>
          </div>
          {/* Right panel — opportunity gap (amber) */}
          <div style={{ background: '#FFFBEB', border: `1px solid #FDE68A`, borderTop: `3px solid ${T.amber}`, borderRadius: 8, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.amber, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Oportunidad</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.amber, fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtNum(summary.noTmecCount)}</div>
            <div style={{ fontSize: 12, color: T.textSub, marginTop: 4 }}>pedimentos sin T-MEC · {fmtUSD(summary.noTmecValor)} USD</div>
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#FEF3C7', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 2 }}>Ahorro potencial adicional</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.amber, fontFamily: 'var(--font-jetbrains-mono)' }}>~{fmtUSD(summary.estimatedSavings)}</div>
            </div>
          </div>
        </div>
        <div style={{ color: T.textMuted, fontSize: 10, marginTop: 12, fontStyle: 'italic', textAlign: 'center' }}>
          ~ Estimaciones basadas en tasa promedio por fracción arancelaria. Verificar con su agente aduanal antes de contabilizar.
        </div>
      </Card>

      {/* Estado de Cuenta */}
      <EstadoDeCuenta />

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

      <p style={{ fontSize: 10, color: T.textMuted, marginTop: 24, fontStyle: 'italic' }}>
        ~ Comparaciones son estimaciones directionales basadas en experiencia operativa. No representan datos certificados del sector.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
