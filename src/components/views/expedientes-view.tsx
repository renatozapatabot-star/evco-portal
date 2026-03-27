'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COMPANY_ID = 'evco'
const PAGE = 25

const DOC_TYPES = [
  { type: 'factura_comercial', label: 'Factura Comercial', cat: 'A', critical: true },
  { type: 'packing_list', label: 'Packing List', cat: 'A', critical: true },
  { type: 'bill_of_lading', label: 'Bill of Lading', cat: 'A', critical: true },
  { type: 'cove', label: 'COVE', cat: 'B', critical: true },
  { type: 'mve_folio', label: 'MVE Folio', cat: 'B', critical: true },
  { type: 'usmca_cert', label: 'USMCA Certificate', cat: 'C' },
  { type: 'cfdi_xml', label: 'CFDI XML', cat: 'D' },
  { type: 'carta_porte', label: 'Carta Porte', cat: 'F' },
  { type: 'nom_cert', label: 'NOM Certificate', cat: 'E' },
  { type: 'immex_auth', label: 'IMMEX Auth', cat: 'E' },
  { type: 'msds', label: 'MSDS', cat: 'I' },
  { type: 'technical_datasheet', label: 'Technical Datasheet', cat: 'I' },
  { type: 'insurance_cert', label: 'Insurance Cert', cat: 'F' },
  { type: 'proof_of_payment', label: 'Proof of Payment', cat: 'G' },
  { type: 'poder_notarial', label: 'Poder Notarial', cat: 'H' },
]

const T = {
  bg: '#FAFAF8', surface: '#FFFFFF', border: '#E8E6E0', surfaceAlt: '#F5F3EF',
  text: '#1A1A1A', textSub: '#6B6B6B', textMuted: '#999999',
  navy: '#BA7517', gold: '#BA7517', goldBg: '#FFF8EB',
  green: '#16A34A', greenBg: '#EAF3DE',
  amber: '#854D0E', amberBg: '#FEF9C3',
  red: '#DC2626', redBg: '#FEF2F2',
  shadow: '0 1px 3px rgba(0,0,0,0.07)',
}

const EXPECTED_DOCS = 10 // realistic target per trafico
function pct(docs: number) { return Math.min(100, Math.round((docs / EXPECTED_DOCS) * 100)) }
function pctColor(p: number) { return p >= 100 ? '#16A34A' : p >= 50 ? '#D4952A' : p >= 1 ? '#CA8A04' : '#DC2626' }

function DocBar({ docs }: { docs: number }) {
  const p = pct(docs)
  const color = pctColor(p)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: T.border, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ color, fontSize: 11, fontWeight: 700, minWidth: 32 }}>{p}%</span>
    </div>
  )
}

