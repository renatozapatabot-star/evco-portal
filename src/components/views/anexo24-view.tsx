'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, Download, ChevronLeft, ChevronRight, FileText, Loader2 } from 'lucide-react'
import { getCompanyIdCookie, getClientClaveCookie, getCookieValue } from '@/lib/client-config'
import { fmtDate, fmtUSD, fmtPedimentoShort } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { DateInputES } from '@/components/ui/DateInputES'
import { CockpitPage } from '@/components/cockpit/CockpitPage'
import { useIsMobile } from '@/hooks/use-mobile'

// Real globalpc_partidas shape (no cve_trafico, no descripcion, no fraccion).
// To get trafico context we hop via globalpc_facturas.folio. To get description
// + fracción we hop via globalpc_productos.cve_producto.
interface PartidaRow {
  folio: number | null
  cve_producto: string | null
  cve_cliente: string | null
  cantidad: number | null
  precio_unitario: number | null
  peso: number | null
  pais_origen: string | null
}

interface FacturaRow {
  folio: number | null
  cve_trafico: string | null
}

interface ProductoRow {
  cve_producto: string | null
  cve_cliente: string | null
  descripcion: string | null
  fraccion: string | null
}

interface TraficoContext {
  pedimento: string | null
  fecha_pago: string | null
  fecha_llegada: string | null
  proveedores: string | null
  regimen: string | null
  pais_procedencia: string | null
  importe_total: number | null
}

interface EnrichedRow {
  rowNum: number
  pedimento: string
  fecha: string | null
  fraccion: string
  descripcion: string
  cantidad: number
  valorUSD: number
  proveedor: string
  origen: string
  regimen: string
  tmec: boolean
}

const PAGE_SIZE = 50

function isT(regimen: string | null): boolean {
  const r = (regimen ?? '').toUpperCase()
  return r === 'ITE' || r === 'ITR' || r === 'IMD'
}

