'use client'

import { useEffect, useState, useMemo } from 'react'
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Search } from 'lucide-react'
import { CLIENT_CLAVE } from '@/lib/client-config'

interface CarteraRow { consecutivo: number; cve_cliente: string; tipo: string; referencia: string; fecha: string; importe: number; saldo: number; moneda: string; observaciones: string }
interface IngresoRow { consecutivo: number; cve_cliente: string; forma_ingreso: string; referencia: string; fecha: string; importe: number; moneda: string; concepto: string }
interface EgresoRow { consecutivo: number; cve_cliente: string; forma_egreso: string; tipo_egreso: string; beneficiario: string; referencia: string; fecha: string; importe: number; moneda: string; concepto: string }
interface FacturaRow { consecutivo: number; cve_cliente: string; serie: string; folio: number; fecha: string; subtotal: number; iva: number; total: number; moneda: string; observaciones: string }

const fmtMXN = (n: number) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`
const fmtDate = (s: string | null) => {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}

type Tab = 'resumen' | 'cartera' | 'ingresos' | 'egresos' | 'facturas'

export function CuentasView() {
  const [cartera, setCartera] = useState<CarteraRow[]>([])
  const [ingresos, setIngresos] = useState<IngresoRow[]>([])
  const [egresos, setEgresos] = useState<EgresoRow[]>([])
  const [facturas, setFacturas] = useState<FacturaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('resumen')
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/data?table=econta_cartera&cve_cliente=${CLIENT_CLAVE}&limit=5000&order_by=fecha&order_dir=desc`).then(r => r.json()),
      fetch(`/api/data?table=econta_ingresos&cve_cliente=${CLIENT_CLAVE}&limit=5000&order_by=fecha&order_dir=desc`).then(r => r.json()),
      fetch(`/api/data?table=econta_egresos&cve_cliente=${CLIENT_CLAVE}&limit=5000&order_by=fecha&order_dir=desc`).then(r => r.json()),
      fetch(`/api/data?table=econta_facturas&cve_cliente=${CLIENT_CLAVE}&limit=5000&order_by=fecha&order_dir=desc`).then(r => r.json()),
    ]).then(([c, i, e, f]) => {
      setCartera(c.data ?? [])
      setIngresos(i.data ?? [])
      setEgresos(e.data ?? [])
      setFacturas(f.data ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const kpis = useMemo(() => {
    const totalCargos = cartera.filter(r => r.tipo === 'C').reduce((s, r) => s + (r.importe || 0), 0)
    const totalAbonos = cartera.filter(r => r.tipo === 'A').reduce((s, r) => s + (r.importe || 0), 0)
    const totalIngresos = ingresos.reduce((s, r) => s + (r.importe || 0), 0)
    const totalEgresos = egresos.reduce((s, r) => s + (r.importe || 0), 0)
    const totalFacturado = facturas.reduce((s, r) => s + (r.total || 0), 0)
    return { totalCargos, totalAbonos, saldo: totalCargos - totalAbonos, totalIngresos, totalEgresos, totalFacturado }
  }, [cartera, ingresos, egresos, facturas])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'cartera', label: `Cartera (${cartera.length})` },
    { key: 'ingresos', label: `Ingresos (${ingresos.length})` },
    { key: 'egresos', label: `Egresos (${egresos.length})` },
    { key: 'facturas', label: `Facturas (${facturas.length})` },
  ]

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-7 h-7 rounded-full" style={{ border: '3px solid #e5e7eb', borderTopColor: '#0f1624', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-[18px] font-semibold" style={{ color: '#111827' }}>Cuentas & Finanzas</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: '#6b7280' }}>
            eConta · {cartera.length.toLocaleString()} movimientos cartera · Clave {CLIENT_CLAVE}
          </p>
        </div>
        {tab !== 'resumen' && (
          <div className="flex items-center gap-2 rounded-[7px] px-3 py-1.5"
            style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.09)', width: 260 }}>
            <Search size={13} strokeWidth={2} style={{ color: '#9ca3af', flexShrink: 0 }} />
            <input type="text" placeholder="Referencia, concepto..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[12.5px]" style={{ color: '#374151' }} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 rounded-[7px] p-0.5 mb-5 w-fit" style={{ background: '#f0f2f5' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSearch('') }}
            className="px-3.5 py-[5px] rounded-[5px] text-[12.5px] font-medium transition-all duration-100"
            style={tab === t.key
              ? { background: '#fff', color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
              : { color: '#6b7280' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* KPI Cards — always visible */}
      {tab === 'resumen' && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Saldo Cartera', value: fmtMXN(kpis.saldo), icon: CreditCard, color: kpis.saldo > 0 ? '#b91c1c' : '#065f46' },
              { label: 'Total Ingresos', value: fmtMXN(kpis.totalIngresos), icon: TrendingUp, color: '#065f46' },
              { label: 'Total Egresos', value: fmtMXN(kpis.totalEgresos), icon: TrendingDown, color: '#b91c1c' },
              { label: 'Total Facturado', value: fmtMXN(kpis.totalFacturado), icon: DollarSign, color: '#111827' },
            ].map(k => (
              <div key={k.label} className="rounded-[10px] p-4 flex items-start justify-between"
                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)' }}>
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: '#6b7280' }}>{k.label}</div>
                  <div className="mono text-[20px] font-semibold" style={{ color: k.color }}>{k.value}</div>
                </div>
                <div className="w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(201,168,76,0.1)' }}>
                  <k.icon size={17} strokeWidth={1.8} style={{ color: '#C9A84C' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Recent movements */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-[10px] overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="text-[13px] font-semibold" style={{ color: '#111827' }}>Últimos Ingresos</div>
              </div>
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Referencia</th><th style={{ textAlign: 'right' }}>Importe</th></tr></thead>
                <tbody>
                  {ingresos.slice(0, 8).map(r => (
                    <tr key={r.consecutivo}>
                      <td className="text-[12px]" style={{ color: '#374151' }}>{fmtDate(r.fecha)}</td>
                      <td className="text-[12px]" style={{ color: '#374151' }}>{r.referencia || r.concepto?.slice(0, 30) || '—'}</td>
                      <td className="text-right mono text-[12px] font-medium" style={{ color: '#065f46' }}>{fmtMXN(r.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-[10px] overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="text-[13px] font-semibold" style={{ color: '#111827' }}>Últimos Egresos</div>
              </div>
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Beneficiario</th><th style={{ textAlign: 'right' }}>Importe</th></tr></thead>
                <tbody>
                  {egresos.slice(0, 8).map(r => (
                    <tr key={r.consecutivo}>
                      <td className="text-[12px]" style={{ color: '#374151' }}>{fmtDate(r.fecha)}</td>
                      <td className="text-[12px] max-w-[180px] truncate" style={{ color: '#374151' }}>{r.beneficiario || r.concepto?.slice(0, 30) || '—'}</td>
                      <td className="text-right mono text-[12px] font-medium" style={{ color: '#b91c1c' }}>{fmtMXN(r.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Cartera Table */}
      {tab === 'cartera' && (
        <div className="rounded-[10px] overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="overflow-x-auto" style={{ maxHeight: 600 }}>
            <table className="data-table">
              <thead><tr>
                <th>Fecha</th><th>Tipo</th><th>Referencia</th><th style={{ textAlign: 'right' }}>Cargo</th><th style={{ textAlign: 'right' }}>Abono</th><th>Moneda</th><th>Pedimento</th>
              </tr></thead>
              <tbody>
                {cartera.filter(r => !search || (r.referencia ?? '').toLowerCase().includes(search.toLowerCase()) || (r.observaciones ?? '').toLowerCase().includes(search.toLowerCase())).slice(0, 200).map(r => (
                  <tr key={r.consecutivo}>
                    <td className="text-[12px]" style={{ color: '#374151' }}>{fmtDate(r.fecha)}</td>
                    <td><span className={`badge ${r.tipo === 'C' ? 'badge-proceso' : 'badge-cruzado'}`}><span className="badge-dot" />{r.tipo === 'C' ? 'Cargo' : 'Abono'}</span></td>
                    <td className="mono text-[12px]" style={{ color: '#111827' }}>{r.referencia || '—'}</td>
                    <td className="text-right mono text-[12px]" style={{ color: r.tipo === 'C' ? '#b91c1c' : '#e5e7eb' }}>{r.tipo === 'C' ? fmtMXN(r.importe) : '—'}</td>
                    <td className="text-right mono text-[12px]" style={{ color: r.tipo === 'A' ? '#065f46' : '#e5e7eb' }}>{r.tipo === 'A' ? fmtMXN(r.saldo) : '—'}</td>
                    <td className="text-[11px]" style={{ color: '#6b7280' }}>{r.moneda || 'MXN'}</td>
                    <td className="text-[11px]" style={{ color: '#6b7280' }}>{r.observaciones || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ingresos Table */}
      {tab === 'ingresos' && (
        <div className="rounded-[10px] overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="overflow-x-auto" style={{ maxHeight: 600 }}>
            <table className="data-table">
              <thead><tr><th>Fecha</th><th>Forma</th><th>Cliente</th><th>Referencia</th><th>Concepto</th><th style={{ textAlign: 'right' }}>Importe</th><th>Moneda</th></tr></thead>
              <tbody>
                {ingresos.filter(r => !search || (r.referencia ?? '').toLowerCase().includes(search.toLowerCase()) || (r.concepto ?? '').toLowerCase().includes(search.toLowerCase())).slice(0, 200).map(r => (
                  <tr key={r.consecutivo}>
                    <td className="text-[12px]" style={{ color: '#374151' }}>{fmtDate(r.fecha)}</td>
                    <td className="text-[11px]" style={{ color: '#6b7280' }}>{r.forma_ingreso}</td>
                    <td className="mono text-[12px]" style={{ color: '#111827' }}>{r.cve_cliente}</td>
                    <td className="text-[12px]" style={{ color: '#374151' }}>{r.referencia || '—'}</td>
                    <td className="text-[12px] max-w-[200px] truncate" style={{ color: '#374151' }}>{r.concepto || '—'}</td>
                    <td className="text-right mono text-[12px] font-medium" style={{ color: '#065f46' }}>{fmtMXN(r.importe)}</td>
                    <td className="text-[11px]" style={{ color: '#6b7280' }}>{r.moneda}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Egresos Table */}
      {tab === 'egresos' && (
        <div className="rounded-[10px] overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="overflow-x-auto" style={{ maxHeight: 600 }}>
            <table className="data-table">
              <thead><tr><th>Fecha</th><th>Forma</th><th>Beneficiario</th><th>Referencia</th><th>Concepto</th><th style={{ textAlign: 'right' }}>Importe</th></tr></thead>
              <tbody>
                {egresos.filter(r => !search || (r.beneficiario ?? '').toLowerCase().includes(search.toLowerCase()) || (r.concepto ?? '').toLowerCase().includes(search.toLowerCase())).slice(0, 200).map(r => (
                  <tr key={r.consecutivo}>
                    <td className="text-[12px]" style={{ color: '#374151' }}>{fmtDate(r.fecha)}</td>
                    <td className="text-[11px]" style={{ color: '#6b7280' }}>{r.forma_egreso}</td>
                    <td className="text-[12px] max-w-[180px] truncate" style={{ color: '#374151' }}>{r.beneficiario || '—'}</td>
                    <td className="text-[12px]" style={{ color: '#374151' }}>{r.referencia || '—'}</td>
                    <td className="text-[12px] max-w-[200px] truncate" style={{ color: '#374151' }}>{r.concepto || '—'}</td>
                    <td className="text-right mono text-[12px] font-medium" style={{ color: '#b91c1c' }}>{fmtMXN(r.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Facturas Table */}
      {tab === 'facturas' && (
        <div className="rounded-[10px] overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="overflow-x-auto" style={{ maxHeight: 600 }}>
            <table className="data-table">
              <thead><tr><th>Serie-Folio</th><th>Fecha</th><th>Cliente</th><th style={{ textAlign: 'right' }}>Subtotal</th><th style={{ textAlign: 'right' }}>IVA</th><th style={{ textAlign: 'right' }}>Total</th><th>Moneda</th></tr></thead>
              <tbody>
                {facturas.filter(r => !search || String(r.folio).includes(search) || (r.observaciones ?? '').toLowerCase().includes(search.toLowerCase())).slice(0, 200).map(r => (
                  <tr key={r.consecutivo}>
                    <td className="mono text-[12px] font-medium" style={{ color: '#111827' }}>{r.serie || ''}{r.folio || '—'}</td>
                    <td className="text-[12px]" style={{ color: '#374151' }}>{fmtDate(r.fecha)}</td>
                    <td className="text-[12px]" style={{ color: '#374151' }}>{r.cve_cliente || '—'}</td>
                    <td className="text-right mono text-[12px]" style={{ color: '#374151' }}>{fmtMXN(r.subtotal)}</td>
                    <td className="text-right mono text-[12px]" style={{ color: '#6b7280' }}>{fmtMXN(r.iva)}</td>
                    <td className="text-right mono text-[12px] font-semibold" style={{ color: '#111827' }}>{fmtMXN(r.total)}</td>
                    <td className="text-[11px]" style={{ color: '#6b7280' }}>{r.moneda || 'MXN'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
