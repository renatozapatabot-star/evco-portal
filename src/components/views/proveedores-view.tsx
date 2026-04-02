'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import DataTable, { Column } from '@/components/DataTable'
import { getCookieValue } from '@/lib/client-config'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const FLAGS: Record<string, string> = { USA: '🇺🇸', MX: '🇲🇽', CA: '🇨🇦', MEX: '🇲🇽', CAN: '🇨🇦', DEU: '🇩🇪', CHN: '🇨🇳', JPN: '🇯🇵', TWN: '🇹🇼', KOR: '🇰🇷', THA: '🇹🇭', VNM: '🇻🇳', ITA: '🇮🇹', BEL: '🇧🇪', AUS: '🇦🇺', CHE: '🇨🇭', IND: '🇮🇳', MYS: '🇲🇾' }
const flag = (c: string | null) => FLAGS[(c || '').toUpperCase()] || '🌐'

type ViewTab = 'proveedores' | 'productos'

export function ProveedoresView() {
  const companyId = getCookieValue('company_id') ?? ''
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewTab, setViewTab] = useState<ViewTab>('proveedores')
  const [products, setProducts] = useState<any[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [networkMap, setNetworkMap] = useState<Map<string, any>>(new Map())

  useEffect(() => {
    supabase.from('supplier_network').select('supplier_name, supplier_name_normalized, reliability_score, tmec_eligible, incident_rate, total_operations')
      .then(({ data }) => {
        const map = new Map<string, any>()
        ;(data || []).forEach(s => {
          map.set((s.supplier_name || '').toLowerCase().trim(), s)
          if (s.supplier_name_normalized) map.set(s.supplier_name_normalized.toLowerCase().trim(), s)
        })
        setNetworkMap(map)
      })
  }, [])

  async function load() {
    const { data } = await supabase.from('supplier_contacts').select('*').eq('company_id', companyId).order('proveedor', { ascending: true })
    // Deduplicate by proveedor name (case-insensitive), keep most complete
    const seen = new Map<string, any>()
    ;(data || []).forEach(s => {
      const key = (s.proveedor || '').toLowerCase().trim()
      const existing = seen.get(key)
      if (!existing || (s.contact_email && !existing.contact_email) || (s.updated_at > (existing.updated_at || ''))) seen.set(key, s)
    })
    setSuppliers(Array.from(seen.values()))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (viewTab === 'productos' && products.length === 0) {
      setProductsLoading(true)
      fetch(`/api/data?table=product_intelligence&company_id=${companyId}&limit=200&order_by=total_value_usd&order_dir=desc`)
        .then(r => r.json())
        .then(d => { setProducts(d.data ?? []); setProductsLoading(false) })
        .catch(() => setProductsLoading(false))
    }
  }, [viewTab, products.length])

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('supplier_contacts').upsert({ ...form, company_id: companyId, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (!error) { await load(); setEditing(false); setSelected({ ...form }) }
    setSaving(false)
  }

  const withContacts = suppliers.filter(s => s.contact_email || s.contact_phone).length

  const columns: Column[] = useMemo(() => [
    { key: 'proveedor', label: 'Proveedor', render: (r: any) => <span style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.proveedor}</span> },
    { key: 'country', label: 'Pais', render: (r: any) => <span>{flag(r.country)} {r.country || 'USA'}</span> },
    { key: 'contact', label: 'Contacto', sortable: false, render: (r: any) => r.contact_email || r.contact_phone ? <span style={{ color: 'var(--status-green)' }}>Verificado</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'usmca_eligible', label: 'T-MEC', render: (r: any) => r.usmca_eligible !== false ? <span style={{ color: 'var(--success)' }}>✓</span> : <span style={{ color: 'var(--slate-400)' }}>—</span> },
    { key: 'reliability', label: 'Confiabilidad', sortable: false, render: (r: any) => {
      const intel = networkMap.get((r.proveedor || '').toLowerCase().trim())
      if (!intel?.reliability_score) return <span style={{ color: 'var(--slate-400)' }}>—</span>
      const score = intel.reliability_score
      return <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: score >= 90 ? 'var(--success)' : score >= 70 ? 'var(--warning)' : 'var(--danger)' }}>{score}</span>
    }},
    { key: 'operations', label: 'Ops', sortable: false, render: (r: any) => {
      const intel = networkMap.get((r.proveedor || '').toLowerCase().trim())
      return <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--slate-600)' }}>{intel?.total_operations || ''}</span>
    }},
  ], [networkMap])

  const trendIcon = (t: string) => t === 'up' ? '↑' : t === 'down' ? '↓' : '→'
  const trendColor = (t: string) => t === 'up' ? 'var(--status-red, #ef4444)' : t === 'down' ? 'var(--status-green, #22c55e)' : 'var(--text-muted)'

  return (
    <div className="page-shell">
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Proveedores</h1>
        <p className="page-subtitle">{suppliers.length} proveedores &middot; {withContacts} con contacto</p>
      </div>

      <div className="tab-bar">
        {([{ key: 'proveedores', label: `Proveedores (${suppliers.length})` }, { key: 'productos', label: 'Productos Top' }] as const).map(t => (
          <button key={t.key} onClick={() => setViewTab(t.key)}
            className={`tab-btn ${viewTab === t.key ? 'active' : ''}`}>{t.label}</button>
        ))}
      </div>

      {viewTab === 'productos' && (
        <div>
          {productsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 48, borderRadius: 8 }} />)}
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <p style={{ fontSize: 14 }}>Productos pendientes de sincronización. Ejecuta el script product-intelligence primero.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-card)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descripción</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fracción</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Precio Prom.</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tendencia</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Total</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proveedores</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Última Import.</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 20).map((p: any, i: number) => (
                    <tr key={p.id || i} style={{ borderBottom: '1px solid var(--border-card)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{i + 1}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.descripcion}
                        {p.anomaly_flag && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>ANOMALÍA</span>}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--amber-600)' }}>{p.fraccion}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>${Number(p.avg_unit_price || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: trendColor(p.price_trend), fontSize: 16 }}>{trendIcon(p.price_trend)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>${Number(p.total_value_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{p.supplier_count}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{p.last_imported ? new Date(p.last_imported).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {viewTab === 'proveedores' && <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 16 }}>
        <DataTable
          columns={columns}
          data={suppliers}
          loading={loading}
          keyField="id"
          pageSize={50}
          exportFilename={`${companyId}_proveedores`}
          searchPlaceholder="Buscar proveedor..."
          onRowClick={(r) => { setSelected(r); setForm(r); setEditing(false) }}
        />

        {selected && (
          <div className="card" style={{ padding: 24, alignSelf: 'start', position: 'sticky', top: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.proveedor}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditing(!editing)} style={{ background: editing ? 'var(--bg-elevated)' : 'rgba(212,168,67,0.1)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '6px 16px', color: editing ? 'var(--text-secondary)' : 'var(--amber-600)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{editing ? 'Cancelar' : 'Editar'}</button>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>x</button>
              </div>
            </div>
            {editing ? (
              <div>
                {[{ label: 'Nombre de Contacto', key: 'contact_name' }, { label: 'Email', key: 'contact_email' }, { label: 'Telefono', key: 'contact_phone' }, { label: 'Cargo', key: 'contact_title' }, { label: 'Pais', key: 'country' }].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{f.label}</label>
                    <input value={form[f.key] || ''} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))} style={{ width: '100%', height: 40, border: '1px solid var(--border-default)', borderRadius: 8, padding: '0 12px', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-sans)', background: 'var(--bg-elevated)', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <button onClick={save} disabled={saving} style={{ width: '100%', height: 40, background: saving ? 'var(--bg-elevated)' : 'var(--amber-600)', border: 'none', borderRadius: 8, color: saving ? 'var(--text-muted)' : '#000', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', marginTop: 8 }}>{saving ? 'Guardando...' : 'Guardar Contacto'}</button>
              </div>
            ) : (
              <div>
                {[{ label: 'Pais', value: `${flag(selected.country)} ${selected.country || 'USA'}` }, { label: 'Contacto', value: selected.contact_name }, { label: 'Email', value: selected.contact_email }, { label: 'Telefono', value: selected.contact_phone }, { label: 'T-MEC', value: selected.usmca_eligible !== false ? 'Elegible' : 'No' }].filter(f => f.value).map(f => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-card)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{f.label}</span>
                    <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>{f.value}</span>
                  </div>
                ))}
                {!selected.contact_email && !selected.contact_phone && (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>Sin datos de contacto registrados</div>
                    <button onClick={() => setEditing(true)} style={{ background: 'var(--amber-100)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '8px 20px', color: 'var(--amber-600)', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Agregar contacto</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>}
    </div>
  )
}
