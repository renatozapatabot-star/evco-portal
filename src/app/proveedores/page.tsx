'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, Building2, TrendingUp } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDate, fmtUSD, fmtUSDCompact } from '@/lib/format-utils'
import { countryFlag } from '@/lib/carrier-names'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'

/* ── Design tokens (dark page) ── */
const T = {
  bg: '#0D0D0C',
  surface: '#161614',
  surfaceHover: '#1E1E1B',
  surfaceActive: '#252219',
  border: '#2A2824',
  text: '#EAE6DC',
  textSecondary: '#9C9890',
  textMuted: '#6B6560',
  gold: '#C4963C',
  goldSubtle: 'rgba(184,149,63,0.12)',
  goldBorder: 'rgba(184,149,63,0.25)',
  green: '#2D8540',
  red: '#C23B22',
  mono: 'var(--font-jetbrains-mono)',
} as const

interface TraficoRow {
  trafico: string
  proveedores?: string | null
  pais_procedencia?: string | null
  importe_total?: number | null
  fecha_llegada?: string | null
  estatus?: string | null
  descripcion_mercancia?: string | null
  company_id?: string | null
}

interface SupplierAgg {
  name: string
  country: string | null
  traficoCount: number
  totalValue: number
  lastDate: string | null
  avgValue: number
  traficos: TraficoRow[]
}

