'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { getCookieValue } from '@/lib/client-config'
import { GOLD, ACCENT_SILVER, ACCENT_SILVER_DIM, ACCENT_SILVER_BRIGHT } from '@/lib/design-system'
import { EmptyState } from '@/components/ui/EmptyState'
import { useIsMobile } from '@/hooks/use-mobile'
import { fmtDate } from '@/lib/format-utils'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { DateInputES } from '@/components/ui/DateInputES'

// Generate distinct color from name hash for provider avatars
function avatarColor(name: string): { bg: string; text: string } {
  // AGUILA silver palette (5 stops, monochrome)
  const PALETTE = [
    { bg: 'rgba(232,234,237,0.12)', text: ACCENT_SILVER_BRIGHT },
    { bg: 'rgba(208,213,222,0.12)', text: '#D0D5DE' },
    { bg: 'rgba(192,197,206,0.12)', text: ACCENT_SILVER },
    { bg: 'rgba(154,160,168,0.12)', text: '#9AA0A8' },
    { bg: 'rgba(122,126,134,0.12)', text: ACCENT_SILVER_DIM },
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

// ── Design tokens (v6 warm white) ──────────────────────
const T = {
  bg: 'var(--bg-main)',
  surface: 'var(--bg-card)',
  border: 'var(--border)',
  surfaceAlt: 'var(--bg-elevated)',
  text: 'var(--text-primary)',
  textSub: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  gold: 'var(--gold)',
  goldBg: 'var(--gold-bg)',
  green: 'var(--success)',
  amber: 'var(--warning)',
  red: 'var(--danger)',
  shadow: 'var(--shadow-card)',
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'var(--text-primary)',
  border: 'none',
  borderRadius: 10,
  color: 'white',
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 12px',
  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
  borderLeft: `3px solid ${GOLD}`,
}

interface TraficoRow {
  trafico: string
  estatus?: string
  fecha_llegada?: string | null
  proveedores?: string | null
  importe_total?: number | null
  regimen?: string | null
  company_id?: string | null
  pedimento?: string | null
  descripcion_mercancia?: string | null
  peso_bruto?: number | null
}

interface MonthlyBucket {
  month: string
  label: string
  count: number
}

interface SupplierRow {
  name: string
  count: number
  totalValue: number
  tmecPct: number
}

// ── Helpers ─────────────────────────────────────────────

function fmtUSDShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtNum(v: number): string {
  return v.toLocaleString('es-MX')
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 12, boxShadow: T.shadow, ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ color: T.text, fontSize: 14, fontWeight: 700, margin: 0 }}>{title}</h3>
      {sub && <p style={{ color: T.textMuted, fontSize: 11, margin: '3px 0 0' }}>{sub}</p>}
    </div>
  )
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ color: GOLD, fontSize: 10, marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'white' }}>{payload[0].value.toLocaleString('es-MX')} tráficos</div>
    </div>
  )
}

// ── CSV Export ──────────────────────────────────────────

function exportCSV(rows: TraficoRow[], clientClave: string) {
  const meta = [
    'Renato Zapata & Co.',
    `Clave: ${clientClave}`,
    `Exportado: ${fmtDate(new Date())}`,
    `Total registros: ${rows.length}`,
    '',
  ]
  const headers = ['Tráfico', 'Estatus', 'Fecha', 'Descripción', 'Peso_kg', 'Importe_USD', 'Pedimento', 'Proveedores']
  const csvRows = rows.map(r => [
    r.trafico,
    r.estatus ?? '',
    r.fecha_llegada?.split('T')[0] ?? '',
    (r.descripcion_mercancia ?? '').replace(/,/g, ' '),
    r.peso_bruto ?? '',
    r.importe_total ?? '',
    r.pedimento ?? '',
    (r.proveedores ?? '').replace(/PRV_/g, 'Proveedor ').replace(/,/g, ';'),
  ].join(','))

  // Totals row
  const totalTraficos = rows.length
  const totalValue = rows.reduce((sum, r) => sum + (Number(r.importe_total) || 0), 0)
  const tmecCount = rows.filter(r => {
    const reg = (r.regimen || '').toUpperCase()
    return reg === 'ITE' || reg === 'ITR' || reg === 'IMD'
  }).length
  const tmecPct = totalTraficos > 0 ? ((tmecCount / totalTraficos) * 100).toFixed(1) : '0.0'
  const totalsRow = `TOTALES,${totalTraficos} traficos,,,,${totalValue.toFixed(2)},,T-MEC ${tmecPct}%`

  const blob = new Blob([[...meta, headers.join(','), ...csvRows, '', totalsRow].join('\n')], { type: 'text/csv' })
  const fname = `Portal_Traficos_${clientClave}_${new Date().toISOString().split('T')[0]}.csv`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fname
  a.click()
}