function exportCSV(rows: EnrichedRow[], clave: string) {
  const h = ['#', 'Pedimento', 'Fecha', 'Fracción', 'Descripción', 'Cantidad', 'Valor_USD', 'Proveedor', 'Origen', 'T-MEC']
  const c = rows.map(r => [
    r.rowNum, r.pedimento, r.fecha ?? '',
    r.fraccion, (r.descripcion).replace(/,/g, ' '),
    r.cantidad, r.valorUSD,
    (r.proveedor).replace(/,/g, ';'), r.origen,
    r.tmec ? 'SI' : 'NO',
  ].join(','))
  const blob = new Blob([['CRUZ — Reporte Anexo 24', `Clave: ${clave}`, `Exportado: ${fmtDate(new Date())}`, '', h.join(','), ...c].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `Anexo24_${clave}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

// Glass card styles
const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20,
  boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(192,197,206,0.12)',
}

function fmtUSDCompact(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return fmtUSD(v)
}

export function Anexo24View() {
  const isMobile = useIsMobile()
  const [partidas, setPartidas] = useState<PartidaRow[]>([])
  const [traficoMap, setTraficoMap] = useState<Map<string, TraficoContext>>(new Map())
  const [supplierLookup, setSupplierLookup] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tmecFilter, setTmecFilter] = useState<'all' | 'si' | 'no'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const [generating, setGenerating] = useState(false)

  const [folioToTrafico, setFolioToTrafico] = useState<Map<number, string>>(new Map())
  const [productMap, setProductMap] = useState<Map<string, { descripcion: string | null; fraccion: string | null }>>(new Map())

  const [companyId, setCompanyId] = useState('')
  const [clientClave, setClientClave] = useState('')
  const [userRole, setUserRole] = useState('')
  const [cookiesReady, setCookiesReady] = useState(false)

  useEffect(() => {
    setCompanyId(getCookieValue('company_id') ?? '')
    setClientClave(getCookieValue('company_clave') ?? getClientClaveCookie())
    setUserRole(getCookieValue('user_role') ?? '')
    setCookiesReady(true)
  }, [])

  useEffect(() => {
    if (!cookiesReady) return
    const isInternal = userRole === 'broker' || userRole === 'admin'
    if (!isInternal && !companyId) { setLoading(false); return }

    // Important: traficos uses company_id; the globalpc_* tables use cve_cliente
    // because the GlobalPC sync mislabels company_id (full-sync-facturas:55
    // falls back to 'evco' when the clave isn't in companies, contaminating
    // the row with other clients' data). cve_cliente is the source of truth.
    const traficoFilter = !isInternal && companyId ? `&company_id=${companyId}` : ''
    const claveFilter = !isInternal && clientClave ? `&cve_cliente=${clientClave}` : ''

    const safeFetch = (u: string) => fetch(u).then(r => {
      if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : 'fetch_error')
      return r.json()
    })
    Promise.all([
      safeFetch(`/api/data?table=globalpc_partidas&limit=10000${claveFilter}`),
      safeFetch(`/api/data?table=traficos&limit=5000&gte_field=fecha_llegada&gte_value=2024-01-01${traficoFilter}`),
      safeFetch(`/api/data?table=globalpc_proveedores&limit=5000${claveFilter}`),
      safeFetch(`/api/data?table=globalpc_facturas&limit=10000${claveFilter}`),
      safeFetch(`/api/data?table=globalpc_productos&limit=10000${claveFilter}`),
    ])
      .then(([partidaData, traficoData, provData, facturaData, productoData]) => {
        setPartidas(Array.isArray(partidaData.data) ? partidaData.data : [])

        const tMap = new Map<string, TraficoContext>()
        const traficos = Array.isArray(traficoData.data) ? traficoData.data : []
        traficos.forEach((t: Record<string, unknown>) => {
          if (t.trafico) {
            tMap.set(t.trafico as string, {
              pedimento: (t.pedimento as string) || null,
              fecha_pago: (t.fecha_pago as string) || null,
              fecha_llegada: (t.fecha_llegada as string) || null,
              proveedores: (t.proveedores as string) || null,
              regimen: (t.regimen as string) || null,
              pais_procedencia: (t.pais_procedencia as string) || null,
              importe_total: t.importe_total != null ? Number(t.importe_total) : null,
            })
          }
        })
        setTraficoMap(tMap)

        const sMap = new Map<string, string>()
        const provs = Array.isArray(provData.data) ? provData.data : []
        provs.forEach((p: { cve_proveedor?: string; nombre?: string }) => {
          if (p.cve_proveedor && p.nombre) sMap.set(p.cve_proveedor, p.nombre)
        })
        setSupplierLookup(sMap)

        // folio → trafico (the join the previous code missed)
        const fMap = new Map<number, string>()
        const facs = Array.isArray(facturaData.data) ? facturaData.data : []
        facs.forEach((f: FacturaRow) => {
          if (f.folio != null && f.cve_trafico) fMap.set(f.folio, f.cve_trafico)
        })
        setFolioToTrafico(fMap)

        // (cve_cliente|cve_producto) → { descripcion, fraccion }
        const pMap = new Map<string, { descripcion: string | null; fraccion: string | null }>()
        const prods = Array.isArray(productoData.data) ? productoData.data : []
        prods.forEach((p: ProductoRow) => {
          pMap.set(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`, {
            descripcion: p.descripcion,
            fraccion: p.fraccion,
          })
        })
        setProductMap(pMap)
      })
      .catch(err => {
        if (err.message === 'session_expired') { window.location.href = '/login'; return }
      })
      .finally(() => setLoading(false))
  }, [cookiesReady, companyId, userRole])

  const resolveProvs = (raw: string | null) => {
    if (!raw) return '—'
    return raw.split(',').map(s => s.trim()).filter(Boolean)
      .map(code => supplierLookup.get(code) || code).join(', ')
  }

  const enriched: EnrichedRow[] = useMemo(() => {
    const rows: EnrichedRow[] = []
    let num = 0
    // Sort by resolved trafico (via folio→trafico) so contiguous shipments group.
    const sorted = [...partidas].sort((a, b) => {
      const ta = a.folio != null ? folioToTrafico.get(a.folio) ?? '' : ''
      const tb = b.folio != null ? folioToTrafico.get(b.folio) ?? '' : ''
      return ta.localeCompare(tb)
    })

    for (const p of sorted) {
      const trafico = p.folio != null ? folioToTrafico.get(p.folio) ?? '' : ''
      const ctx = trafico ? traficoMap.get(trafico) : undefined
      const prod = productMap.get(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`)
      const cantidad = Number(p.cantidad) || 0
      const precio = Number(p.precio_unitario) || 0
      num++
      rows.push({
        rowNum: num,
        pedimento: ctx?.pedimento || 'Pendiente',
        fecha: ctx?.fecha_pago || ctx?.fecha_llegada || null,
        fraccion: prod?.fraccion || '—',
        descripcion: prod?.descripcion || p.cve_producto || '—',
        cantidad,
        valorUSD: cantidad * precio,
        proveedor: resolveProvs(ctx?.proveedores || null),
        origen: p.pais_origen || ctx?.pais_procedencia || '—',
        regimen: ctx?.regimen || '',
        tmec: isT(ctx?.regimen || null),
      })
    }
    return rows
  }, [partidas, traficoMap, supplierLookup, folioToTrafico, productMap])

  const filtered = useMemo(() => {
    let out = enriched
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        r.pedimento.toLowerCase().includes(q) ||
        r.fraccion.toLowerCase().includes(q) ||
        r.descripcion.toLowerCase().includes(q) ||
        r.proveedor.toLowerCase().includes(q)
      )
    }
    if (tmecFilter === 'si') out = out.filter(r => r.tmec)
    if (tmecFilter === 'no') out = out.filter(r => !r.tmec)
    if (dateFrom) out = out.filter(r => (r.fecha || '') >= dateFrom)
    if (dateTo) out = out.filter(r => (r.fecha || '') <= dateTo)
    return out
  }, [enriched, search, tmecFilter, dateFrom, dateTo])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // KPI computations
  const kpis = useMemo(() => {
    const totalValue = enriched.reduce((s, r) => s + r.valorUSD, 0)
    const uniqueFracciones = new Set(enriched.map(r => r.fraccion).filter(f => f !== '—')).size
    const uniqueProveedores = new Set(enriched.map(r => r.proveedor).filter(p => p !== '—')).size
    const tmecCount = enriched.filter(r => r.tmec).length
    const tmecPct = enriched.length > 0 ? Math.round((tmecCount / enriched.length) * 100) : 0
    // Orphans = partidas whose folio doesn't resolve to a embarque (sync gap).
    const pendientes = enriched.filter(r => r.pedimento === 'Pendiente').length
    return { totalPartidas: enriched.length, totalValue, uniqueFracciones, uniqueProveedores, tmecCount, tmecPct, pendientes }
  }, [enriched])

  const handleGeneratePDF = () => {
    setGenerating(true)
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    const url = `/api/anexo24-pdf${params.toString() ? '?' + params.toString() : ''}`
    window.open(url, '_blank')
    setTimeout(() => setGenerating(false), 3000)
  }

  const subtitle = loading
    ? 'Cargando...'
    : `${filtered.length.toLocaleString('es-MX')} partidas${kpis.tmecCount > 0 ? ` · ${kpis.tmecCount} T-MEC` : ''}`

  return (
    <CockpitPage
      title="Anexo 24"
      subtitle={subtitle}
      headerActions={
        <>
          <button
            onClick={() => exportCSV(filtered, clientClave)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px',
              borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
              cursor: 'pointer', fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)',
              minWidth: 60, justifyContent: 'center',
            }}
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={generating || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, minHeight: 60, padding: '0 20px',
              borderRadius: 12, border: 'none', background: '#E8EAED', cursor: generating ? 'wait' : 'pointer',
              fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: '#000', opacity: generating ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            Generar Reporte PDF
          </button>
        </>
      }
    >
      {/* KPI Cards */}
      {!loading && enriched.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}>
          {[
            { label: 'Total Partidas', value: kpis.totalPartidas.toLocaleString('es-MX'), color: 'var(--text-primary, #E6EDF3)' },
            { label: 'Valor Total USD', value: fmtUSDCompact(kpis.totalValue), color: '#E8EAED' },
            { label: 'Fracciones', value: String(kpis.uniqueFracciones), color: 'var(--text-primary, #E6EDF3)' },
            { label: 'T-MEC', value: `${kpis.tmecPct}%`, color: kpis.tmecPct >= 50 ? '#22C55E' : '#FBBF24' },
            { label: 'Proveedores', value: String(kpis.uniqueProveedores), color: 'var(--text-primary, #E6EDF3)' },
            { label: 'Pendientes', value: kpis.pendientes.toLocaleString('es-MX'), color: kpis.pendientes > 0 ? '#FBBF24' : '#22C55E' },
          ].map(kpi => (
            <div key={kpi.label} style={{ ...glassCard, padding: 16, textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-title)', fontWeight: 800,
                color: kpi.color, lineHeight: 1.2, marginBottom: 4,
              }}>
                {kpi.value}
              </div>
              <div style={{
                fontSize: 'var(--aguila-fs-label)', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-muted, #64748b)',
              }}>
                {kpi.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Orphan partidas warning — partidas whose folio doesn't map to a
          embarque (sync gap between globalpc_partidas and globalpc_facturas). */}
      {!loading && kpis.pendientes > 0 && (
        <div style={{
          ...glassCard,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderLeft: '3px solid #FBBF24',
        }}>
          <span style={{ fontSize: 'var(--aguila-fs-body-lg)' }}>⚠️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: '#E6EDF3' }}>
              {kpis.pendientes.toLocaleString('es-MX')} partidas sin pedimento asignado
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-meta)', color: '#94a3b8', marginTop: 2 }}>
              Esperando próxima sincronización GlobalPC. Los renglones marcados &ldquo;Pendiente&rdquo; abajo se reconciliarán automáticamente.
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          ...glassCard, borderRadius: 12, padding: '0 12px', height: 40,
          flex: isMobile ? '1 1 100%' : '0 1 320px',
        }}>
          <Search size={14} style={{ color: 'var(--text-muted, #64748b)', flexShrink: 0 }} />
          <input
            placeholder="Pedimento, fracción, proveedor..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 'var(--aguila-fs-body)', color: 'var(--text-primary, #E6EDF3)',
            }}
          />
        </div>
        {(['all', 'si', 'no'] as const).map(v => (
          <button key={v} onClick={() => { setTmecFilter(v); setPage(0) }}
            style={{
              fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              minHeight: 40,
              border: `1px solid ${tmecFilter === v ? 'rgba(192,197,206,0.3)' : 'rgba(255,255,255,0.08)'}`,
              background: tmecFilter === v ? 'rgba(192,197,206,0.08)' : 'transparent',
              color: tmecFilter === v ? '#C0C5CE' : 'var(--text-muted, #64748b)',
              transition: 'all 0.15s',
            }}>
            {v === 'all' ? 'Todos' : v === 'si' ? 'T-MEC' : 'Sin T-MEC'}
          </button>
        ))}
        <DateInputES value={dateFrom} onChange={v => { setDateFrom(v); setPage(0) }} />
        <span style={{ color: 'var(--text-muted, #64748b)', fontSize: 'var(--aguila-fs-meta)' }}>—</span>
        <DateInputES value={dateTo} onChange={v => { setDateTo(v); setPage(0) }} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(0) }}
            style={{
              fontSize: 'var(--aguila-fs-body)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '0 12px',
              minWidth: 40, minHeight: 40, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
            &times;
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ ...glassCard, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton-shimmer" style={{ height: 40 }} />)}
          </div>
        ) : paged.length === 0 ? (
          <div style={{ padding: 32 }}>
            <EmptyState icon="📄" title="Sin partidas" description="Las partidas del Anexo 24 aparecerán aquí cuando se registren operaciones" />
          </div>
        ) : isMobile ? (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paged.map((r) => (
              <div key={`${r.pedimento}-${r.rowNum}`} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 'var(--aguila-fs-body)', color: 'var(--text-primary, #E6EDF3)' }}>
                    {fmtPedimentoShort(r.pedimento)}
                  </span>
                  {r.tmec ? (
                    <span style={{ fontSize: 'var(--aguila-fs-label)', fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.12)', padding: '2px 8px', borderRadius: 9999 }}>T-MEC</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-secondary, #94a3b8)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.descripcion}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-compact)', color: '#E8EAED', fontWeight: 600 }}>
                    {r.fraccion}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-compact)', fontWeight: 500, color: 'var(--text-primary, #E6EDF3)' }}>
                    {r.valorUSD > 0 ? fmtUSD(r.valorUSD) : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted, #64748b)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(r.fecha)}</span>
                  <span>{r.origen}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="aguila-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 45 }}>#</th>
                  <th>Pedimento</th>
                  <th>Fecha</th>
                  <th>Fracción</th>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'right' }}>Cantidad</th>
                  <th style={{ textAlign: 'right' }}>Valor USD</th>
                  <th>Proveedor</th>
                  <th>Origen</th>
                  <th>T-MEC</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={`${r.pedimento}-${r.rowNum}`} className={`${i % 2 === 0 ? 'row-even' : 'row-odd'}`}>
                    <td style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted, #64748b)', fontFamily: 'var(--font-mono)' }}>
                      {r.rowNum}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 'var(--aguila-fs-body)', whiteSpace: 'nowrap', color: 'var(--text-primary, #E6EDF3)' }}>
                      {fmtPedimentoShort(r.pedimento)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-secondary, #94a3b8)' }}>
                      {fmtDate(r.fecha)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-compact)', color: '#E8EAED', fontWeight: 600 }}>
                      {r.fraccion}
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-secondary, #94a3b8)' }}>
                      {r.descripcion}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-primary, #E6EDF3)' }}>
                      {r.cantidad > 0 ? r.cantidad.toLocaleString('es-MX') : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-compact)', fontWeight: 500, color: 'var(--text-primary, #E6EDF3)' }}>
                      {r.valorUSD > 0 ? fmtUSD(r.valorUSD) : '—'}
                    </td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-secondary, #94a3b8)' }}>
                      {r.proveedor}
                    </td>
                    <td style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-secondary, #94a3b8)' }}>{r.origen}</td>
                    <td>
                      {r.tmec ? (
                        <span style={{ fontSize: 'var(--aguila-fs-label)', fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.12)', padding: '2px 8px', borderRadius: 9999 }}>T-MEC</span>
                      ) : (
                        <span style={{ fontSize: 'var(--aguila-fs-label)', color: 'var(--text-muted, #64748b)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 16, padding: '12px 16px', ...glassCard, borderRadius: 12,
        }}>
          <span style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-muted, #64748b)', fontFamily: 'var(--font-mono)' }}>
            Página {page + 1} de {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              style={{
                width: 40, height: 40, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', cursor: page === 0 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: page === 0 ? 'var(--text-muted, #64748b)' : 'var(--text-primary, #E6EDF3)',
                opacity: page === 0 ? 0.4 : 1,
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{
              minWidth: 40, height: 40, borderRadius: 8, border: '1px solid rgba(192,197,206,0.3)',
              background: 'rgba(192,197,206,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: '#C0C5CE',
            }}>
              {page + 1}
            </div>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              style={{
                width: 40, height: 40, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: page >= totalPages - 1 ? 'var(--text-muted, #64748b)' : 'var(--text-primary, #E6EDF3)',
                opacity: page >= totalPages - 1 ? 0.4 : 1,
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </CockpitPage>
  )
}