export default function ProveedoresPage() {
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState<string>('all')

  const [userRole, setUserRole] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [clientClave, setClientClave] = useState('')

  useEffect(() => {
    setUserRole(getCookieValue('user_role') ?? '')
    setCompanyId(getCookieValue('company_id') ?? '')
    setClientClave(getCookieValue('company_clave') ?? '')
  }, [])

  const isInternal = userRole === 'broker' || userRole === 'admin'

  // Fetch traficos with proveedores field
  useEffect(() => {
    if (!companyId && !isInternal) return
    const params = new URLSearchParams({
      table: 'traficos',
      limit: '5000',
      order_by: 'fecha_llegada',
      order_dir: 'desc',
    })
    if (!isInternal && companyId) {
      params.set('company_id', companyId)

    }

    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(d => {
        const arr = (d.data ?? d) as TraficoRow[]
        setRows(Array.isArray(arr) ? arr : [])
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [companyId, clientClave, isInternal])

  // Extract unique client IDs for broker filter
  const clientIds = useMemo(() => {
    if (!isInternal) return []
    const ids = new Set<string>()
    rows.forEach(r => { if (r.company_id) ids.add(r.company_id) })
    return Array.from(ids).sort()
  }, [rows, isInternal])

  // Aggregate suppliers from traficos
  const suppliers = useMemo(() => {
    const map = new Map<string, SupplierAgg>()
    const filteredRows = clientFilter === 'all' ? rows : rows.filter(r => r.company_id === clientFilter)

    for (const r of filteredRows) {
      const prov = r.proveedores
      if (!prov || (typeof prov === 'string' && !prov.trim())) continue

      // proveedores can be comma-separated text or JSONB stringified
      let names: string[] = []
      if (typeof prov === 'string') {
        // Try parsing as JSON array first
        try {
          const parsed = JSON.parse(prov)
          if (Array.isArray(parsed)) names = parsed.map(String)
          else names = prov.split(',').map(s => s.trim()).filter(Boolean)
        } catch {
          names = prov.split(',').map(s => s.trim()).filter(Boolean)
        }
      }

      for (const raw of names) {
        const name = raw.trim()
        if (!name) continue
        const key = name.toLowerCase()
        const existing = map.get(key)
        const val = Number(r.importe_total) || 0

        if (existing) {
          existing.traficoCount++
          existing.totalValue += val
          existing.traficos.push(r)
          if (r.fecha_llegada && (!existing.lastDate || r.fecha_llegada > existing.lastDate)) {
            existing.lastDate = r.fecha_llegada
          }
          if (!existing.country && r.pais_procedencia) {
            existing.country = r.pais_procedencia
          }
        } else {
          map.set(key, {
            name,
            country: r.pais_procedencia ?? null,
            traficoCount: 1,
            totalValue: val,
            lastDate: r.fecha_llegada ?? null,
            avgValue: 0,
            traficos: [r],
          })
        }
      }
    }

    // Compute avg and sort
    const arr = Array.from(map.values())
    arr.forEach(s => { s.avgValue = s.traficoCount > 0 ? s.totalValue / s.traficoCount : 0 })
    arr.sort((a, b) => b.traficoCount - a.traficoCount)
    return arr
  }, [rows, clientFilter])

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers
    const q = search.toLowerCase()
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.country ?? '').toLowerCase().includes(q)
    )
  }, [suppliers, search])

  const totalValue = suppliers.reduce((s, r) => s + r.totalValue, 0)

  return (
    <div style={{ minHeight: '100vh', background: T.bg, margin: -36, padding: 36 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0 }}>
            Proveedores
          </h1>
          <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>
            {suppliers.length} proveedores &middot; {fmtUSDCompact(totalValue)} valor total
          </p>
        </div>
      </div>

      {/* KPI strip */}
      {!loading && suppliers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Proveedores', value: String(suppliers.length), color: T.gold },
            { label: 'Tráficos con proveedor', value: String(new Set(suppliers.flatMap(s => s.traficos.map(t => t.trafico))).size), color: T.text },
            { label: 'Valor total', value: fmtUSDCompact(totalValue), color: T.green },
            { label: 'Promedio por embarque', value: totalValue > 0 && suppliers.length > 0 ? fmtUSDCompact(totalValue / suppliers.reduce((s, r) => s + r.traficoCount, 0)) : '—', color: T.text },
          ].map(kpi => (
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
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: '0 12px', height: 36, flex: 1, maxWidth: 360,
        }}>
          <Search size={14} style={{ color: T.textMuted }} />
          <input
            placeholder="Buscar proveedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: T.text, fontSize: 13, fontFamily: 'var(--font-geist-sans)',
            }}
          />
        </div>

        {isInternal && clientIds.length > 1 && (
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            style={{
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: '0 12px', height: 36, color: T.text, fontSize: 13,
              fontFamily: 'var(--font-geist-sans)', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="all">Todos los clientes</option>
            {clientIds.map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ height: 48, background: T.surface, borderRadius: i === 0 ? '8px 8px 0 0' : i === 9 ? '0 0 8px 8px' : 0 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 48 }}>
          <EmptyState
            icon="🏭"
            title={search ? `Sin resultados para "${search}"` : 'Sin datos de proveedores'}
            description={search ? 'Intenta con otro término' : 'Los proveedores se extraen del campo proveedores de cada tráfico'}
          />
        </div>
      ) : (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 100px 140px 120px 60px',
            padding: '10px 16px',
            borderBottom: `1px solid ${T.border}`,
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: T.textMuted,
          }}>
            <span />
            <span>Proveedor</span>
            <span style={{ textAlign: 'right' }}>Tráficos</span>
            <span style={{ textAlign: 'right' }}>Valor total</span>
            <span style={{ textAlign: 'right' }}>Último embarque</span>
            <span style={{ textAlign: 'center' }}>País</span>
          </div>

          {/* Rows */}
          {filtered.map((s, idx) => {
            const isExpanded = expandedSupplier === s.name
            return (
              <div key={s.name}>
                <div
                  onClick={() => setExpandedSupplier(isExpanded ? null : s.name)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr 100px 140px 120px 60px',
                    padding: '12px 16px',
                    alignItems: 'center',
                    borderBottom: `1px solid ${T.border}`,
                    cursor: 'pointer',
                    background: isExpanded ? T.surfaceActive : 'transparent',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = T.surfaceHover }}
                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ color: T.textMuted }}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: T.goldSubtle, border: `1px solid ${T.goldBorder}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Building2 size={14} style={{ color: T.gold }} />
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: T.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.name}
                    </span>
                    {idx < 3 && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 9999,
                        background: T.goldSubtle, color: T.gold, border: `1px solid ${T.goldBorder}`,
                        flexShrink: 0,
                      }}>
                        TOP {idx + 1}
                      </span>
                    )}
                  </div>
                  <span style={{ textAlign: 'right', fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.text }}>
                    {s.traficoCount}
                  </span>
                  <span style={{ textAlign: 'right', fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.green }}>
                    {s.totalValue > 0 ? fmtUSD(s.totalValue) : <span style={{ color: T.textMuted }}>—</span>}
                  </span>
                  <span style={{ textAlign: 'right', fontFamily: T.mono, fontSize: 12, color: T.textSecondary }}>
                    {s.lastDate ? fmtDate(s.lastDate) : '—'}
                  </span>
                  <span style={{ textAlign: 'center', fontSize: 16 }}>
                    {s.country ? countryFlag(s.country) : '🌐'}
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <SupplierDetail supplier={s} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   SUPPLIER DETAIL — expanded row
   ══════════════════════════════════════════ */
function SupplierDetail({ supplier: s }: { supplier: SupplierAgg }) {
  // Most common descriptions (proxy for product/doc types)
  const descFreq = useMemo(() => {
    const map = new Map<string, number>()
    s.traficos.forEach(t => {
      const desc = (t.descripcion_mercancia ?? '').trim()
      if (desc) map.set(desc, (map.get(desc) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [s])

  return (
    <div style={{
      background: T.surfaceActive, borderBottom: `1px solid ${T.border}`,
      padding: '20px 16px 20px 48px',
    }}>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Tráficos', value: String(s.traficoCount) },
          { label: 'Valor total', value: s.totalValue > 0 ? fmtUSD(s.totalValue) : '—' },
          { label: 'Promedio por embarque', value: s.avgValue > 0 ? fmtUSD(s.avgValue) : '—' },
          { label: 'País', value: s.country ? `${countryFlag(s.country)} ${s.country}` : '🌐 Desconocido' },
          { label: 'Primer embarque', value: s.traficos.length > 0 ? fmtDate(s.traficos[s.traficos.length - 1].fecha_llegada) : '—' },
          { label: 'Último embarque', value: s.lastDate ? fmtDate(s.lastDate) : '—' },
        ].map(stat => (
          <div key={stat.label}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textMuted, marginBottom: 4 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: T.mono, color: T.text }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Common descriptions */}
      {descFreq.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textMuted, marginBottom: 8 }}>
            Mercancías frecuentes
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {descFreq.map(([desc, count]) => (
              <span key={desc} style={{
                fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
                color: T.textSecondary, maxWidth: 280,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {desc} <span style={{ color: T.textMuted, fontFamily: T.mono }}>({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tráficos list */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textMuted, marginBottom: 8 }}>
          Tráficos ({s.traficos.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {s.traficos.slice(0, 20).map(t => {
            const isCruzado = (t.estatus ?? '').toLowerCase().includes('cruz')
            return (
              <Link
                key={t.trafico}
                href={`/traficos/${encodeURIComponent(t.trafico)}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 100px 1fr 100px',
                  padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${T.border}`,
                  textDecoration: 'none', alignItems: 'center',
                  gap: 8, transition: 'background 100ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = T.surfaceHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              >
                <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.gold }}>
                  {fmtId(t.trafico)}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
                  background: isCruzado ? 'rgba(45,133,64,0.15)' : 'rgba(196,127,23,0.15)',
                  color: isCruzado ? T.green : '#C47F17',
                  border: `1px solid ${isCruzado ? 'rgba(45,133,64,0.25)' : 'rgba(196,127,23,0.25)'}`,
                  textAlign: 'center',
                }}>
                  {isCruzado ? 'Cruzado' : 'En Proceso'}
                </span>
                <span style={{ fontSize: 12, color: T.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.descripcion_mercancia ?? '—'}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.text, textAlign: 'right' }}>
                  {t.importe_total && Number(t.importe_total) > 0 ? fmtUSD(Number(t.importe_total)) : '—'}
                </span>
              </Link>
            )
          })}
          {s.traficos.length > 20 && (
            <div style={{ fontSize: 12, color: T.textMuted, padding: '8px 12px' }}>
              +{s.traficos.length - 20} tráficos más
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
