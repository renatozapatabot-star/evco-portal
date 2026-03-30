'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Upload, CheckCircle, AlertTriangle } from 'lucide-react'
import { CLIENT_NAME } from '@/lib/client-config'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const LEGAL_DOCS = [
  { id: 'poder_notarial', category: 'Corporativo', label: 'Poder Notarial', desc: 'Autorización ante agente aduanal', required: true, renew: 'Cada 5 años' },
  { id: 'encargo_conferido', category: 'Corporativo', label: 'Encargo Conferido', desc: 'Autorización VUCEM', required: true, renew: 'Según contrato' },
  { id: 'rfc_constancia', category: 'Fiscal', label: 'RFC Constancia de Situación', desc: 'SAT situación fiscal actualizada', required: true, renew: 'Anual' },
  { id: 'efirma', category: 'Digital', label: 'e.Firma (SAT)', desc: 'Firma electrónica avanzada', required: true, renew: 'Cada 4 años', expiry: '2028-01-01' },
  { id: 'immex', category: 'Programa', label: 'Autorización IMMEX', desc: 'Programa de importación temporal', required: true, renew: 'Anual' },
  { id: 'padron_importadores', category: 'Operativo', label: 'Padron de Importadores', desc: 'Registro activo SAT', required: true, renew: 'Verificar anualmente' },
  { id: 'acta_constitutiva', category: 'Corporativo', label: 'Acta Constitutiva', desc: 'Escritura de constitución', required: true, renew: 'Permanente' },
  { id: 'vucem_acceso', category: 'Digital', label: 'Acceso VUCEM', desc: 'Portal ventanilla unica', required: true, renew: 'Verificar vigencia' },
  { id: 'nom_plasticos', category: 'Regulatorio', label: 'NOM Plasticos', desc: 'Normas aplicables Cap. 39', required: false, renew: 'Según NOM' },
  { id: 'contrato_agencia', category: 'Contractual', label: 'Contrato de Agencia', desc: 'Contrato con Renato Zapata & Company', required: true, renew: 'Según contrato' },
  { id: 'seguro_mercancias', category: 'Financiero', label: 'Seguro de Mercancias', desc: 'Poliza de seguro de carga', required: false, renew: 'Anual' },
  { id: 'certificado_origen', category: 'Comercio', label: 'Certificados T-MEC', desc: 'USMCA certificates on file', required: true, renew: 'Por embarque o anual' },
]

const CATEGORIES = [...new Set(LEGAL_DOCS.map(d => d.category))]

function ProgressRing({ completed, total, size = 64 }: { completed: number; total: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const pct = total > 0 ? completed / total : 0
  const offset = circ * (1 - pct)
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-primary)" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--status-green)" strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 600ms ease' }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill="var(--text-primary)" fontSize={14} fontWeight={600} fontFamily="var(--font-mono)"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        {completed}/{total}
      </text>
    </svg>
  )
}

function getExpiryStatus(expiry: string | undefined) {
  if (!expiry) return null
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000)
  if (days < 0) return { color: 'var(--status-red)', bg: 'rgba(239,68,68,0.15)', label: 'VENCIDO' }
  if (days < 90) return { color: 'var(--status-red)', bg: 'rgba(239,68,68,0.15)', label: `${days} dias` }
  if (days < 180) return { color: 'var(--status-yellow)', bg: 'rgba(234,179,8,0.15)', label: `${days} dias` }
  return { color: 'var(--status-green)', bg: 'rgba(34,197,94,0.15)', label: 'Vigente' }
}

function UploadZone({ docId, onUploaded }: { docId: string; onUploaded: (name: string) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    setUploading(true); setProgress(0)
    // Mock upload with progress
    let p = 0
    const interval = setInterval(() => {
      p += 5
      setProgress(p)
      if (p >= 100) { clearInterval(interval); setTimeout(() => onUploaded(file.name), 200) }
    }, 100)
  }, [onUploaded])

  if (uploading) {
    return (
      <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--amber-600)', borderRadius: 3, transition: 'width 100ms linear' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, textAlign: 'center' }}>{progress}%</div>
      </div>
    )
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
      style={{
        marginTop: 12, border: `2px dashed ${dragOver ? 'var(--amber-600)' : 'var(--border-primary)'}`,
        borderRadius: 8, padding: 16, textAlign: 'center', cursor: 'pointer',
        background: dragOver ? 'rgba(212,168,67,0.05)' : 'transparent', transition: 'all 150ms',
      }}
    >
      <Upload size={16} style={{ color: 'var(--text-tertiary)', marginBottom: 4 }} />
      <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Arrastra archivo o haz clic</div>
      <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
    </div>
  )
}

