'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/Toast'
import { createClient } from '@supabase/supabase-js'

import { getCookieValue, getClientNameCookie, getClientRfcCookie } from '@/lib/client-config'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const T = { bg: 'var(--bg-main)', surface: 'var(--card-bg)', border: 'var(--border)', surfaceAlt: '#F5F3EF', text: 'var(--text-primary)', textSub: 'var(--text-secondary)', textMuted: '#999999', navy: 'var(--gold-dark)', gold: 'var(--gold-dark)', goldBg: '#FFF8EB', goldBorder: '#E8C84A', green: 'var(--success)', greenBg: '#EAF3DE', shadow: '0 1px 3px rgba(0,0,0,0.07)' }

const ORIGIN_CRITERIA = [
  { code: 'A', label: 'A — Wholly obtained or produced entirely in USMCA territory' },
  { code: 'B', label: 'B — Produced entirely from originating materials' },
  { code: 'C', label: 'C — Tariff shift + Regional Value Content satisfied' },
  { code: 'D', label: 'D — Produced entirely in USMCA territory' },
]

export function USMCAView() {
  const companyId = getCookieValue('company_id') ?? ''
  const { toast } = useToast()
  const [suppliers, setSuppliers] = useState<{ proveedor: string; contact_name?: string | null; address?: string | null }[]>([])
  const [generating, setGenerating] = useState(false)
  const [cert, setCert] = useState<{ qualifies?: boolean; assessment?: string; analysis?: string } | null>(null)
  const [certNum] = useState(() => `TMEC-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`)
  const [form, setForm] = useState({
    certifier_name: 'Renato Zapata III', certifier_title: 'Director General', certifier_company: 'Renato Zapata & Company',
    certifier_address: '8402 Killam Industrial Blvd, Laredo, Texas 78045', certifier_email: 'ai@renatozapata.com',
    exporter_name: '', exporter_address: '', producer_name: '', producer_address: '',
    importer_name: '', importer_address: '',
    goods_description: '', hs_code: '', origin_criterion: 'C',
    blanket_from: new Date().toISOString().split('T')[0],
    blanket_to: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    blanket: true,
  })

  useEffect(() => {
    // Populate importer from cookies on mount
    const clientName = getClientNameCookie()
    if (clientName) {
      setForm(f => ({ ...f, importer_name: clientName.toUpperCase(), importer_address: `RFC ${getClientRfcCookie()} — México` }))
    }
    supabase.from('supplier_contacts').select('proveedor, contact_name, address').eq('company_id', companyId).order('proveedor').then(({ data }) => setSuppliers(data || []))
  }, [])

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  function handleSupplierSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = suppliers.find(s => s.proveedor === e.target.value)
    if (!s) return
    set('exporter_name', s.proveedor); set('producer_name', s.proveedor)
    if (s.address) { set('exporter_address', s.address); set('producer_address', s.address) }
  }

  async function generateCertificate() {
    if (!form.goods_description || !form.hs_code) return
    setGenerating(true)
    try {
      const res = await fetch('/api/usmca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, certNum }) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCert(data)
    } catch (e: unknown) { toast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error') }
    setGenerating(false)
  }

  function downloadCert() {
    if (!cert) return
    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    const content = [`CERTIFICADO DE ORIGEN / CERTIFICATE OF ORIGIN`, `USMCA / T-MEC · No. ${certNum}`, `Fecha: ${today}`, '', `CERTIFIER: ${form.certifier_name} — ${form.certifier_company}`, `EXPORTER: ${form.exporter_name}`, `IMPORTER: ${form.importer_name}`, '', `GOODS: ${form.goods_description}`, `HS CODE: ${form.hs_code}`, `CRITERION: ${form.origin_criterion}`, `PERIOD: ${form.blanket_from} to ${form.blanket_to}`, '', cert.assessment || '', '', `Renato Zapata III — Director General · Patente 3596`].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${certNum}.txt`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: T.text, fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, margin: 0 }}>USMCA / T-MEC Certificate Generator</h2>
        <p style={{ color: T.textMuted, fontSize: 'var(--aguila-fs-compact)', margin: '4px 0 0' }}>Certificado de Origen · USMCA Art. 5.2 · Firmado por Renato Zapata III</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: cert ? '1fr 1fr' : '600px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: T.shadow, padding: 20 }}>
            <div style={{ color: T.textMuted, fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Proveedor / Exportador</div>
            <select onChange={handleSupplierSelect} style={{ width: '100%', height: 38, border: `1px solid ${T.border}`, borderRadius: 8, padding: '0 10px', fontSize: 'var(--aguila-fs-body)', color: T.text, background: T.bg, outline: 'none', fontFamily: 'inherit', marginBottom: 10 }}>
              <option value="">— Seleccionar proveedor —</option>
              {suppliers.map(s => <option key={s.proveedor} value={s.proveedor}>{s.proveedor}</option>)}
            </select>
            {[{ label: 'Exporter Name', key: 'exporter_name' }, { label: 'Exporter Address', key: 'exporter_address' }].map(f => (
              <div key={f.key} style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', color: T.textSub, fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, marginBottom: 4 }}>{f.label}</label>
                <input value={String((form as Record<string, string | boolean>)[f.key] || "")} onChange={e => set(f.key, e.target.value)} style={{ width: '100%', height: 36, border: `1px solid ${T.border}`, borderRadius: 7, padding: '0 10px', fontSize: 'var(--aguila-fs-compact)', color: T.text, background: T.bg, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: T.shadow, padding: 20 }}>
            <div style={{ color: T.textMuted, fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Goods / Mercancías</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', color: T.textSub, fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, marginBottom: 4 }}>Description of Goods *</label>
              <textarea value={form.goods_description} onChange={e => set('goods_description', e.target.value)} placeholder="Plastic resin pellets, polypropylene..." rows={3} style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 7, padding: '8px 10px', fontSize: 'var(--aguila-fs-compact)', color: T.text, background: T.bg, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', color: T.textSub, fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, marginBottom: 4 }}>HS Code *</label>
                <input value={form.hs_code} onChange={e => set('hs_code', e.target.value)} placeholder="3902.10" style={{ width: '100%', height: 36, border: `1px solid ${T.border}`, borderRadius: 7, padding: '0 10px', fontSize: 'var(--aguila-fs-compact)', color: T.text, background: T.bg, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: T.textSub, fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, marginBottom: 4 }}>Origin Criterion</label>
                <select value={form.origin_criterion} onChange={e => set('origin_criterion', e.target.value)} style={{ width: '100%', height: 36, border: `1px solid ${T.border}`, borderRadius: 7, padding: '0 8px', fontSize: 'var(--aguila-fs-compact)', color: T.text, background: T.bg, outline: 'none', fontFamily: 'inherit' }}>
                  {ORIGIN_CRITERIA.map(c => <option key={c.code} value={c.code}>Criterion {c.code}</option>)}
                </select>
              </div>
            </div>
            <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 7, padding: '8px 12px', marginTop: 10 }}>
              <div style={{ color: T.textMuted, fontSize: 'var(--aguila-fs-meta)' }}><strong>Criterion {form.origin_criterion}:</strong> {ORIGIN_CRITERIA.find(c => c.code === form.origin_criterion)?.label}</div>
            </div>
          </div>
          <button onClick={generateCertificate} disabled={generating || !form.goods_description || !form.hs_code} style={{ height: 44, background: generating || !form.goods_description || !form.hs_code ? '#CBD5E1' : T.navy, border: 'none', borderRadius: 10, color: 'rgba(255,255,255,0.045)', fontSize: 'var(--aguila-fs-section)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{generating ? '⏳ Validating...' : '📜 Generate USMCA Certificate'}</button>
        </div>
        {cert && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: T.shadow, padding: 20, borderTop: `3px solid ${T.gold}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div><div style={{ color: T.gold, fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{certNum}</div><div style={{ color: T.text, fontSize: 15, fontWeight: 700, marginTop: 2 }}>Certificate of Origin</div></div>
              <button onClick={downloadCert} style={{ background: T.navy, border: 'none', borderRadius: 7, padding: '7px 14px', color: 'rgba(255,255,255,0.045)', fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>⬇️ Download</button>
            </div>
            <div style={{ background: cert.qualifies ? T.greenBg : '#FEE2E2', border: `1px solid ${cert.qualifies ? T.green : 'var(--portal-status-red-fg)'}30`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 'var(--aguila-fs-kpi-small)' }}>{cert.qualifies ? '✅' : '⚠️'}</span>
              <div><div style={{ color: cert.qualifies ? T.green : 'var(--danger-text, #991B1B)', fontSize: 'var(--aguila-fs-body)', fontWeight: 700 }}>{cert.qualifies ? 'QUALIFIES FOR USMCA' : 'REVIEW REQUIRED'}</div><div style={{ color: cert.qualifies ? T.green : 'var(--danger-text, #991B1B)', fontSize: 'var(--aguila-fs-meta)', marginTop: 2 }}>{cert.assessment}</div></div>
            </div>
            {[{ label: 'Exporter', value: form.exporter_name || '' }, { label: 'Importer', value: form.importer_name }, { label: 'HS Code', value: form.hs_code }, { label: 'Criterion', value: form.origin_criterion }, { label: 'Coverage', value: `${form.blanket_from} to ${form.blanket_to}` }].map(f => (
              <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ color: T.textMuted, fontSize: 'var(--aguila-fs-compact)' }}>{f.label}</span><span style={{ color: T.text, fontSize: 'var(--aguila-fs-compact)', fontWeight: 500 }}>{f.value}</span>
              </div>
            ))}
            {cert.analysis && <div style={{ marginTop: 14, padding: 12, background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 8 }}><div style={{ color: T.textMuted, fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Origin Analysis</div><div style={{ color: T.textSub, fontSize: 'var(--aguila-fs-compact)', lineHeight: 1.6 }}>{cert.analysis}</div></div>}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.border}`, textAlign: 'right' }}><div style={{ color: T.text, fontSize: 'var(--aguila-fs-compact)', fontWeight: 700 }}>{form.certifier_name}</div><div style={{ color: T.textMuted, fontSize: 'var(--aguila-fs-label)' }}>Director General · Patente 3596</div></div>
          </div>
        )}
      </div>
    </div>
  )
}
