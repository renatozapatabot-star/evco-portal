'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtUSD } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'

interface TraficoRow {
  trafico: string
  descripcion_mercancia?: string | null
  importe_total?: number | null
  [key: string]: unknown
}

interface FraccionGroup {
  fraccion: string
  descripcion: string
  count: number
  valorPromedio: number
}

export default function CatalogoPage() {
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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

  useEffect(() => {
    if (!cookiesReady) return
    const isInternal = userRole === 'broker' || userRole === 'admin'
    if (!isInternal && !companyId) { setLoading(false); return }

    const params = new URLSearchParams({
      table: 'aduanet_facturas',
      limit: '5000',
      order_by: 'created_at',
      order_dir: 'desc',
    })
    if (!isInternal && clientClave) params.set('clave_cliente', clientClave)

    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [cookiesReady, companyId, clientClave, userRole])

  const grouped = useMemo(() => {
    const map = new Map<string, { desc: string; count: number; totalValor: number }>()
    for (const r of rows) {
      const fraccion = (r as Record<string, unknown>).fraccion_arancelaria as string || (r as Record<string, unknown>).fraccion as string || ''
      if (!fraccion) continue
      const desc = (r.descripcion_mercancia ?? '').slice(0, 80)
      const valor = Number((r as Record<string, unknown>).valor_aduana ?? r.importe_total ?? 0)
      const existing = map.get(fraccion)
      if (existing) {
        existing.count++
        existing.totalValor += valor
      } else {
        map.set(fraccion, { desc, count: 1, totalValor: valor })
      }
    }

    const result: FraccionGroup[] = Array.from(map.entries())
      .map(([fraccion, data]) => ({
        fraccion,
        descripcion: data.desc,
        count: data.count,
        valorPromedio: data.count > 0 ? data.totalValor / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count)

    if (search.trim()) {
      const q = search.toLowerCase()
      return result.filter(g =>
        g.fraccion.toLowerCase().includes(q) || g.descripcion.toLowerCase().includes(q)
      )
    }
    return result.slice(0, 20)
  }, [rows, search])

  return (
    <div className="page-container" style={{ padding: 'var(--page-padding, 24px)' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontSize: 'var(--text-heading)', fontWeight: 'var(--weight-bold)' as unknown as number,
          color: 'var(--text-primary)', letterSpacing: 'var(--tracking-tight)',
        }}>
          Catálogo de Fracciones
        </h1>
        <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginTop: 4 }}>
          Top fracciones arancelarias por volumen de operaciones
        </p>
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)', padding: '0 12px', height: 40,
        marginBottom: 16, maxWidth: 360,
      }}>
        <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <input
          placeholder="Buscar fracción o descripción..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
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
              title="Sin fracciones registradas"
              description="Las fracciones arancelarias de sus operaciones aparecerán aquí"
            />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fracción</th>
                  <th>Descripción</th>
                  <th className="numeric" style={{ textAlign: 'right' }}>Operaciones</th>
                  <th className="numeric" style={{ textAlign: 'right' }}>Valor Promedio</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(g => (
                  <tr key={g.fraccion}>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-data)',
                        fontWeight: 600,
                        color: 'var(--accent-primary)',
                      }}>
                        {g.fraccion}
                      </span>
                    </td>
                    <td style={{
                      maxWidth: 300, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: 'var(--text-secondary)', fontSize: 'var(--text-data)',
                    }}>
                      {g.descripcion || '—'}
                    </td>
                    <td className="numeric" style={{
                      textAlign: 'right', fontFamily: 'var(--font-data)',
                      fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                    }}>
                      {g.count}
                    </td>
                    <td className="numeric" style={{
                      textAlign: 'right', fontFamily: 'var(--font-data)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {g.valorPromedio > 0 ? fmtUSD(g.valorPromedio) : '—'}
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
