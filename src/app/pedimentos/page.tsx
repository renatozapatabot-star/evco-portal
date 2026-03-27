'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, Download, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react'
import { CLIENT_CLAVE } from '@/lib/client-config'
import { fmtUSDFull as fmtUSD, fmtMXN, fmtDate } from '@/lib/format-utils'

interface FacturaRow {
  referencia: string
  pedimento: string | null
  fecha_pago: string | null
  proveedor: string | null
  tc: number | null
  valor_usd: number | null
  dta: number | null
  igi: number | null
  iva: number | null
  [key: string]: unknown
}

interface PedGroup {
  pedimento: string
  rows: FacturaRow[]
  totalValor: number
  totalDta: number
  totalIgi: number
  totalIva: number
  fecha: string | null
  referencia: string
  tc: number | null
  proveedores: string[]
  tmec: boolean
}

const PAGE_SIZE = 30

// Use shared formatters — imported at top

function exportCSV(rows: FacturaRow[]) {
  const headers = ['Referencia', 'Pedimento', 'Fecha Pago', 'Proveedor', 'TC', 'Valor USD', 'DTA', 'IGI', 'IVA']
  const csvRows = rows.map(r => [
    r.referencia, r.pedimento ?? '', r.fecha_pago ?? '', (r.proveedor ?? '').replace(/,/g, ' '),
    r.tc ?? '', r.valor_usd ?? '', r.dta ?? '', r.igi ?? '', r.iva ?? '',
  ].join(','))
  const csv = [headers.join(','), ...csvRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `pedimentos-${CLIENT_CLAVE}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

export default function PedimentosPage() {
  const [rows, setRows] = useState<FacturaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tmecOnly, setTmecOnly] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/data?table=aduanet_facturas&clave_cliente=${CLIENT_CLAVE}&limit=5000&order_by=fecha_pago&order_dir=desc`)
      .then((r) => r.json())
      .then((data) => setRows(data.data ?? data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const groups: PedGroup[] = useMemo(() => {
    const map = new Map<string, FacturaRow[]>()
    let filteredRows = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      filteredRows = filteredRows.filter(r =>
        (r.referencia ?? '').toLowerCase().includes(q) ||
        (r.pedimento ?? '').toLowerCase().includes(q) ||
        (r.proveedor ?? '').toLowerCase().includes(q))
    }
    if (dateFrom) filteredRows = filteredRows.filter(r => (r.fecha_pago || '') >= dateFrom)
    if (dateTo) filteredRows = filteredRows.filter(r => (r.fecha_pago || '') <= dateTo)
    if (tmecOnly) filteredRows = filteredRows.filter(r => (r.igi || 0) === 0)

    filteredRows.forEach(r => {
      const key = r.pedimento || r.referencia || 'Sin pedimento'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })

    return Array.from(map.entries()).map(([pedimento, rows]) => {
      // Financial values are pedimento-level totals duplicated on every row.
      // Use the first row's values — they're the same across all rows.
      const first = rows[0]
      return {
        pedimento,
        rows,
        totalValor: Number(first.valor_usd) || 0,
        totalDta: Number(first.dta) || 0,
        totalIgi: Number(first.igi) || 0,
        totalIva: Number(first.iva) || 0,
        fecha: first.fecha_pago,
        referencia: first.referencia,
        tc: first.tc,
        proveedores: [...new Set(rows.map(r => r.proveedor).filter(Boolean))] as string[],
        tmec: (Number(first.igi) || 0) === 0,
      }
    })
  }, [rows, search, dateFrom, dateTo, tmecOnly])

  const totalPages = Math.ceil(groups.length / PAGE_SIZE)
  const pagedGroups = groups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const totals = useMemo(() => groups.reduce(
    (acc, g) => ({
      valor: acc.valor + g.totalValor,
      dta: acc.dta + g.totalDta,
      igi: acc.igi + g.totalIgi,
      iva: acc.iva + g.totalIva,
    }),
    { valor: 0, dta: 0, igi: 0, iva: 0 }
  ), [groups])

  const toggle = (ped: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(ped) ? next.delete(ped) : next.add(ped)
      return next
    })
  }

  const summaryCards = [
    { label: 'Valor Total USD', value: fmtUSD(totals.valor), accent: false },
    { label: 'DTA Total', value: fmtMXN(totals.dta), accent: false },
    { label: 'IGI Total', value: fmtMXN(totals.igi), accent: true },
    { label: 'IVA Total', value: fmtMXN(totals.iva), accent: false },
  ]

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>Pedimentos</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {groups.length.toLocaleString()} pedimentos &middot; {rows.length.toLocaleString()} lineas &middot; Clave {CLIENT_CLAVE}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => exportCSV(rows)}
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
          <label className="flex items-center gap-1.5 text-[11.5px] cursor-pointer" style={{ color: tmecOnly ? '#166534' : '#6b7280' }}>
            <input type="checkbox" checked={tmecOnly} onChange={e => { setTmecOnly(e.target.checked); setPage(0) }} style={{ width: 13, height: 13 }} />
            T-MEC only
          </label>
          <div
            className="flex items-center gap-2 rounded-[3px] px-3 py-1.5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', width: 240 }}
          >
            <Search size={13} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Pedimento, proveedor, factura..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              className="flex-1 bg-transparent outline-none text-[12.5px]"
              style={{ color: 'var(--text-secondary)' }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-[3px] p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
            <div className="mono text-[20px] font-semibold" style={{ color: c.accent ? '#C9A84C' : '#111827' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-[3px] overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="text-center py-12 text-[13px]" style={{ color: 'var(--text-muted)' }}>Cargando pedimentos...</div>
        ) : pagedGroups.length === 0 ? (
          <div className="text-center py-12 text-[13px]" style={{ color: 'var(--text-muted)' }}>No se encontraron registros</div>
        ) : (
          <div>
            {pagedGroups.map((g) => (
              <div key={g.pedimento} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                {/* Group header */}
                <div
                  onClick={() => toggle(g.pedimento)}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ cursor: 'pointer', background: expanded.has(g.pedimento) ? '#f5f7ff' : 'transparent' }}
                  onMouseEnter={e => { if (!expanded.has(g.pedimento)) e.currentTarget.style.background = '#fafbfc' }}
                  onMouseLeave={e => { if (!expanded.has(g.pedimento)) e.currentTarget.style.background = 'transparent' }}
                >
                  <div className="flex items-center gap-3">
                    {expanded.has(g.pedimento) ? <ChevronDown size={14} style={{ color: '#C9A84C' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                    <span className="ped-pill">{g.pedimento}</span>
                    {g.referencia && <span className="mono text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>{g.referencia}</span>}
                    <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                      {g.proveedores.length} proveedor{g.proveedores.length !== 1 ? 'es' : ''}
                    </span>
                    {g.fecha && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{fmtDate(g.fecha)}</span>}
                    {g.tmec && (
                      <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px]" style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}>T-MEC</span>
                    )}
                  </div>
                  <span className="mono text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtUSD(g.totalValor)}</span>
                </div>

                {/* Expanded detail */}
                {expanded.has(g.pedimento) && (
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.04)', padding: '16px 20px 20px', background: 'var(--bg-elevated, #F5F3EF)' }}>
                    {/* Pedimento totals — shown once */}
                    <div className="flex items-center gap-6 flex-wrap mb-4" style={{ padding: '12px 16px', background: 'var(--bg-card, #fff)', borderRadius: 8, border: '1px solid var(--border-light, #F0EDE8)' }}>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>Valor Total USD</div>
                        <div className="mono text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtUSD(g.totalValor)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>DTA</div>
                        <div className="mono text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>{fmtMXN(g.totalDta)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>IGI</div>
                        <div className="mono text-[14px] font-medium" style={{ color: g.tmec ? 'var(--status-green, #16A34A)' : 'var(--text-secondary)' }}>{g.tmec ? '$0 (T-MEC)' : fmtMXN(g.totalIgi)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>IVA</div>
                        <div className="mono text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>{fmtMXN(g.totalIva)}</div>
                      </div>
                      {g.tc && (
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>Tipo Cambio</div>
                          <div className="mono text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>${Number(g.tc).toFixed(4)}</div>
                        </div>
                      )}
                    </div>

                    {/* Proveedores list */}
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--text-muted)' }}>
                        Proveedores ({g.proveedores.length})
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {g.proveedores.map(p => (
                          <div key={p} className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>·</span> {p}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
            {(page * PAGE_SIZE + 1)}-{Math.min((page + 1) * PAGE_SIZE, groups.length)} de {groups.length} pedimentos
          </span>
          <div className="flex items-center gap-1.5">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[11.5px] font-medium"
              style={{ background: page === 0 ? '#f7f8fa' : '#ffffff', border: '1px solid var(--border)', color: page === 0 ? '#d1d5db' : '#374151', cursor: page === 0 ? 'default' : 'pointer' }}>
              <ChevronLeft size={12} /> Anterior
            </button>
            <span className="mono text-[11px] px-2" style={{ color: 'var(--text-muted)' }}>{page + 1}/{totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[11.5px] font-medium"
              style={{ background: page >= totalPages - 1 ? '#f7f8fa' : '#ffffff', border: '1px solid var(--border)', color: page >= totalPages - 1 ? '#d1d5db' : '#374151', cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>
              Siguiente <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
