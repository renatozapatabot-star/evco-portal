'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import DataTable, { Column } from '@/components/DataTable'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const FLAGS: Record<string, string> = { USA: '🇺🇸', MX: '🇲🇽', CA: '🇨🇦', MEX: '🇲🇽', CAN: '🇨🇦', DEU: '🇩🇪', CHN: '🇨🇳', JPN: '🇯🇵', TWN: '🇹🇼', KOR: '🇰🇷', THA: '🇹🇭', VNM: '🇻🇳', ITA: '🇮🇹', BEL: '🇧🇪', AUS: '🇦🇺', CHE: '🇨🇭', IND: '🇮🇳', MYS: '🇲🇾' }
const flag = (c: string | null) => FLAGS[(c || '').toUpperCase()] || '🌐'

export function ProveedoresView() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('supplier_contacts').select('*').eq('company_id', 'evco').order('proveedor', { ascending: true })
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

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('supplier_contacts').upsert({ ...form, company_id: 'evco', updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (!error) { await load(); setEditing(false); setSelected({ ...form }) }
    setSaving(false)
  }

  const withContacts = suppliers.filter(s => s.contact_email || s.contact_phone).length

  const columns: Column[] = useMemo(() => [
    { key: 'proveedor', label: 'Proveedor', render: (r: any) => <span style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.proveedor}</span> },
    { key: 'country', label: 'Pais', render: (r: any) => <span>{flag(r.country)} {r.country || 'USA'}</span> },
    { key: 'contact', label: 'Contacto', sortable: false, render: (r: any) => r.contact_email || r.contact_phone ? <span style={{ color: 'var(--status-green)' }}>Verificado</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'usmca_eligible', label: 'T-MEC', render: (r: any) => r.usmca_eligible !== false ? <span style={{ color: 'var(--status-green)' }}>✓</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
  ], [])

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="pg-title">Proveedores</h1>
        <p className="pg-meta">{suppliers.length} proveedores &middot; {withContacts} con contacto</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 16 }}>
        <DataTable
          columns={columns}
          data={suppliers}
          loading={loading}
          keyField="id"
          pageSize={50}
          exportFilename="evco_proveedores"
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
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{f.label}</span>
                    <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>{f.value}</span>
                  </div>
                ))}
                {!selected.contact_email && !selected.contact_phone && (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>Sin informacion de contacto</div>
                    <button onClick={() => setEditing(true)} style={{ background: 'var(--amber-100)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '8px 20px', color: 'var(--amber-600)', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Agregar contacto</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
