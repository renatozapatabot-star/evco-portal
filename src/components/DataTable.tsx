'use client'

import { useState, useMemo, useCallback } from 'react'
import { ChevronUp, ChevronDown, Download, Search } from 'lucide-react'
import { getCompanyIdCookie } from '@/lib/client-config'

export interface Column<T = any> {
  key: string
  label: string
  width?: number | string
  align?: 'left' | 'right' | 'center'
  mono?: boolean
  sortable?: boolean
  render?: (row: T, index: number) => React.ReactNode
}

interface Props<T = any> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  pageSize?: number
  keyField?: string
  expandable?: (row: T) => React.ReactNode
  onRowClick?: (row: T) => void
  searchPlaceholder?: string
  exportFilename?: string
  emptyMessage?: string
  filters?: React.ReactNode
}

function fmtExportVal(v: any): string {
  if (v == null) return ''
  return String(v).replace(/,/g, ' ')
}

export default function DataTable<T extends Record<string, any>>({
  columns, data, loading, pageSize = 50, keyField = 'id',
  expandable, onRowClick, searchPlaceholder = 'Buscar...',
  exportFilename, emptyMessage = 'Sin resultados', filters,
}: Props<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // Auto-hide columns where ALL values are empty/null/dash/zero
  const visibleColumns = useMemo(() => {
    return columns.filter(col => {
      return data.some(row => {
        const v = row[col.key]
        if (v === null || v === undefined || v === '') return false
        const s = String(v).trim()
        if (s === '' || s === '-' || s === '--' || s === '\u2014' || s === '\u2013') return false
        if (s === '0%' || s === '0' || s === '0.0%') return false
        return true
      })
    })
  }, [columns, data])

  const filtered = useMemo(() => {
    let out = data
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(row => visibleColumns.some(c => String(row[c.key] ?? '').toLowerCase().includes(q)))
    }
    if (sortKey) {
      out = [...out].sort((a, b) => {
        const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? ''
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return out
  }, [data, search, sortKey, sortDir, visibleColumns])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(0)
  }, [sortKey])

  const handleExport = useCallback(() => {
    const headers = visibleColumns.map(c => c.label)
    const rows = filtered.map(row => visibleColumns.map(c => fmtExportVal(row[c.key])))
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = exportFilename || `${getCompanyIdCookie()}_export_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }, [filtered, columns, exportFilename])

  return (
    <div className="card">
      {/* Controls */}
      <div className="tbl-controls">
        <div className="tbl-filters">{filters}</div>
        <div className="tbl-actions">
          <div className="tbl-search">
            <Search size={14} />
            <input placeholder={searchPlaceholder} value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }} />
          </div>
          {exportFilename && (
            <button className="act-btn" onClick={handleExport}>
              <Download size={14} /> CSV
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {visibleColumns.map(col => (
                <th key={col.key}
                  style={{ width: col.width, textAlign: col.align || 'left', cursor: col.sortable !== false ? 'pointer' : 'default' }}
                  onClick={() => col.sortable !== false && handleSort(col.key)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                    )}
                  </span>
                </th>
              ))}
              {(expandable || onRowClick) && <th style={{ width: 24 }}></th>}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 8 }).map((_, i) => (
              <tr key={`skel-${i}`}>
                {visibleColumns.map(col => (
                  <td key={col.key}><div className="skel" style={{ width: '70%', height: 14 }} /></td>
                ))}
                {(expandable || onRowClick) && <td />}
              </tr>
            ))}
            {!loading && paged.length === 0 && (
              <tr><td colSpan={visibleColumns.length + (expandable || onRowClick ? 1 : 0)} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>{emptyMessage}</td></tr>
            )}
            {!loading && paged.map((row, i) => {
              const key = String(row[keyField] ?? i)
              const isExpanded = expandedKey === key
              return (
                <tbody key={key}>
                  <tr
                    className={isExpanded ? 'selected' : ''}
                    onClick={() => {
                      if (expandable) setExpandedKey(isExpanded ? null : key)
                      else if (onRowClick) onRowClick(row)
                    }}
                  >
                    {visibleColumns.map(col => (
                      <td key={col.key} style={{ textAlign: col.align || 'left' }}
                        className={col.mono ? 'c-num' : ''}>
                        {col.render ? col.render(row, i) : (
                          <span className={col.mono ? 'mono' : ''}>{row[col.key] != null ? String(row[col.key]) : '-'}</span>
                        )}
                      </td>
                    ))}
                    {(expandable || onRowClick) && <td><span className="c-arr">&#8250;</span></td>}
                  </tr>
                  {expandable && isExpanded && (
                    <tr>
                      <td colSpan={visibleColumns.length + 1} style={{ padding: 0 }}>
                        <div style={{ padding: 24, background: 'var(--bg-elevated)', borderLeft: '3px solid var(--amber-600)' }}>
                          {expandable(row)}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pag">
          <span className="pag-info">{(page * pageSize + 1).toLocaleString()}-{Math.min((page + 1) * pageSize, filtered.length).toLocaleString()} de {filtered.length.toLocaleString()}</span>
          <div className="pag-btns">
            <button className="pag-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>&lt;</button>
            <button className="pag-btn cur">{page + 1}</button>
            <button className="pag-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>&gt;</button>
          </div>
        </div>
      )}
    </div>
  )
}
