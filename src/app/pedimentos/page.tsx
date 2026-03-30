'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, Download, ChevronDown, ChevronRight, ChevronLeft, FileText } from 'lucide-react'
import { CLIENT_CLAVE } from '@/lib/client-config'
import { fmtUSDFull as fmtUSD, fmtMXN, fmtDate } from '@/lib/format-utils'
import { getTariffRate } from '@/lib/cruz-score'
import { GOLD } from '@/lib/design-system'

const titleCase = (s: string) => {
  if (!s) return ''
  return s.toLowerCase().replace(/(?:^|\s|[-/])\w/g, c => c.toUpperCase())
}

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
    { label: 'IGI Total', value: fmtMXN(totals.igi), accent: false },
    { label: 'IVA Total', value: fmtMXN(totals.iva), accent: false },
  ]

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="page-title">Pedimentos</h1>
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

      {/* T-MEC Savings Banner */}
      {groups.length > 0 && (() => {
        const tmecCount = groups.filter(g => g.tmec).length
        const nonTmecCount = groups.filter(g => !g.tmec).length
        const nonTmecGroups = groups.filter(g => !g.tmec).sort((a, b) => b.totalValor - a.totalValor)
        const nonTmecValue = nonTmecGroups.reduce((s, g) => s + g.totalValor, 0)
        const estimatedSavings = nonTmecGroups.reduce((s, g) => s + g.totalValor * getTariffRate(g.proveedores?.[0] || ''), 0)
        return (
          <div style={{
            background: 'var(--gold-50)', border: '1px solid var(--gold-200)',
            borderRadius: 'var(--r-lg)', padding: '16px 20px',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--n-900)' }}>
                  T-MEC: {tmecCount} de {groups.length} pedimentos ({groups.length > 0 ? Math.round(tmecCount / groups.length * 100) : 0}%)
                </div>
                <div style={{ fontSize: 12, color: 'var(--n-500)', marginTop: 2 }}>
                  {nonTmecCount} pedimentos sin T-MEC · Valor: <span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtUSD(nonTmecValue)}</span>
                </div>
              </div>
              {estimatedSavings > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold-600)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ahorro potencial*</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--gold-700)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtUSD(estimatedSavings)}</div>
                </div>
              )}
            </div>
            {nonTmecGroups.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {nonTmecGroups.slice(0, 3).map(g => (
                  <div key={g.pedimento} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                    <span style={{ fontWeight: 700 }}>{g.pedimento} — {titleCase(g.proveedores?.[0] || '')}</span>
                    <span style={{ fontWeight: 800, color: 'var(--gold-700)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtUSD(g.totalValor * getTariffRate(g.proveedores?.[0] || ''))}</span>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: 'var(--n-400)', marginTop: 6 }}>* Estimado por fracción arancelaria. Verificar para cálculo exacto.</div>
              </div>
            )}
          </div>
        )
      })()}

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {summaryCards.map((c) => (
          <div key={c.label} className="kpi-card">
            <div className="kpi-label">{c.label}</div>
            <div className="kpi-value" style={{ fontSize: 28, color: 'var(--n-900)' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-[3px] overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="text-center py-12 text-[13px]" style={{ color: 'var(--text-muted)' }}>Cargando pedimentos...</div>
        ) : pagedGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <FileText size={32} strokeWidth={1.5} style={{ color: 'var(--n-300)', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--n-700)', marginBottom: 4 }}>Sin pedimentos registrados</div>
            <div style={{ fontSize: 13, color: 'var(--n-400)' }}>Los pedimentos aparecerán aquí</div>
          </div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}></th>
                  <th>Pedimento</th>
                  <th>Tráfico</th>
                  <th>Proveedores</th>
                  <th>Fecha</th>
                  <th>T-MEC</th>
                  <th style={{ textAlign: 'right' }}>Valor USD</th>
                </tr>
              </thead>
              <tbody>
                {pagedGroups.map((g) => (
                  <tr key={g.pedimento} onClick={() => toggle(g.pedimento)} style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '0 4px 0 12px' }}>
                      {expanded.has(g.pedimento) ? <ChevronDown size={14} style={{ color: GOLD }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                    </td>
                    <td><span className="c-id">{g.pedimento}</span></td>
                    <td><span className="c-id">{g.referencia}</span></td>
                    <td>
                      {g.proveedores.length > 0 ? (
                        <>
                          <span style={{ fontSize: 13, color: 'var(--n-700)' }}>
                            {titleCase(g.proveedores[0])}
                          </span>
                          {g.proveedores.length > 1 && (
                            <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--n-100)', color: 'var(--n-500)' }}>
                              +{g.proveedores.length - 1}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="c-empty">&middot;</span>
                      )}
                    </td>
                    <td className="text-[12px]" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{g.fecha ? fmtDate(g.fecha) : ''}</td>
                    <td>
                      {g.tmec && (
                        <span className="badge-tmec">T-MEC</span>
                      )}
                    </td>
                    <td className="c-num">{fmtUSD(g.totalValor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
