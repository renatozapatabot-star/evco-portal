'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, ChevronRight } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtUSD } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { useRouter } from 'next/navigation'

interface TraficoRow {
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
  valorPromedio: number
  tmec: boolean
}

export default function CatalogoPage() {
  const router = useRouter()
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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
      table: 'traficos',
      limit: '5000',
      order_by: 'fecha_llegada',
      order_dir: 'desc',
      not_null: 'descripcion_mercancia',
    })
    if (!isInternal && companyId) params.set('company_id', companyId)

    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [cookiesReady, companyId, userRole])

  const grouped = useMemo(() => {
    const map = new Map<string, { fraccion: string; count: number; totalValor: number; hasTmec: boolean }>()
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
      } else {
        map.set(key, { fraccion, count: 1, totalValor: valor, hasTmec: tmec })
      }
    }

    let result: ProductGroup[] = Array.from(map.entries())
      .map(([key, data]) => ({
        descripcion: key.charAt(0) + key.slice(1).toLowerCase(),
        fraccion: data.fraccion,
        count: data.count,
        valorPromedio: data.count > 0 ? data.totalValor / data.count : 0,
        tmec: data.hasTmec,
      }))
      .sort((a, b) => b.count - a.count)

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(g =>
        g.descripcion.toLowerCase().includes(q) || g.fraccion.toLowerCase().includes(q)
      )
    }
    return result
  }, [rows, search])

  return (
    <div className="page-container" style={{ padding: 'var(--page-padding, 24px)' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Catálogo de Productos</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          {grouped.length} productos agrupados por descripción de mercancía
        </p>
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-card)', border: '1px solid var(--border-card)',
        borderRadius: 8, padding: '0 12px', height: 40,
        marginBottom: 16, maxWidth: 360,
      }}>
        <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <input
          placeholder="Buscar descripción o fracción..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 14, color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-card)',
        borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-card)',
      }}>
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, borderRadius: 4 }} />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div style={{ padding: 32 }}>
            <EmptyState
              icon="📋"
              title="Sin productos registrados"
              description="Los productos de sus operaciones aparecerán aquí agrupados por tipo"
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Fracción</th>
                  <th style={{ textAlign: 'right' }}>Operaciones</th>
                  <th style={{ textAlign: 'right' }}>Valor Promedio USD</th>
                  <th>T-MEC</th>
                  <th style={{ width: 28 }}></th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g, i) => (
                  <tr
                    key={g.descripcion}
                    className={`clickable-row ${i % 2 === 0 ? 'row-even' : 'row-odd'}`}
                    onClick={() => router.push(`/traficos?search=${encodeURIComponent(g.descripcion.slice(0, 40))}`)}
                  >
                    <td style={{
                      maxWidth: 300, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontWeight: 500,
                    }}>
                      {g.descripcion}
                    </td>
                    <td style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: g.fraccion ? 'var(--gold, #C4963C)' : 'var(--text-tertiary)',
                      fontSize: 13,
                    }}>
                      {g.fraccion || '—'}
                    </td>
                    <td style={{
                      textAlign: 'right', fontFamily: 'var(--font-mono)',
                      fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                    }}>
                      {g.count}
                    </td>
                    <td style={{
                      textAlign: 'right', fontFamily: 'var(--font-mono)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {g.valorPromedio > 0 ? fmtUSD(g.valorPromedio) : '—'}
                    </td>
                    <td>
                      {g.tmec && (
                        <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>T-MEC</span>
                      )}
                    </td>
                    <td style={{ width: 28, textAlign: 'center' }}>
                      <ChevronRight size={14} style={{ color: 'var(--slate-300)' }} />
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