// ── Main Component ─────────────────────────────────────

export function ReportesView() {
  const router = useRouter()
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [companyFilter, setCompanyFilter] = useState<string>('')
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const isMobile = useIsMobile()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Auth cookies
  const [companyId, setCompanyId] = useState('')
  const [clientClave, setClientClave] = useState('')
  const [userRole, setUserRole] = useState('')
  const [cookiesReady, setCookiesReady] = useState(false)
  const [supplierLookup, setSupplierLookup] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    setCompanyId(getCookieValue('company_id') ?? '')
    setClientClave(getCookieValue('company_clave') ?? '')
    setUserRole(getCookieValue('user_role') ?? '')
    setCookiesReady(true)
  }, [])

  const isInternal = userRole === 'broker' || userRole === 'admin'

  // Fetch tráficos
  useEffect(() => {
    if (!cookiesReady) return
    if (!isInternal && !companyId) { setLoading(false); return }
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      table: 'traficos',
      limit: '5000',
      order_by: 'fecha_llegada',
      order_dir: 'desc',
      gte_field: 'fecha_llegada',
      gte_value: '2024-01-01',
    })
    if (!isInternal) {
      params.set('company_id', companyId)

    }

    // Fetch supplier name lookup for PRV_ code resolution
    const _cid = typeof document !== 'undefined' ? (document.cookie.match(/company_id=([^;]+)/)?.[1] || '') : ''
    fetch(`/api/data?table=globalpc_proveedores&limit=5000${_cid ? '&company_id=' + _cid : ''}`)
      .then(r => r.json())
      .then(d => {
        const provs = (d.data ?? []) as { cve_proveedor?: string; nombre?: string }[]
        const lookup = new Map<string, string>()
        provs.forEach(p => {
          if (p.cve_proveedor && p.nombre) lookup.set(p.cve_proveedor, p.nombre)
        })
        setSupplierLookup(lookup)
      })
      .catch(() => { /* supplier lookup is best-effort */ })

    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(d => {
        const arr = d.data ?? d
        setRows(Array.isArray(arr) ? arr : [])

        // Extract unique companies for broker filter
        if (isInternal) {
          const companyMap = new Map<string, string>()
          ;(Array.isArray(arr) ? arr : []).forEach((r: TraficoRow) => {
            if (r.company_id && !companyMap.has(r.company_id)) {
              // Use company_id as both id and display name
              companyMap.set(r.company_id, r.company_id)
            }
          })
          setCompanies([...companyMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))
        }
      })
      .catch(() => setError('No se pudieron cargar los reportes.'))
      .finally(() => setLoading(false))
  }, [cookiesReady, companyId, clientClave, isInternal, retryKey])

  // Filtered rows (broker can filter by company + date range)
  const filteredRows = useMemo(() => {
    let out = rows
    if (companyFilter) out = out.filter(r => r.company_id === companyFilter)
    // Normalize date range: swap if dateFrom > dateTo
    let from = dateFrom
    let to = dateTo
    if (from && to && from > to) {
      from = dateTo
      to = dateFrom
    }
    if (from) out = out.filter(r => (r.fecha_llegada || '') >= from)
    if (to) out = out.filter(r => (r.fecha_llegada || '') <= to)
    return out
  }, [rows, companyFilter, dateFrom, dateTo])

  // ── SECTION 1: Resumen Mensual ───────────────────────
  const monthlyData: MonthlyBucket[] = useMemo(() => {
    const monthMap: Record<string, number> = {}
    filteredRows.forEach(t => {
      if (!t.fecha_llegada) return
      const key = t.fecha_llegada.substring(0, 7) // YYYY-MM
      monthMap[key] = (monthMap[key] || 0) + 1
    })
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([m, count]) => ({
        month: m,
        label: new Date(m + '-01').toLocaleDateString('es-MX', {
          month: 'short',
          year: '2-digit',
          timeZone: 'America/Chicago',
        }),
        count,
      }))
  }, [filteredRows])

  const totalFiltered = filteredRows.length

  // ── SECTION 2: Top Proveedores ───────────────────────
  const supplierData: SupplierRow[] = useMemo(() => {
    const suppMap = new Map<string, { count: number; totalValue: number; tmecCount: number }>()
    filteredRows.forEach(t => {
      const provStr = t.proveedores
      if (!provStr) return
      const suppliers = provStr.split(',').map(s => s.trim()).filter(Boolean)
      suppliers.forEach(rawName => {
        // Resolve PRV_ codes to real supplier names
        const name = supplierLookup.get(rawName) || rawName.replace(/^PRV_/, 'Proveedor ')
        const prev = suppMap.get(name) || { count: 0, totalValue: 0, tmecCount: 0 }
        prev.count++
        prev.totalValue += Number(t.importe_total) || 0
        const reg = (t.regimen || '').toUpperCase()
        if (reg === 'ITE' || reg === 'ITR' || reg === 'IMD') prev.tmecCount++
        suppMap.set(name, prev)
      })
    })
    return [...suppMap.entries()]
      .map(([name, stats]) => ({
        name,
        count: stats.count,
        totalValue: stats.totalValue,
        tmecPct: stats.count > 0 ? Math.round((stats.tmecCount / stats.count) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [filteredRows, supplierLookup])

  // ── SECTION EXTRA: Resumen de Operaciones + T-MEC + Régimen ──
  const opsSummary = useMemo(() => {
    const total = filteredRows.length
    const cruzados = filteredRows.filter(r => (r.estatus || '').toLowerCase().includes('cruz')).length
    const totalValue = filteredRows.reduce((s, r) => s + (Number(r.importe_total) || 0), 0)
    const tmecCount = filteredRows.filter(r => {
      const reg = (r.regimen || '').toUpperCase()
      return reg === 'ITE' || reg === 'ITR' || reg === 'IMD'
    }).length
    const tmecPct = total > 0 ? Math.round(tmecCount / total * 100) : 0
    const successRate = total > 0 ? Math.round(cruzados / total * 100) : 0

    // Regimen breakdown
    const regimenMap = new Map<string, number>()
    filteredRows.forEach(r => {
      const reg = (r.regimen || 'A1').toUpperCase()
      regimenMap.set(reg, (regimenMap.get(reg) || 0) + 1)
    })
    const regimenBreakdown = Array.from(regimenMap.entries()).sort((a, b) => b[1] - a[1])

    return { total, cruzados, totalValue, tmecCount, tmecPct, successRate, regimenBreakdown }
  }, [filteredRows])

  // ── Error ─────────────────────────────────
  if (error) return (
    <div className="page-shell">
      <ErrorCard message={error} onRetry={() => setRetryKey(k => k + 1)} />
    </div>
  )

  // ── Loading skeleton ─────────────────────────────────
  if (loading) return (
    <div className="page-shell">
      <div className="skeleton-shimmer" style={{ width: 200, height: 24, marginBottom: 20 }} />
      <div className="skeleton-shimmer" style={{ height: 280, marginBottom: 16 }} />
      <div className="skeleton-shimmer" style={{ height: 200, marginBottom: 16 }} />
      <div className="skeleton-shimmer" style={{ height: 60 }} />
    </div>
  )

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 24 }}>
        <div>
          <h2 className="page-title">Reportes</h2>
          <p className="page-subtitle">{totalFiltered.toLocaleString('es-MX')} tráficos</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <DateInputES value={dateFrom} onChange={setDateFrom}
            style={{ height: 60, border: `1px solid ${T.border}`, borderRadius: 6, padding: '0 12px', fontSize: 13, color: T.textSub, background: T.surfaceAlt }} />
          <span style={{ color: T.textMuted, fontSize: 11 }}>—</span>
          <DateInputES value={dateTo} onChange={setDateTo}
            style={{ height: 60, border: `1px solid ${T.border}`, borderRadius: 6, padding: '0 12px', fontSize: 13, color: T.textSub, background: T.surfaceAlt }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }}
              style={{ fontSize: 13, fontWeight: 600, color: T.red, border: `1px solid ${T.red}33`, background: 'var(--danger-bg)', borderRadius: 6, padding: '0 12px', minWidth: 40, minHeight: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          )}
        </div>

        {/* Broker company filter */}
        {isInternal && companies.length > 0 && (
          <select
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.surface,
              color: T.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              minHeight: 60,
              minWidth: 180,
            }}
          >
            <option value="">Todos los clientes</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ─── SECTION 1: Resumen Mensual ──────────────── */}
      <Card style={{ padding: 20, marginBottom: 24 }}>
        <SectionTitle title="Resumen Mensual" sub="Total de tráficos por mes — últimos 6 meses" />
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
            <BarChart data={monthlyData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: T.textMuted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: T.textMuted, fontSize: 10, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill={T.gold} radius={[4, 4, 0, 0]} cursor="pointer" label={{ position: 'top', fill: T.textMuted, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                onClick={(_data: unknown, idx: number) => {
                  const bucket = monthlyData[idx]
                  if (bucket?.month) {
                    const [y, m] = bucket.month.split('-')
                    router.push(`/traficos?from=${y}-${m}-01&to=${y}-${m}-31`)
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon="📊" title="Sin datos para el período" description="Los tráficos aparecerán aquí cuando se registren" />
        )}
      </Card>

      {/* ─── SECTION 2: Top Proveedores ──────────────── */}
      <Card style={{ marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
          <SectionTitle
            title="Top 10 Proveedores"
            sub="Por cantidad de tráficos · Incluye valor total y cobertura T-MEC"
          />
        </div>
        {supplierData.length > 0 ? (
          isMobile ? (
            <div style={{ padding: 12 }}>
              {supplierData.map((s, i) => (
                <div key={s.name} style={{
                  background: i === 0 ? T.goldBg : T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  borderLeft: `4px solid ${i === 0 ? T.gold : T.border}`,
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: avatarColor(s.name).bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: avatarColor(s.name).text, flexShrink: 0,
                    }}>
                      {s.name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase().slice(0, 2)}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{s.name}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tráficos</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: T.text }}>{s.count}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: T.text }}>{fmtUSDShort(s.totalValue)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>T-MEC</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: s.tmecPct >= 50 ? T.green : T.amber }}>{s.tmecPct}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    <th scope="col" style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>#</th>
                    <th scope="col" style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Proveedor</th>
                    <th scope="col" style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tráficos</th>
                    <th scope="col" style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valor Total</th>
                    <th scope="col" style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>T-MEC %</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierData.map((s, i) => (
                    <tr
                      key={s.name}
                      style={{
                        borderBottom: `1px solid ${T.border}`,
                        background: i === 0 ? T.goldBg : s.tmecPct === 0 ? 'var(--amber-50)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: T.textMuted }}>{i + 1}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: avatarColor(s.name).bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 700, color: avatarColor(s.name).text, flexShrink: 0,
                          }}>
                            {s.name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase().slice(0, 2)}
                          </div>
                          <span style={{ fontWeight: 600, color: T.text, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                            {s.name}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtNum(s.count)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtUSDShort(s.totalValue)} USD</td>
                      <td style={{
                        padding: '12px 20px', textAlign: 'right',
                        fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: s.tmecPct >= 50 ? T.green : s.tmecPct > 0 ? T.amber : T.textMuted,
                      }}>
                        {s.tmecPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <EmptyState icon="🏭" title="Sin datos de proveedores" description="Los proveedores aparecerán cuando se registren tráficos" />
        )}
      </Card>

      {/* ─── SECTION 3: Resumen de Operaciones ────────── */}
      <Card style={{ padding: 20 }}>
        <SectionTitle title="Resumen de Operaciones" sub="Indicadores clave del período seleccionado" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { label: 'Total Operaciones', value: fmtNum(opsSummary.total) },
            { label: 'Cruzados', value: fmtNum(opsSummary.cruzados) },
            { label: 'Valor USD', value: fmtUSDShort(opsSummary.totalValue) },
            { label: 'Tasa de Éxito', value: `${opsSummary.successRate}%` },
            { label: 'T-MEC', value: `${opsSummary.tmecPct}%` },
            { label: 'Operaciones T-MEC', value: fmtNum(opsSummary.tmecCount) },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: T.surfaceAlt, borderRadius: 8, padding: '12px 16px',
              border: `1px solid ${T.border}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                {kpi.label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: T.text }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── SECTION 4: Distribución por Régimen ──────── */}
      {opsSummary.regimenBreakdown.length > 0 && (
        <Card style={{ padding: 20 }}>
          <SectionTitle title="Distribución por Régimen" sub="Tipo de operación aduanal" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {opsSummary.regimenBreakdown.map(([reg, count]) => {
              const pct = opsSummary.total > 0 ? Math.round(count / opsSummary.total * 100) : 0
              const isTmec = reg === 'ITE' || reg === 'ITR' || reg === 'IMD'
              return (
                <div key={reg} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                    color: isTmec ? T.green : T.text, minWidth: 40,
                  }}>
                    {reg}
                  </span>
                  <div style={{ flex: 1, height: 8, background: T.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: isTmec ? T.green : T.gold,
                      borderRadius: 4,
                    }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: T.textMuted, minWidth: 70, textAlign: 'right' }}>
                    {count} ({pct}%)
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ─── SECTION 5: Exportar ─────────────────────── */}
      <Card style={{ padding: 20 }}>
        <SectionTitle title="Exportar" sub="Descarga los datos en el formato que necesites" />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => exportCSV(filteredRows, clientClave || 'ALL')}
            disabled={filteredRows.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 20px',
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              background: T.surface,
              fontSize: 13,
              fontWeight: 600,
              color: filteredRows.length === 0 ? T.textMuted : T.text,
              cursor: filteredRows.length === 0 ? 'not-allowed' : 'pointer',
              minHeight: 60,
              transition: 'all 150ms',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div>Exportar CSV</div>
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400, marginTop: 2 }}>
                {fmtNum(filteredRows.length)} registros
              </div>
            </div>
          </button>

          <button
            onClick={() => window.open('/api/reportes-pdf', '_blank')}
            disabled={filteredRows.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 20px',
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              background: filteredRows.length === 0 ? 'transparent' : T.surface,
              fontSize: 13,
              fontWeight: 600,
              color: filteredRows.length === 0 ? T.textMuted : T.text,
              cursor: filteredRows.length === 0 ? 'not-allowed' : 'pointer',
              minHeight: 60,
              opacity: filteredRows.length === 0 ? 0.5 : 1,
              transition: 'all 150ms',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div>Generar PDF</div>
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 400, marginTop: 2 }}>
                Reporte completo
              </div>
            </div>
          </button>
        </div>
      </Card>

      <p style={{ fontSize: 10, color: T.textMuted, marginTop: 20, fontStyle: 'italic', textAlign: 'center' }}>
        Renato Zapata & Co. · Patente 3596 · Aduana 240, Nuevo Laredo
      </p>
    </div>
  )
}
