'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
const MAX_SIZE = 25 * 1024 * 1024

interface UploadInfo {
  trafico_id: string
  company_id: string
  required_docs: string[]
  docs_received: string[]
}

export default function UploadPage() {
  const { token } = useParams<{ token: string }>()
  const [info, setInfo] = useState<UploadInfo | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string[]>([])
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [complete, setComplete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/upload-token?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else {
          setInfo(data)
          setUploaded(data.docs_received || [])
        }
      })
      .catch(() => setError('Error de conexión'))
  }, [token])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length || !info) return

    // Validate files client-side
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`Tipo no permitido: ${file.name}. Solo PDF, JPG, PNG, XLSX.`)
        return
      }
      if (file.size > MAX_SIZE) {
        setError(`${file.name} excede 25MB.`)
        return
      }
    }

    setUploading(true)
    setError('')

    for (const file of Array.from(files)) {
      setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
      const formData = new FormData()
      formData.append('file', file)
      formData.append('token', token)
      formData.append('trafico_id', info.trafico_id)
      formData.append('company_id', info.company_id)

      try {
        const res = await fetch('/api/upload-token', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.success) {
          setUploaded(prev => [...prev, file.name])
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
        } else {
          setError(`Error al subir ${file.name}. Reintentar →`)
        }
      } catch {
        setError(`Error al subir ${file.name}. Reintentar →`)
      }
    }
    setUploading(false)

    // Check if all required docs uploaded
    if (info.required_docs.length > 0) {
      const allDone = info.required_docs.every(doc =>
        [...uploaded, ...Array.from(files).map(f => f.name)].some(u =>
          u.toLowerCase().includes(doc.toLowerCase())
        )
      )
      if (allDone) setComplete(true)
    }
  }

  // Error states
  if (error && !info) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--navy-900)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        padding: 20,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <span style={{
            fontSize: 44, fontWeight: 800, color: 'var(--gold)',
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          }}>Z</span>
          <div style={{ fontSize: 11, color: '#64748B', letterSpacing: '0.2em', marginTop: 4 }}>CRUZ</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#CBD5E1', marginTop: 24, marginBottom: 8 }}>
            {error === 'expired' ? 'Enlace expirado' : error === 'not_found' ? 'Enlace no válido' : 'Error'}
          </div>
          <div style={{ color: '#64748B', fontSize: 14, marginBottom: 8 }}>
            Contacta a Renato Zapata &amp; Company para un nuevo enlace.
          </div>
          <div style={{ color: '#64748B', fontSize: 14 }}>
            Contacto: ai@renatozapata.com
          </div>
        </div>
      </div>
    )
  }

  // Loading
  if (!info) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--navy-900)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: '50%' }} />
      </div>
    )
  }

  // Completion state
  if (complete) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--navy-900)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        padding: 20,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(34, 197, 94, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 32,
          }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#CBD5E1', marginBottom: 8 }}>
            Expediente completo
          </div>
          <div style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>
            Todos los documentos solicitados han sido recibidos. Gracias.
          </div>

          {/* Referral prompt */}
          <div style={{ padding: '16px 20px', background: 'rgba(196,150,60,0.08)', border: '1px solid rgba(196,150,60,0.2)', borderRadius: 12, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>
              ¿Trabaja con otros importadores en México?
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>
              CRUZ puede simplificar su proceso con todos ellos.
            </div>
            <ReferralForm />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--navy-900)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{
            fontSize: 44, fontWeight: 800, color: 'var(--gold)',
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          }}>Z</span>
          <div style={{ fontSize: 11, color: '#64748B', letterSpacing: '0.2em', marginTop: 4 }}>CRUZ</div>
        </div>

        {/* Upload card */}
        <div style={{
          background: 'var(--card-bg)', borderRadius: 16, padding: '28px 24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Documentos solicitados para
          </div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: 'var(--navy-900)', marginBottom: 4,
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          }}>
            Tráfico {info.trafico_id}
          </div>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
            {info.company_id}
          </div>

          {/* Required docs checklist */}
          {info.required_docs?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {info.required_docs.map((doc: string) => {
                const isDone = uploaded.some(u => u.toLowerCase().includes(doc.toLowerCase()))
                return (
                  <div key={doc} style={{
                    padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 14, color: isDone ? 'var(--success)' : '#475569',
                    borderBottom: '1px solid #E2E8F0',
                  }}>
                    <span style={{ fontSize: 16 }}>{isDone ? '✅' : '☐'}</span>
                    <span style={{ fontWeight: isDone ? 600 : 400 }}>{doc}</span>
                    {isDone && <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' }}>Recibido</span>}
                  </div>
                )
              })}
            </div>
          )}

          {/* Error inline */}
          {error && (
            <div className="shake-error" style={{
              background: 'rgba(214, 69, 69, 0.08)', border: '1px solid rgba(214, 69, 69, 0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: 13, color: 'var(--danger-text)',
            }}>
              {error}
            </div>
          )}

          {/* Upload counts */}
          {uploaded.length > 0 && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: 13, color: 'var(--success)', fontWeight: 600,
            }}>
              ✅ {uploaded.length} documento{uploaded.length !== 1 ? 's' : ''} recibido{uploaded.length !== 1 ? 's' : ''}
            </div>
          )}

          {/* Upload button */}
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px', background: uploading ? '#E2E8F0' : 'var(--gold)',
            borderRadius: 10, cursor: uploading ? 'wait' : 'pointer',
            fontSize: 15, fontWeight: 700, color: uploading ? '#94A3B8' : 'var(--navy-900)',
            transition: 'background 150ms',
          }}>
            {uploading ? 'Subiendo...' : 'Subir documentos'}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.xlsx"
              onChange={handleUpload}
              style={{ display: 'none' }}
            />
          </label>

          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#94A3B8' }}>
            PDF, JPG, PNG, XLSX · Máx 25MB por archivo
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#475569' }}>
          Enlace válido por 48 horas · Renato Zapata &amp; Company
        </div>
      </div>
    </div>
  )
}

function ReferralForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  async function submit() {
    if (!name.trim()) return
    await fetch('/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'supplier_referral', name, email, source: 'upload_portal' }),
    }).catch((err) => console.error('[upload] referral submit:', err.message))
    setSent(true)
  }

  if (sent) return <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>✅ Gracias por la recomendación</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la empresa"
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(196,150,60,0.3)', background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', fontSize: 13, outline: 'none' }} />
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email de contacto (opcional)"
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(196,150,60,0.3)', background: 'rgba(255,255,255,0.05)', color: '#E2E8F0', fontSize: 13, outline: 'none' }} />
      <button onClick={submit} disabled={!name.trim()}
        style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: name.trim() ? 'var(--gold)' : 'var(--text-primary)', color: name.trim() ? 'var(--text-primary)' : '#6B7280', fontSize: 13, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'default' }}>
        Recomendar
      </button>
    </div>
  )
}
