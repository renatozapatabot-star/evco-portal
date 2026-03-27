'use client'

import { useEffect, useState } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { CLIENT_NAME, CLIENT_CLAVE } from '@/lib/client-config'
import { fmtDesc } from '@/lib/format-utils'
import Link from 'next/link'

interface EntradaRow {
  cve_entrada: string
  trafico?: string | null
  fecha_llegada_mercancia?: string | null
  descripcion_mercancia?: string | null
  cantidad_bultos?: number | null
  peso_bruto?: number | null
  mercancia_danada?: boolean | null
  tiene_faltantes?: boolean | null
  [key: string]: unknown
}

const PAGE_SIZE = 50

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '-'
  try {
    return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return s }
}

const fmtTrafico = (id: string) => {
  const clean = id.replace(/[\u2013\u2014]/g, '-')
  return clean.startsWith(`${CLIENT_CLAVE}-`) ? clean : `${CLIENT_CLAVE}-${clean}`
}

export default function EntradasPage() {
  const [rows, setRows] = useState<EntradaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [faltantesOnly, setFaltantesOnly] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/data?table=entradas&cve_cliente=${CLIENT_CLAVE}&limit=5000&order_by=fecha_llegada_mercancia&order_dir=desc`)
      .then((r) => r.json())
      .then((data) => setRows(data.data ?? data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = (() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) =>
        (r.trafico ?? '').toLowerCase().includes(q) ||
        (r.descripcion_mercancia ?? '').toLowerCase().includes(q) ||
        (r.cve_entrada ?? '').toLowerCase().includes(q)
      )
    }
    if (dateFrom) out = out.filter(r => (r.fecha_llegada_mercancia || '') >= dateFrom)
    if (dateTo) out = out.filter(r => (r.fecha_llegada_mercancia || '') <= dateTo)
    if (faltantesOnly) out = out.filter(r => r.tiene_faltantes)
    return out
  })()

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>Entradas</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {rows.length.toLocaleString()} remesas &middot; {CLIENT_NAME} {CLIENT_CLAVE}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
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
          <label className="flex items-center gap-1.5 text-[11.5px] cursor-pointer" style={{ color: faltantesOnly ? '#b91c1c' : '#6b7280' }}>
            <input type="checkbox" checked={faltantesOnly} onChange={e => { setFaltantesOnly(e.target.checked); setPage(0) }} style={{ width: 13, height: 13 }} />
            Faltantes
          </label>
          <div
            className="flex items-center gap-2 rounded-[3px] px-3 py-1.5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', width: 220 }}
          >
            <Search size={13} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Trafico, entrada, descripcion..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              className="flex-1 bg-transparent outline-none text-[12.5px]"
              style={{ color: 'var(--text-secondary)' }}
            />
          </div>
        </div>
      </div>

      <div
        className="rounded-[3px] overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Entrada</th>
                <th>Trafico</th>
                <th>Fecha Llegada</th>
                <th>Descripcion</th>
                <th style={{ textAlign: 'right' }}>Bultos</th>
                <th style={{ textAlign: 'right' }}>Peso (kg)</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  <td><div className="h-3.5 w-16 rounded bg-gray-200 animate-pulse" /></td>
                  <td><div className="h-4 w-24 rounded bg-gray-200 animate-pulse" /></td>
                  <td><div className="h-3.5 w-20 rounded bg-gray-200 animate-pulse" /></td>
                  <td><div className="h-3.5 w-32 rounded bg-gray-200 animate-pulse" /></td>
                  <td><div className="h-3.5 w-10 rounded bg-gray-200 animate-pulse ml-auto" /></td>
                  <td><div className="h-3.5 w-16 rounded bg-gray-200 animate-pulse ml-auto" /></td>
                  <td><div className="h-5 w-16 rounded-full bg-gray-200 animate-pulse" /></td>
                </tr>
              ))}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    No se encontraron resultados
                  </td>
                </tr>
              )}
              {paged.map((r) => (
                <tr key={r.cve_entrada}>
                  <td>
                    <span className="mono text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>
                      {r.cve_entrada}
                    </span>
                  </td>
                  <td>
                    {r.trafico ? (
                      <Link href="/traficos" className="trafico-pill">
                        {fmtTrafico(r.trafico)}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-disabled)' }}>-</span>
                    )}
                  </td>
                  <td className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    {fmtDate(r.fecha_llegada_mercancia)}
                  </td>
                  <td
                    className="text-[12px] max-w-[200px] truncate"
                    style={{ color: r.descripcion_mercancia ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                  >
                    {fmtDesc(r.descripcion_mercancia)}
                  </td>
                  <td className="text-right mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    {r.cantidad_bultos ?? '-'}
                  </td>
                  <td className="text-right mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    {r.peso_bruto ? Number(r.peso_bruto).toLocaleString('es-MX') : '-'}
                  </td>
                  <td>
                    {r.mercancia_danada || r.tiene_faltantes ? (
                      <span className="badge badge-hold"><span className="badge-dot" />Incidencia</span>
                    ) : (
                      <span className="badge badge-cruzado"><span className="badge-dot" />OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
            {(page * PAGE_SIZE + 1).toLocaleString()}-{Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString()} de {filtered.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[11.5px] font-medium"
              style={{ background: page === 0 ? '#f7f8fa' : '#ffffff', border: '1px solid var(--border)', color: page === 0 ? '#d1d5db' : '#374151', cursor: page === 0 ? 'default' : 'pointer' }}
            >
              <ChevronLeft size={12} /> Anterior
            </button>
            <span className="mono text-[11px] px-2" style={{ color: 'var(--text-muted)' }}>{page + 1}/{totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[11.5px] font-medium"
              style={{ background: page >= totalPages - 1 ? '#f7f8fa' : '#ffffff', border: '1px solid var(--border)', color: page >= totalPages - 1 ? '#d1d5db' : '#374151', cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}
            >
              Siguiente <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
