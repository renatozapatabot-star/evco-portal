'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { GOLD, GOLD_GRADIENT } from '@/lib/design-system'

export default function UploadPage() {
  const { token } = useParams<{ token: string }>()
  const [info, setInfo] = useState<any>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/upload-token?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setInfo(data)
      })
      .catch(() => setError('Error de conexión'))
  }, [token])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length || !info) return
    setUploading(true)

    for (const file of Array.from(files)) {
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
        }
      } catch {}
    }
    setUploading(false)
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-geist-sans)', color: '#E8E6E0' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{error === 'expired' ? 'Link Expirado' : error === 'not_found' ? 'Link No Válido' : 'Error'}</div>
          <div style={{ color: '#666', fontSize: 14 }}>Contacta a Renato Zapata & Company para un nuevo link de subida.</div>
        </div>
      </div>
    )
  }

  if (!info) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #2A2A2A', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-geist-sans)', color: '#E8E6E0', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, background: GOLD_GRADIENT, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20, fontWeight: 900, color: '#1A1710', fontFamily: 'Georgia, serif' }}>Z</div>
          <div style={{ fontSize: 13, color: '#666' }}>Renato Zapata & Company</div>
        </div>

        <div style={{ background: '#161616', border: '1px solid #2A2A2A', borderRadius: 16, padding: '24px 20px' }}>
          <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Tráfico</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, fontFamily: 'var(--font-jetbrains-mono)' }}>{info.trafico_id}</div>

          {info.required_docs?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#9C9690', fontWeight: 600, marginBottom: 8 }}>Documentos requeridos:</div>
              {info.required_docs.map((doc: string) => (
                <div key={doc} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  {uploaded.some(u => u.toLowerCase().includes(doc.toLowerCase())) ? (
                    <span style={{ color: '#16A34A' }}>✅</span>
                  ) : (
                    <span style={{ color: '#666' }}>☐</span>
                  )}
                  {doc}
                </div>
              ))}
            </div>
          )}

          {uploaded.length > 0 && (
            <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#16A34A' }}>
              ✅ {uploaded.length} documento(s) subido(s)
            </div>
          )}

          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px', background: GOLD_GRADIENT,
            borderRadius: 10, cursor: uploading ? 'wait' : 'pointer', fontSize: 15, fontWeight: 700, color: '#1A1710'
          }}>
            {uploading ? 'Subiendo...' : '📁 Subir Archivos'}
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xml" onChange={handleUpload} style={{ display: 'none' }} />
          </label>

          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#666' }}>
            PDF, JPG, PNG, DOC, XML &middot; Máx 10MB por archivo
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#666' }}>
          Link válido por 72 horas &middot; CRUZ Intelligence Platform
        </div>
      </div>
    </div>
  )
}
