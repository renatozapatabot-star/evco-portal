'use client'

import { useEffect, useState } from 'react'
import { Table2 } from 'lucide-react'
import { CLIENT_NAME } from '@/lib/client-config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const T = {
  bg: '#FAFAF8', surface: '#FFFFFF', border: '#E8E6E0', surfaceAlt: '#F5F3EF',
  text: '#1A1A1A', textSub: '#6B6B6B', textMuted: '#999999',
  navy: '#BA7517', gold: '#BA7517', shadow: '0 1px 3px rgba(0,0,0,0.07)',
}

function fmtNum(n: any) { return Number(n || 0).toLocaleString('es-MX') }
function fmtUSD(n: any) { return n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '' }
function fmtDate(s: any) { if (!s) return ''; try { return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return String(s) } }
function isDateCol(c: string) { return /fecha|date|created_at|updated_at/i.test(c) }
function titleCase(s: string) { if (!s) return ''; return s.toLowerCase().replace(/(?:^|\s|[-/])\w/g, c => c.toUpperCase()) }
function isProvCol(c: string) { return /proveedor|proveedores|supplier/i.test(c) }

function Card({ children, style = {} }: any) {
  return <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: T.shadow, ...style }}>{children}</div>
}

export function Anexo24View() {
  const [pedimentos, setPedimentos] = useState<any[]>([])
  const [fracciones, setFracciones] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [counts, setCounts] = useState<any>({})
  const [activeTab, setActiveTab] = useState('pedimentos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [pedRes, fracRes, provRes, c1, c2, c3, c4, c5] = await Promise.all([
        supabase.from('anexo24_pedimentos').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('anexo24_fracciones').select('*').limit(50),
        supabase.from('anexo24_proveedores').select('*').limit(50),
        supabase.from('anexo24_pedimentos').select('*', { count: 'exact', head: true }),
        supabase.from('anexo24_fracciones').select('*', { count: 'exact', head: true }),
        supabase.from('anexo24_numeros_parte').select('*', { count: 'exact', head: true }),
        supabase.from('anexo24_partidas').select('*', { count: 'exact', head: true }),
        supabase.from('anexo24_proveedores').select('*', { count: 'exact', head: true }),
      ])
      setPedimentos(pedRes.data || [])
      setFracciones(fracRes.data || [])
      setProveedores(provRes.data || [])
      setCounts({ pedimentos: c1.count || 0, fracciones: c2.count || 0, numeros_parte: c3.count || 0, partidas: c4.count || 0, proveedores: c5.count || 0 })
      setLoading(false)
    }
    load()
  }, [])

  const TABS = [
    { id: 'pedimentos', label: 'Pedimentos', count: counts.pedimentos },
    { id: 'fracciones', label: 'Fracciones', count: counts.fracciones },
    { id: 'proveedores', label: 'Proveedores', count: counts.proveedores },
  ]

  function renderTable(data: any[]) {
    if (data.length === 0) return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Table2 size={32} strokeWidth={1.5} style={{ color: 'var(--n-300)', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--n-700)', marginBottom: 4 }}>Sin datos de Anexo 24</div>
        <div style={{ fontSize: 13, color: 'var(--n-400)' }}>Los artículos temporales aparecerán aquí</div>
      </div>
    )
    const cols = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'tenant_id').slice(0, 8)
    const isNumCol = (c: string) => /valor|importe|total|cantidad|peso/i.test(c)
    return (
      <div className="overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              {cols.map(c => <th key={c} scope="col" style={isNumCol(c) ? { textAlign: 'right' } : undefined}>{c.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {cols.map(c => (
                  <td key={c} className={isNumCol(c) ? 'c-num' : ''} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row[c] != null && String(row[c]).trim() !== ''
                      ? isNumCol(c) ? fmtUSD(row[c])
                      : isDateCol(c) ? fmtDate(row[c])
                      : isProvCol(c) ? titleCase(String(row[c]).substring(0, 50))
                      : String(row[c]).substring(0, 50)
                      : <span className="c-empty">&middot;</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Anexo 24 — IMMEX</h2>
        <p style={{ color: T.textMuted, fontSize: 12, margin: '4px 0 0' }}>Reconciliación maquila · {CLIENT_NAME}</p>
      </div>

      {/* IMMEX Temporal Compliance */}
      {pedimentos.length > 0 && (() => {
        const getMonths = (d: string) => d ? Math.floor((Date.now() - new Date(d).getTime()) / (86400000 * 30)) : 0
        const dateField = pedimentos[0]?.fecha_presentacion !== undefined && pedimentos[0]?.fecha_presentacion !== null ? 'fecha_presentacion' : 'fecha_pago'
        const withDate = pedimentos.filter((r: any) => r[dateField])
        const violations = withDate.filter((r: any) => getMonths(r[dateField]) >= 18).length
        const approaching = withDate.filter((r: any) => { const m = getMonths(r[dateField]); return m >= 15 && m < 18 }).length
        return (
          <>
            {violations > 0 && (
              <div style={{ background: '#FEE2E2', borderLeft: '4px solid #DC2626', padding: '14px 20px', borderRadius: '0 8px 8px 0', marginBottom: 12, fontSize: 14, fontWeight: 800, color: '#DC2626' }}>
                {violations} operaciones EXCEDIERON el plazo de 18 meses. Riesgo de multa inmediato.
              </div>
            )}
            {approaching > 0 && (
              <div style={{ background: '#FFFBEB', borderLeft: '4px solid #D4952A', padding: '12px 20px', borderRadius: '0 8px 8px 0', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                {approaching} operaciones se acercan al plazo (15-18 meses).
              </div>
            )}
          </>
        )
      })()}

      <div className="kpi-grid" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[
          { label: 'Pedimentos', count: counts.pedimentos },
          { label: 'Fracciones', count: counts.fracciones },
          { label: 'Núm. Parte', count: counts.numeros_parte },
          { label: 'Partidas', count: counts.partidas },
          { label: 'Proveedores', count: counts.proveedores },
        ].map(s => (
          <div key={s.label} className="kpi-card" style={{ textAlign: 'center' }}>
            <div className="kpi-value" style={{ fontSize: 28 }}>{fmtNum(s.count)}</div>
            <div className="kpi-label" style={{ marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 rounded-[7px] p-0.5 mb-4 w-fit" style={{ background: 'var(--n-100)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="f-chip"
            style={activeTab === tab.id
              ? { background: '#fff', color: 'var(--n-900)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', fontWeight: 600 }
              : { color: 'var(--n-500)' }}>
            {tab.label}
            {tab.count > 0 && <span style={{ background: 'var(--gold-500)', color: '#fff', borderRadius: 99, padding: '1px 5px', fontSize: 9, fontWeight: 700, marginLeft: 4 }}>{fmtNum(tab.count)}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 28, height: 28, border: `3px solid ${T.border}`, borderTopColor: T.navy, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <Card>
          {activeTab === 'pedimentos' && renderTable(pedimentos)}
          {activeTab === 'fracciones' && renderTable(fracciones)}
          {activeTab === 'proveedores' && renderTable(proveedores)}
        </Card>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