export function ExpedientesView() {
  const [traficos, setTraficos] = useState<any[]>([])
  const [documents, setDocuments] = useState<Record<string, string[]>>({})
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    // Query globalpc_facturas which has real 9254-YXXXX trafico IDs
    let q = supabase.from('globalpc_facturas')
      .select('cve_trafico, cve_cliente, cve_proveedor, fecha_facturacion, valor_comercial, moneda, cove_vucem', { count: 'exact' })
      .eq('cve_cliente', '9254')
      .not('cve_trafico', 'is', null)
      .ilike('cve_trafico', '9254-%')
      .order('fecha_facturacion', { ascending: false })
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (search) q = q.ilike('cve_trafico', `%${search}%`)
    const { data: rawData, count } = await q

    // Deduplicate by cve_trafico (multiple facturas per trafico)
    const seen = new Set<string>()
    const data = (rawData || []).filter(r => {
      if (!r.cve_trafico || seen.has(r.cve_trafico)) return false
      seen.add(r.cve_trafico)
      return true
    }).map(r => ({
      trafico: r.cve_trafico,
      estatus: 'En Proceso',
      fecha_llegada: r.fecha_facturacion,
      descripcion_mercancia: `Proveedor: ${r.cve_proveedor || '—'} · ${r.moneda} $${r.valor_comercial?.toLocaleString() || '0'}`,
      pedimento: r.cove_vucem || '—',
    }))
    const uniqueCount = new Set((rawData || []).map(r => r.cve_trafico)).size
    setTraficos(data)
    setTotal(uniqueCount)

    // Load documents for visible traficos from BOTH tables
    if (data && data.length > 0) {
      const ids = data.map((t: any) => t.trafico)
      // Also build short IDs (e.g. 'Y4457') for expediente_documentos matching
      const shortIds = ids.map(id => id.replace('9254-', ''))
      const allMatchIds = [...ids, ...shortIds]
      const map: Record<string, string[]> = {}

      const addDoc = (trafico: string, docType: string) => {
        // Normalize short IDs (Y4457) to full format (9254-Y4457)
        const tid = trafico.startsWith('9254-') ? trafico : `9254-${trafico}`
        if (!ids.includes(tid)) return
        if (!map[tid]) map[tid] = []
        if (docType && !map[tid].includes(docType)) map[tid].push(docType)
      }

      // Source 1: expediente_documentos — keyed by pedimento_id (9254-Y4141 or Y4060 format)
      const { data: expDocs } = await supabase.from('expediente_documentos')
        .select('pedimento_id, doc_type')
        .eq('company_id', 'evco')
        .in('pedimento_id', allMatchIds)
      ;(expDocs || []).forEach((d: any) => addDoc(d.pedimento_id, d.doc_type))

      // Source 2: documents table — trafico stored in metadata->>'trafico'
      const { data: metaDocs } = await supabase.from('documents')
        .select('document_type, metadata')
        .not('metadata', 'is', null)
        .limit(10000)
      ;(metaDocs || []).forEach((d: any) => {
        const trafico = d.metadata?.trafico
        if (trafico && ids.includes(trafico)) {
          const dtype = (d.document_type || '').toLowerCase().replace(/\s+/g, '_')
          addDoc(trafico, dtype)
        }
      })

      setDocuments(map)
    }
    setLoading(false)
  }, [page, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search])

  async function handleUpload(traficoId: string, docType: string, file: File) {
    setUploading(true)
    setUploadStatus('Subiendo...')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('trafico_id', traficoId)
      form.append('doc_type', docType)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (data.success) {
        setUploadStatus(`✅ ${file.name} subido correctamente`)
        setDocuments(prev => ({
          ...prev,
          [traficoId]: [...(prev[traficoId] || []).filter(d => d !== docType), docType]
        }))
        if (selected?.trafico === traficoId) {
          setSelected((s: any) => ({ ...s }))
        }
      } else {
        setUploadStatus(`❌ Error: ${data.error}`)
      }
    } catch (e: any) {
      setUploadStatus(`❌ Error: ${e.message}`)
    }
    setUploading(false)
    setTimeout(() => setUploadStatus(''), 4000)
  }

  return (
    <div style={{ padding: '24px 28px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: T.text, fontSize: 18, fontWeight: 700, margin: 0 }}>Expedientes Digitales</h2>
          <p style={{ color: T.textMuted, fontSize: 12, margin: '4px 0 0' }}>
            {total.toLocaleString()} tráficos activos · Click para subir documentos
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, fontSize: 14 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tráfico..."
            style={{ paddingLeft: 32, paddingRight: 12, height: 36, border: `1px solid ${T.border}`,
              borderRadius: 8, background: T.surface, color: T.text, fontSize: 13, outline: 'none',
              width: 200, fontFamily: 'inherit' }} />
        </div>
      </div>

      {uploadStatus && (
        <div style={{ background: uploadStatus.includes('✅') ? T.greenBg : T.redBg,
          border: `1px solid ${uploadStatus.includes('✅') ? T.green : T.red}30`,
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          color: uploadStatus.includes('✅') ? T.green : T.red, fontSize: 13, fontWeight: 600 }}>
          {uploadStatus}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* List */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: T.shadow }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${T.border}`, borderTopColor: T.navy,
                borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.border}` }}>
                    {['Tráfico', 'Estado', 'Documentos', 'Completitud', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: T.textMuted,
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {traficos.map((t, i) => {
                    const docs = documents[t.trafico] || []
                    const docCount = docs.length
                    const isSelected = selected?.trafico === t.trafico
                    return (
                      <tr key={t.trafico}
                        style={{ borderBottom: i < traficos.length - 1 ? `1px solid ${T.border}` : 'none',
                          background: isSelected ? T.navy + '08' : 'transparent', cursor: 'pointer' }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = T.surfaceAlt }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                        onClick={() => setSelected(isSelected ? null : { ...t, docs })}>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ color: T.navy, fontSize: 12, fontWeight: 700 }}>{t.trafico}</div>
                          <div style={{ color: T.textMuted, fontSize: 10 }}>
                            {t.fecha_llegada ? new Date(t.fecha_llegada).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—'}
                          </div>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: t.estatus === 'Cruzado' ? T.greenBg : t.estatus === 'Detenido' ? T.redBg : T.amberBg,
                            color: t.estatus === 'Cruzado' ? T.green : t.estatus === 'Detenido' ? T.red : T.amber,
                            borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 600 }}>
                            {t.estatus}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px', color: T.text, fontSize: 12 }}>
                          {docCount}<span style={{ color: T.textMuted }}>/{EXPECTED_DOCS}</span>
                        </td>
                        <td style={{ padding: '11px 14px', minWidth: 140 }}><DocBar docs={docCount} /></td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ color: T.textMuted, fontSize: 16 }}>{isSelected ? '✕' : '›'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {Math.ceil(total / PAGE) > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${T.border}` }}>
                  <span style={{ color: T.textMuted, fontSize: 12 }}>{(page*PAGE+1).toLocaleString()}–{Math.min((page+1)*PAGE, total).toLocaleString()} de {total.toLocaleString()}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['← Ant.', page-1, page===0], ['Sig. →', page+1, page>=Math.ceil(total/PAGE)-1]].map(([l,n,d]: any) => (
                      <button key={String(l)} onClick={() => !d && setPage(n)} disabled={d}
                        style={{ border: `1px solid ${T.border}`, background: d ? T.surfaceAlt : T.surface,
                          borderRadius: 6, padding: '5px 12px', cursor: d ? 'default' : 'pointer',
                          color: d ? T.textMuted : T.text, fontSize: 12, fontFamily: 'inherit' }}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Document panel */}
        {selected && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
            padding: 20, boxShadow: T.shadow, position: 'sticky', top: 20, alignSelf: 'start', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ color: T.navy, fontSize: 14, fontWeight: 700 }}>{selected.trafico}</div>
                <div style={{ color: T.textMuted, fontSize: 11 }}>{selected.descripcion_mercancia?.substring(0, 50) || '—'}</div>
              </div>
              <button onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: '10px 14px', marginBottom: 16 }}>
              <DocBar docs={(documents[selected.trafico] || []).length} />
              <div style={{ color: T.textMuted, fontSize: 11, marginTop: 4 }}>
                {(documents[selected.trafico] || []).length}/{EXPECTED_DOCS} documentos
              </div>
            </div>

            {/* Real documents on file */}
            <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 8 }}>Documentos en Archivo</div>

            {(documents[selected.trafico] || []).length > 0 ? (
              (documents[selected.trafico] || []).map(dtype => (
                <div key={dtype} style={{ display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 12 }}>✅</span>
                  <span style={{ color: T.green, fontSize: 12, fontWeight: 500 }}>
                    {dtype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ color: T.textMuted, fontSize: 12, padding: '12px 0' }}>Sin documentos — sync pendiente</div>
            )}

            {/* Expected checklist */}
            <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>Checklist Requerido</div>

            {DOC_TYPES.filter(dt => dt.critical).map(dt => {
              const allDocs = documents[selected.trafico] || []
              const present = allDocs.some(d => d.includes(dt.type.split('_')[0]) || dt.type.includes(d.split('_')[0]))
              return (
                <div key={dt.type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12 }}>{present ? '✅' : '🔴'}</span>
                    <span style={{ color: present ? T.green : T.red, fontSize: 12, fontWeight: 600 }}>{dt.label}</span>
                  </div>
                  {!present && (
                    <label style={{ background: T.navy, color: '#fff', borderRadius: 6,
                      padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: uploading ? 'default' : 'pointer' }}>
                      {uploading ? '...' : 'Subir'}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xml" style={{ display: 'none' }}
                        disabled={uploading}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) handleUpload(selected.trafico, dt.type, file)
                          e.target.value = ''
                        }} />
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