export function DocumentosView() {
  const [companyDocs, setCompanyDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Todos')
  const [uploaded, setUploaded] = useState<Record<string, { name: string; time: string }>>({})

  useEffect(() => {
    supabase.from('company_documents').select('*').limit(100)
      .then(({ data }) => { setCompanyDocs(data || []); setLoading(false) })
      .then(undefined, () => setLoading(false))
  }, [])

  const filtered = filter === 'Todos' ? LEGAL_DOCS : LEGAL_DOCS.filter(d => d.category === filter)
  const requiredDocs = LEGAL_DOCS.filter(d => d.required)
  const completedRequired = requiredDocs.filter(d => companyDocs.some(cd => cd.tipo_documento?.toLowerCase().includes(d.id.toLowerCase())) || uploaded[d.id]).length
  const withExpiry = LEGAL_DOCS.filter(d => (d as any).expiry).length

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="pg-title">Documentos Legales</h1>
        <p className="pg-meta">{CLIENT_NAME} &middot; Documentos corporativos y de cumplimiento</p>
      </div>

      {/* Category filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['Todos', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{
            background: filter === cat ? 'var(--amber-600)' : 'var(--bg-elevated)',
            border: 'none', borderRadius: 20, padding: '6px 16px', cursor: 'pointer',
            color: filter === cat ? '#000' : 'var(--amber-700)',
            fontSize: 14, fontWeight: filter === cat ? 600 : 400, fontFamily: 'var(--font-sans)',
            transition: 'all 150ms',
          }}>{cat}</button>
        ))}
      </div>

      {/* KPI row with progress ring */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Requeridos with ring */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <ProgressRing completed={completedRequired} total={requiredDocs.length} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber-700)' }}>Requeridos</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{completedRequired} de {requiredDocs.length} completos</div>
          </div>
        </div>
        {/* Con vencimiento */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 24, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span className="mono" style={{ fontSize: 32, fontWeight: 600, color: withExpiry > 0 ? 'var(--status-yellow)' : 'var(--status-green)' }}>{withExpiry}</span>
            {withExpiry > 0 && <AlertTriangle size={18} style={{ color: 'var(--status-yellow)' }} />}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber-700)', marginTop: 4 }}>Con Vencimiento</div>
        </div>
        {/* En sistema */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 24, textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)' }}>{companyDocs.length}</div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber-700)', marginTop: 4 }}>En Sistema</div>
        </div>
      </div>

      {/* Document cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {filtered.map(doc => {
          const expiryStatus = getExpiryStatus((doc as any).expiry)
          const inSystem = companyDocs.some(d => d.tipo_documento?.toLowerCase().includes(doc.id.toLowerCase()))
          const up = uploaded[doc.id]
          const isComplete = inSystem || !!up

          return (
            <div key={doc.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: 24 }}>
              {/* Top row: name + status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{doc.label}</span>
                    {doc.required && <span style={{ background: 'var(--amber-600)', color: '#000', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>REQ</span>}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--amber-700)' }}>{doc.desc}</div>
                </div>
                {/* Status badge */}
                {isComplete ? (
                  <span style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--status-green)', borderRadius: 4, padding: '4px 8px', fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                    {up ? 'Recibido' : expiryStatus?.label === 'Vigente' ? 'Vigente' : 'En sistema'}
                  </span>
                ) : (
                  <span style={{ background: 'rgba(234,179,8,0.15)', color: 'var(--status-yellow)', borderRadius: 4, padding: '4px 8px', fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>Pendiente</span>
                )}
              </div>

              {/* Metadata row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>🔄 {doc.renew}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {expiryStatus && <span style={{ background: expiryStatus.bg, color: expiryStatus.color, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{expiryStatus.label}</span>}
                  <span style={{ background: 'var(--bg-elevated)', borderRadius: 4, padding: '2px 8px', fontSize: 12, color: 'var(--text-tertiary)' }}>{doc.category}</span>
                </div>
              </div>

              {/* Upload result or upload zone */}
              {up ? (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'rgba(34,197,94,0.05)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.15)' }}>
                  <CheckCircle size={16} style={{ color: 'var(--status-green)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--amber-700)' }}>{up.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{up.time}</div>
                  </div>
                </div>
              ) : !isComplete ? (
                <UploadZone docId={doc.id} onUploaded={(name) => setUploaded(prev => ({ ...prev, [doc.id]: { name, time: new Date().toLocaleString('es-MX') } }))} />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
