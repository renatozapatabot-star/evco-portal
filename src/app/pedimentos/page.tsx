'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCompanyIdCookie, getClientClaveCookie, getCookieValue } from '@/lib/client-config'
import { fmtUSDFull as fmtUSD, fmtDate, fmtPedimentoShort } from '@/lib/format-utils'
import { useSort } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'

const titleCase = (s: string) => {
  if (!s) return ''
  return s.toLowerCase().replace(/(?:^|\s|[-/])\w/g, c => c.toUpperCase())
}

interface TraficoRow {
  trafico: string
  pedimento: string | null
  fecha_pago: string | null
  fecha_llegada: string | null
  importe_total: number | null
  estatus: string | null
  aduana: string | null
  regimen: string | null
  tipo_cambio: number | null
  proveedores: string | null
  descripcion_mercancia: string | null
  company_id: string | null
  [key: string]: unknown
}

interface PedGroup {
  pedimento: string
  trafico: string
  fecha: string | null
  importe: number
  estatus: string
  aduana: string
  regimen: string
  proveedores: string[]
  tmec: boolean
  descripcion: string
}

const PAGE_SIZE = 30

function exportCSV(groups: PedGroup[], clave: string) {
  const headers = ['Pedimento', 'Tráfico', 'Fecha Pago', 'Importe USD', 'Estatus', 'Mercancía', 'Aduana', 'Régimen', 'Proveedores']
  const csvRows = groups.map(g => [
    g.pedimento, g.trafico, g.fecha ?? '',
    g.importe, g.estatus, `"${g.descripcion.replace(/"/g, '""')}"`, g.aduana, g.regimen,
    g.proveedores.join('; '),
  ].join(','))
  const csv = [headers.join(','), ...csvRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `pedimentos-${clave}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

export default function PedimentosPage() {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const { sort, toggleSort } = useSort('pedimentos', { column: 'fecha', direction: 'desc' })
  const [tmecOnly, setTmecOnly] = useState(false)
  const [supplierLookup, setSupplierLookup] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    setLoading(true)
    const userRole = getCookieValue('user_role') ?? ''
    const isInternal = userRole === 'broker' || userRole === 'admin'
    const companyId = getCompanyIdCookie()

    const params = new URLSearchParams({
      table: 'traficos',
      limit: '5000',
      order_by: 'fecha_pago',
      order_dir: 'desc',
      not_null: 'pedimento',
      gte_field: 'fecha_llegada',
      gte_value: '2024-01-01',
    })
    if (!isInternal && companyId) params.set('company_id', companyId)

    // Fetch supplier name lookup for PRV_ code resolution
    fetch('/api/data?table=globalpc_proveedores&limit=5000')
      .then(r => r.json())
      .then(d => {
        const provs = (d.data ?? []) as { cve_proveedor?: string; nombre?: string }[]
        const lookup = new Map<string, string>()
        provs.forEach(p => {
          if (p.cve_proveedor && p.nombre) lookup.set(p.cve_proveedor, p.nombre)
        })
        setSupplierLookup(lookup)
      })
      .catch(() => { /* best-effort */ })

    fetch(`/api/data?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const all = (data.data ?? data ?? []) as TraficoRow[]
        setRows(all)
      })
      .catch((err: unknown) => { void 0 })
      .finally(() => setLoading(false))
  }, [])

  const groups: PedGroup[] = useMemo(() => {
    let filtered = rows

    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(r =>
        (r.pedimento ?? '').toLowerCase().includes(q) ||
        (r.trafico ?? '').toLowerCase().includes(q) ||
        (r.proveedores ?? '').toLowerCase().includes(q) ||
        (r.descripcion_mercancia ?? '').toLowerCase().includes(q))
    }
    if (dateFrom) filtered = filtered.filter(r => (r.fecha_pago || r.fecha_llegada || '') >= dateFrom)
    if (dateTo) filtered = filtered.filter(r => (r.fecha_pago || r.fecha_llegada || '') <= dateTo)

    // Group by pedimento
    const map = new Map<string, TraficoRow[]>()
    filtered.forEach(r => {
      const key = r.pedimento!
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })

    let result = Array.from(map.entries()).map(([pedimento, pedRows]) => {
      const first = pedRows[0]
      const rawProvs = [...new Set(pedRows.flatMap(r => (r.proveedores ?? '').split(',').map(s => s.trim()).filter(Boolean)))]
      const proveedores = rawProvs.map(code => supplierLookup.get(code) || code)
      const reg = (first.regimen ?? '').toUpperCase()
      const tmec = reg === 'ITE' || reg === 'ITR' || reg === 'IMD'
      return {
        pedimento,
        trafico: first.trafico,
        fecha: first.fecha_pago || first.fecha_llegada,
        importe: Number(first.importe_total) || 0,
        estatus: first.estatus ?? '',
        aduana: first.aduana ?? '',
        regimen: first.regimen ?? '',
        proveedores,
        tmec,
        descripcion: first.descripcion_mercancia ?? '',
      }
    })

    if (tmecOnly) result = result.filter(g => g.tmec)

    // Apply sort
    result.sort((a, b) => {
      const col = sort.column as keyof PedGroup
      const av = a[col] ?? ''
      const bv = b[col] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sort.direction === 'asc' ? cmp : -cmp
    })

    return result
  }, [rows, search, dateFrom, dateTo, tmecOnly, supplierLookup, sort])

  const totalPages = Math.ceil(groups.length / PAGE_SIZE)
  const pagedGroups = groups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const totals = useMemo(() => {
    const totalValor = groups.reduce((s, g) => s + g.importe, 0)
    const tmecCount = groups.filter(g => g.tmec).length
    return { totalValor, tmecCount, total: groups.length }
  }, [groups])

  const clave = getClientClaveCookie()

  const summaryCards = [
    { label: 'Pedimentos', value: totals.total.toLocaleString('es-MX') },
    { label: 'Valor Total USD', value: fmtUSD(totals.totalValor) },
    { label: 'T-MEC', value: `${totals.tmecCount} (${totals.total > 0 ? Math.round(totals.tmecCount / totals.total * 100) : 0}%)` },
    { label: 'Sin T-MEC', value: `${totals.total - totals.tmecCount}` },
  ]

  return (
    <div className="page-container" style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: isMobile ? 12 : 0 }}>
        <div>
          <h1 className="page-title">Pedimentos</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {groups.length.toLocaleString()} pedimentos &middot; <span className="font-mono">{fmtUSD(totals.totalValor)}</span> USD valor total
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => exportCSV(groups, clave)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-[12px] font-medium"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <Download size={12} strokeWidth={2} /> CSV
          </button>
          <div className="flex items-center gap-1.5">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
              className="rounded-[6px] px-2 py-1 text-[11px] outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', height: 30 }} />
            <span style={{ color: 'var(--text-disabled)', fontSize: 11 }}>—</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
              className="rounded-[6px] px-2 py-1 text-[11px] outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', height: 30 }} />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(0) }}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ color: 'var(--red-text)', border: '1px solid var(--red-border)', background: 'var(--red-bg)' }}>✕</button>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-[11.5px] cursor-pointer" style={{ color: tmecOnly ? 'var(--success)' : 'var(--text-secondary)' }}>
            <input type="checkbox" checked={tmecOnly} onChange={e => { setTmecOnly(e.target.checked); setPage(0) }} style={{ width: 13, height: 13 }} />
            Solo T-MEC
          </label>
          <div
            className="flex items-center gap-2 rounded-[3px] px-3 py-1.5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', width: 240 }}
          >
            <Search size={13} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Pedimento, tráfico, proveedor..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              className="flex-1 bg-transparent outline-none text-[12.5px]"
              style={{ color: 'var(--text-secondary)' }}
            />
          </div>
        </div>
      </div>

      {/* Summary stats removed — misleading for new clients */}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-16 rounded bg-gray-200 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && pagedGroups.length === 0 && (
        search.trim() ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-600)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearch(''); setPage(0) }}>Limpiar búsqueda</button>
          </div>
        ) : (
          <EmptyState
            icon="📋"
            title="Sin pedimentos registrados"
            description="Los pedimentos aparecerán aquí cuando se asignen a los tráficos."
          />
        )
      )}

      {/* Mobile card layout */}
      {!loading && pagedGroups.length > 0 && isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pagedGroups.map((g) => (
            <Link
              key={g.pedimento}
              href={`/traficos/${encodeURIComponent(g.trafico)}`}
              style={{
                textDecoration: 'none', color: 'inherit',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${g.tmec ? 'var(--success)' : 'var(--gold, #C4963C)'}`,
                borderRadius: 'var(--r-md, 8px)',
                padding: '12px 14px',
                display: 'block',
                minHeight: 60,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)', color: 'var(--text-primary)' }}>{fmtPedimentoShort(g.pedimento)}</span>
                {g.tmec && <span className="badge-tmec">T-MEC</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{g.fecha ? fmtDate(g.fecha) : ''}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)', color: 'var(--n-900)' }}>{fmtUSD(g.importe)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--n-500)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {g.proveedores.length > 0 ? titleCase(g.proveedores[0]) : g.descripcion || '—'}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Desktop table layout */}
      {!loading && pagedGroups.length > 0 && !isMobile && (
        <div className="rounded-[3px] overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" style={{ cursor: 'pointer' }} onClick={() => toggleSort('pedimento')}>Pedimento{sort.column === 'pedimento' ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                  <th scope="col">Tráfico</th>
                  <th scope="col" style={{ cursor: 'pointer' }} onClick={() => toggleSort('estatus')}>Estatus{sort.column === 'estatus' ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                  <th scope="col">Mercancía</th>
                  <th scope="col" style={{ cursor: 'pointer' }} onClick={() => toggleSort('fecha')}>Fecha{sort.column === 'fecha' ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                  <th scope="col">Aduana</th>
                  <th scope="col">Régimen</th>
                  <th scope="col" style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('importe')}>Valor USD{sort.column === 'importe' ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                  <th scope="col" style={{ width: 28 }}></th>
                </tr>
              </thead>
              <tbody>
                {pagedGroups.map((g, i) => {
                  const isCruzado = g.estatus.toLowerCase().includes('cruz')
                  const hasTrafico = !!g.trafico
                  return (
                    <tr key={g.pedimento} className={`${hasTrafico ? 'clickable-row' : ''} ${i % 2 === 0 ? 'row-even' : 'row-odd'}`}
                      onClick={() => hasTrafico && (window.location.href = `/traficos/${encodeURIComponent(g.trafico)}`)}
                      style={{ cursor: hasTrafico ? 'pointer' : 'default' }}>
                      <td><span className="c-id">{fmtPedimentoShort(g.pedimento)}</span></td>
                      <td><span className="c-id">{g.trafico}</span></td>
                      <td>
                        <span className={`badge ${isCruzado ? 'badge-cruzado' : 'badge-proceso'}`}>
                          <span className="badge-dot" />
                          {isCruzado ? 'Cruzado' : g.estatus || 'En Proceso'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--n-600)', maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {g.descripcion ? titleCase(g.descripcion) : '—'}
                        </span>
                      </td>
                      <td className="text-[12px]" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{g.fecha ? fmtDate(g.fecha) : ''}</td>
                      <td className="text-[12px]" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{g.aduana || '—'}</td>
                      <td>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                          {g.regimen || '—'}
                        </span>
                        {g.tmec && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>T-MEC</span>
                        )}
                      </td>
                      <td className="c-num">{fmtUSD(g.importe)} USD</td>
                      <td style={{ width: 28, textAlign: 'center' }}><ChevronRight size={14} style={{ color: 'var(--slate-300)' }} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
            {(page * PAGE_SIZE + 1)}-{Math.min((page + 1) * PAGE_SIZE, groups.length)} de {groups.length} pedimentos
          </span>
          <div className="flex items-center gap-1.5">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[11.5px] font-medium"
              style={{ background: page === 0 ? '#f7f8fa' : 'var(--card-bg)', border: '1px solid var(--border)', color: page === 0 ? '#d1d5db' : '#374151', cursor: page === 0 ? 'default' : 'pointer' }}>
              <ChevronLeft size={12} /> Anterior
            </button>
            <span className="mono text-[11px] px-2" style={{ color: 'var(--text-muted)' }}>{page + 1}/{totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[11.5px] font-medium"
              style={{ background: page >= totalPages - 1 ? '#f7f8fa' : 'var(--card-bg)', border: '1px solid var(--border)', color: page >= totalPages - 1 ? '#d1d5db' : '#374151', cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>
              Siguiente <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
