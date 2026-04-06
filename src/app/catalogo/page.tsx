'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, ChevronRight, ArrowUpDown } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtUSD, fmtUSDCompact } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'

interface TraficoRow {
  trafico: string
  descripcion_mercancia: string | null
  importe_total: number | null
  regimen: string | null
  fraccion_arancelaria: string | null
  [key: string]: unknown
}

interface ProductGroup {
  descripcion: string
  fraccion: string
  count: number
  totalValor: number
  tmec: boolean
  traficos: string[]
}

type SortKey = 'count' | 'totalValor' | 'descripcion'

export default function CatalogoPage() {
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('count')
  const [companyId, setCompanyId] = useState('')
  const [userRole, setUserRole] = useState('')
  const [cookiesReady, setCookiesReady] = useState(false)

  useEffect(() => {
    setCompanyId(getCookieValue('company_id') ?? '')
    setUserRole(getCookieValue('user_role') ?? '')
    setCookiesReady(true)
  }, [])

  useEffect(() => {
    if (!cookiesReady) return
    const isInternal = userRole === 'broker' || userRole === 'admin'
    if (!isInternal && !companyId) { setLoading(false); return }

    const params = new URLSearchParams({
      table: 'traficos', limit: '5000',
      order_by: 'fecha_llegada', order_dir: 'desc',
      not_null: 'descripcion_mercancia',
      gte_field: 'fecha_llegada', gte_value: '2024-01-01',
    })
    if (!isInternal && companyId) params.set('company_id', companyId)

    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d.data) ? d.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [cookiesReady, companyId, userRole])

  const grouped = useMemo(() => {
    const map = new Map<string, { fraccion: string; count: number; totalValor: number; hasTmec: boolean; traficos: string[] }>()
    for (const r of rows) {
      const raw = (r.descripcion_mercancia ?? '').trim()
      if (!raw) continue
      const key = raw.toUpperCase()
      const valor = Number(r.importe_total ?? 0)
      const reg = (r.regimen ?? '').toUpperCase()
      const tmec = reg === 'ITE' || reg === 'ITR' || reg === 'IMD'
      const fraccion = (r.fraccion_arancelaria ?? '') as string
      const existing = map.get(key)
      if (existing) {
        existing.count++
        existing.totalValor += valor
        if (tmec) existing.hasTmec = true
        if (!existing.fraccion && fraccion) existing.fraccion = fraccion
        if (existing.traficos.length < 5) existing.traficos.push(r.trafico)
      } else {
        map.set(key, { fraccion, count: 1, totalValor: valor, hasTmec: tmec, traficos: [r.trafico] })
      }
    }

    let result: ProductGroup[] = Array.from(map.entries())
      .map(([key, data]) => ({
        descripcion: key.charAt(0) + key.slice(1).toLowerCase(),
        fraccion: data.fraccion,
        count: data.count,
        totalValor: data.totalValor,
        tmec: data.hasTmec,
        traficos: data.traficos,
      }))

    // Sort
    if (sortBy === 'count') result.sort((a, b) => b.count - a.count)
    else if (sortBy === 'totalValor') result.sort((a, b) => b.totalValor - a.totalValor)
    else result.sort((a, b) => a.descripcion.localeCompare(b.descripcion))

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(g =>
        g.descripcion.toLowerCase().includes(q) ||
        g.fraccion.toLowerCase().includes(q)
      )
    }
    return result
  }, [rows, search, sortBy])

  const totalValue = useMemo(() => rows.reduce((s, r) => s + (Number(r.importe_total) || 0), 0), [rows])

  return (
    <div className="page-shell">
      <div className="section-header">
        <div>
          {/* Title removed — sidebar indicates current page */}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['count', 'totalValor', 'descripcion'] as SortKey[]).map(key => (
            <button key={key} onClick={() => setSortBy(key)}
              style={{
                fontSize: 11, fontWeight: 600, padding: '8px 14px', minHeight: 44, borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${sortBy === key ? 'var(--gold)' : 'var(--border-card)'}`,
                background: sortBy === key ? 'rgba(196,150,60,0.08)' : 'transparent',
                color: sortBy === key ? 'var(--gold-dark, #8B6914)' : 'var(--slate-500)',
              }}>
              {key === 'count' ? 'Frecuencia' : key === 'totalValor' ? 'Valor' : 'A-Z'}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-card)', border: '1px solid var(--border-card)',
        borderRadius: 8, padding: '0 12px', height: 40, marginBottom: 16, maxWidth: 400,
      }}>
        <Search size={14} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
        <input placeholder="Buscar descripción o fracción..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }} />
      </div>

      {/* Table */}
      <div className="table-shell">
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 44, borderRadius: 4 }} />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div style={{ padding: 32 }}>
            <EmptyState icon="📋" title="Sin productos registrados"
              description="Los productos de sus operaciones aparecerán aquí agrupados por tipo" />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="cruz-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Fracción</th>
                  <th style={{ textAlign: 'right' }}>Operaciones</th>
                  <th style={{ textAlign: 'right' }}>Valor Total USD</th>
                  <th>T-MEC</th>
                  <th>Tráficos</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g, i) => (
                  <tr key={g.descripcion} className={`clickable-row ${i % 2 === 0 ? 'row-even' : 'row-odd'}`}>
                    <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {g.descripcion}
                    </td>
                    <td className="font-mono" style={{
                      fontWeight: 600, fontSize: 13,
                      color: g.fraccion ? 'var(--gold-dark, #8B6914)' : 'var(--slate-400)',
                    }}>
                      {g.fraccion || '—'}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {g.count}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {g.totalValor > 0 ? `${fmtUSD(g.totalValor)} USD` : '—'}
                    </td>
                    <td>
                      {g.tmec ? (
                        <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, background: 'var(--success-bg)', padding: '2px 8px', borderRadius: 9999 }}>T-MEC</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {g.traficos.slice(0, 3).map(t => (
                          <Link key={t} href={`/traficos/${encodeURIComponent(t)}`}
                            onClick={e => e.stopPropagation()}
                            className="font-mono" style={{
                              fontSize: 10, fontWeight: 600, color: 'var(--info, #2563EB)',
                              textDecoration: 'none', background: '#EFF6FF',
                              padding: '1px 6px', borderRadius: 4,
                            }}>
                            {t.length > 15 ? t.slice(-8) : t}
                          </Link>
                        ))}
                        {g.traficos.length > 3 && (
                          <span style={{ fontSize: 10, color: 'var(--slate-400)' }}>+{g.traficos.length - 3}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
