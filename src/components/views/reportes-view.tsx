'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getCookieValue } from '@/lib/client-config'
import { GOLD } from '@/lib/design-system'
import { useIsMobile } from '@/hooks/use-mobile'
import { fmtDate } from '@/lib/format-utils'

// ── Design tokens (v6 warm white) ──────────────────────
const T = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  border: '#E8E6E0',
  surfaceAlt: '#F5F3EF',
  text: '#1A1A1A',
  textSub: '#6B6B6B',
  textMuted: '#999999',
  gold: '#B8953F',
  goldBg: '#FFF8EB',
  green: '#2D8540',
  amber: '#C47F17',
  red: '#C23B22',
  shadow: '0 1px 3px rgba(0,0,0,0.07)',
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#1A1710',
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
    'CRUZ — Renato Zapata & Company',
    `Clave: ${clientClave}`,
    `Exportado: ${fmtDate(new Date())}`,
    `Total registros: ${rows.length}`,
    '',
  ]
  const headers = ['Trafico', 'Estatus', 'Fecha', 'Descripcion', 'Peso_kg', 'Importe_USD', 'Pedimento', 'Proveedores']
  const csvRows = rows.map(r => [
    r.trafico,
    r.estatus ?? '',
    r.fecha_llegada?.split('T')[0] ?? '',
    (r.descripcion_mercancia ?? '').replace(/,/g, ' '),
    r.peso_bruto ?? '',
    r.importe_total ?? '',
    r.pedimento ?? '',
    (r.proveedores ?? '').replace(/,/g, ';'),
  ].join(','))

  const blob = new Blob([[...meta, headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
  const fname = `CRUZ_Traficos_${clientClave}_${new Date().toISOString().split('T')[0]}.csv`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fname
  a.click()
}

// ── Main Component ─────────────────────────────────────

export function ReportesView() {
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [companyFilter, setCompanyFilter] = useState<string>('')
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const isMobile = useIsMobile()

  // Auth cookies
  const [companyId, setCompanyId] = useState('')
  const [clientClave, setClientClave] = useState('')
  const [userRole, setUserRole] = useState('')
  const [cookiesReady, setCookiesReady] = useState(false)

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

    const params = new URLSearchParams({
      table: 'traficos',
      limit: '5000',
      order_by: 'fecha_llegada',
      order_dir: 'desc',
    })
    if (!isInternal) {
      params.set('company_id', companyId)
      if (clientClave) params.set('trafico_prefix', `${clientClave}-`)
    }

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
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [cookiesReady, companyId, clientClave, isInternal])

  // Filtered rows (broker can filter by company)
  const filteredRows = useMemo(() => {
    if (!companyFilter) return rows
    return rows.filter(r => r.company_id === companyFilter)
  }, [rows, companyFilter])

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
      suppliers.forEach(name => {
        const prev = suppMap.get(name) || { count: 0, totalValue: 0, tmecCount: 0 }
        prev.count++
        prev.totalValue += Number(t.importe_total) || 0
        const reg = t.regimen
        if (reg === 'ITE' || reg === 'ITR') prev.tmecCount++
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
  }, [filteredRows])

  // ── Loading skeleton ─────────────────────────────────
  if (loading) return (
    <div style={{ padding: '24px 28px' }}>
      <div className="skeleton" style={{ width: 200, height: 24, marginBottom: 20 }} />
      <div className="skeleton" style={{ height: 280, borderRadius: 12, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 12, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 60, borderRadius: 12 }} />
    </div>
  )

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 28px', fontFamily: 'var(--font-geist-sans)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div>
          <h2 style={{ color: T.text, fontSize: 18, fontWeight: 700, margin: 0 }}>Reportes</h2>
          <p style={{ color: T.textMuted, fontSize: 12, margin: '4px 0 0' }}>
            {totalFiltered.toLocaleString('es-MX')} tráficos · Últimos 6 meses
          </p>
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
              minHeight: 40,
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
                tick={{ fill: T.textMuted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill={T.gold} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div style={{ color: T.textSub, fontSize: 13, fontWeight: 600 }}>Sin datos para el período</div>
            <div style={{ color: T.textMuted, fontSize: 12, marginTop: 4 }}>Los tráficos aparecerán aquí cuando se registren</div>
          </div>
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
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 8 }}>
                    {s.name}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tráficos</div>
                      <div style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: 16, fontWeight: 700, color: T.text }}>{s.count}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor</div>
                      <div style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: 16, fontWeight: 700, color: T.text }}>{fmtUSDShort(s.totalValue)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>T-MEC</div>
                      <div style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: 16, fontWeight: 700, color: s.tmecPct >= 50 ? T.green : T.amber }}>{s.tmecPct}%</div>
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
                    <th scope="col" style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9C9890', textTransform: 'uppercase', letterSpacing: '0.06em' }}>#</th>
                    <th scope="col" style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9C9890', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Proveedor</th>
                    <th scope="col" style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#9C9890', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tráficos</th>
                    <th scope="col" style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#9C9890', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valor Total</th>
                    <th scope="col" style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#9C9890', textTransform: 'uppercase', letterSpacing: '0.06em' }}>T-MEC %</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierData.map((s, i) => (
                    <tr
                      key={s.name}
                      style={{
                        borderBottom: `1px solid ${T.border}`,
                        background: i === 0 ? T.goldBg : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 20px', fontFamily: 'var(--font-jetbrains-mono)', fontSize: 12, color: T.textMuted }}>{i + 1}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: T.text, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>{s.name}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 600 }}>{fmtNum(s.count)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 600 }}>{fmtUSDShort(s.totalValue)} USD</td>
                      <td style={{
                        padding: '12px 20px', textAlign: 'right',
                        fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 700,
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
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏭</div>
            <div style={{ color: T.textSub, fontSize: 13, fontWeight: 600 }}>Sin datos de proveedores</div>
            <div style={{ color: T.textMuted, fontSize: 12, marginTop: 4 }}>Los proveedores aparecerán cuando se registren tráficos</div>
          </div>
        )}
      </Card>

      {/* ─── SECTION 3: Exportar ─────────────────────── */}
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
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 20px',
              border: `1px solid ${T.gold}`,
              borderRadius: 8,
              background: T.goldBg,
              fontSize: 13,
              fontWeight: 600,
              color: T.gold,
              cursor: 'pointer',
              minHeight: 60,
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
                Reporte ejecutivo completo
              </div>
            </div>
          </button>
        </div>
      </Card>

      <p style={{ fontSize: 10, color: T.textMuted, marginTop: 20, fontStyle: 'italic', textAlign: 'center' }}>
        CRUZ — Renato Zapata & Company · Patente 3596 · Aduana 240, Nuevo Laredo
      </p>
    </div>
  )
}
