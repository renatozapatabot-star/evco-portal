'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const T = {
  bg: '#FAFAF8', surface: '#FFFFFF', border: '#E8E6E0', surfaceAlt: '#F5F3EF',
  text: '#1A1A1A', textSub: '#6B6B6B', textMuted: '#999999',
  navy: '#BA7517', gold: '#BA7517', shadow: '0 1px 3px rgba(0,0,0,0.07)',
}

function fmtNum(n: any) { return Number(n || 0).toLocaleString('es-MX') }

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
    if (data.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: T.textMuted }}>📋 Sin datos</div>
    const cols = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'tenant_id').slice(0, 8)
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.border}` }}>
              {cols.map(c => <th key={c} style={{ padding: '10px 14px', textAlign: 'left', color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{c.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} style={{ borderBottom: i < data.length - 1 ? `1px solid ${T.border}` : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = T.surfaceAlt)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {cols.map(c => <td key={c} style={{ padding: '10px 14px', color: T.text, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[c] != null ? String(row[c]).substring(0, 50) : '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: T.text, fontSize: 18, fontWeight: 700, margin: 0 }}>Anexo 24 — IMMEX</h2>
        <p style={{ color: T.textMuted, fontSize: 12, margin: '4px 0 0' }}>Reconciliación maquila · EVCO Plastics de México</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Pedimentos', count: counts.pedimentos },
          { label: 'Fracciones', count: counts.fracciones },
          { label: 'Núm. Parte', count: counts.numeros_parte },
          { label: 'Partidas', count: counts.partidas },
          { label: 'Proveedores', count: counts.proveedores },
        ].map(s => (
          <Card key={s.label} style={{ padding: '10px 16px', textAlign: 'center', flex: 1, minWidth: 100 }}>
            <div style={{ color: T.navy, fontSize: 18, fontWeight: 800 }}>{fmtNum(s.count)}</div>
            <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: T.surfaceAlt, borderRadius: 8, padding: 3, width: 'fit-content', border: `1px solid ${T.border}` }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ background: activeTab === tab.id ? T.surface : 'none', border: activeTab === tab.id ? `1px solid ${T.border}` : '1px solid transparent', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', color: activeTab === tab.id ? T.text : T.textSub, fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
            {tab.label}
            {tab.count > 0 && <span style={{ background: T.navy, color: '#fff', borderRadius: 99, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>{fmtNum(tab.count)}</span>}
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
