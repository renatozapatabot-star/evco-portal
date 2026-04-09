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

const DOC_LABELS: Record<string, string> = {
  FACTURA: 'Factura Comercial',
  COVE: 'COVE',
  PEDIMENTO: 'Pedimento',
  LISTA_EMPAQUE: 'Lista de Empaque',
  CERTIFICADO_ORIGEN: 'Certificado de Origen',
  CARTA_PORTE: 'Carta Porte',
}

export default function ProveedorPage() {
  const { token } = useParams<{ token: string }>()
  const [info, setInfo] = useState<UploadInfo | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string[]>([])
  const [complete, setComplete] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/upload-token?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setInfo(data)
      })
      .catch(() => setError('No se pudo cargar la información.'))
  }, [token])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const results: string[] = []

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`Tipo no permitido: ${file.name}. Use PDF, JPG, PNG o XLSX.`)
        continue
      }
      if (file.size > MAX_SIZE) {
        setError(`${file.name} excede 25MB.`)
        continue
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('token', token)

      try {
        const res = await fetch('/api/upload-token', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.success) results.push(file.name)
        else setError(data.error || 'Error al subir.')
      } catch {
        setError('Error de conexión.')
      }
    }

    setUploaded(prev => [...prev, ...results])
    if (results.length > 0) {
      setComplete(true)
      setShowReferral(true)
    }
    setUploading(false)
  }

  // Error state
  const errorMessage = error === 'not_found' || error === 'expired'
    ? 'Enlace no válido o expirado. Por favor solicita un enlace nuevo a tu agente aduanal: ai@renatozapata.com'
    : error

  if (error && !info) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>CRUZ</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#DC2626', marginBottom: 12 }}>Enlace no válido</div>
          <p style={{ fontSize: 14, color: '#6B6B6B', lineHeight: 1.6 }}>{errorMessage}</p>
        </div>
      </div>
    )
  }

  // Loading
  if (!info) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>CRUZ</div>
          <div className="skeleton-shimmer" style={{ height: 120, borderRadius: 8 }} />
        </div>
      </div>
    )
  }

  const remaining = (info.required_docs || []).filter(d => !info.docs_received?.includes(d) && !uploaded.some(u => u.toLowerCase().includes(d.toLowerCase())))

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={styles.logo}>CRUZ</div>
          <div style={{ fontSize: 11, color: '#9B9B9B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Portal de Documentos
          </div>
        </div>

        {!complete ? (
          <>
            {/* Request info */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#6B6B6B', marginBottom: 4 }}>Solicitud de</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>{info.company_id}</div>
            </div>

            {/* Required docs */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#6B6B6B', marginBottom: 8 }}>Documentos requeridos:</div>
              {remaining.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {remaining.map(doc => (
                    <div key={doc} style={{
                      padding: '10px 14px', borderRadius: 8,
                      background: '#FAFAF8', border: '1px solid #E8E5E0',
                      fontSize: 14, color: '#1A1A1A',
                    }}>
                      📄 {DOC_LABELS[doc] || doc}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 14, color: '#16A34A', fontWeight: 600 }}>
                  ✅ Todos los documentos recibidos
                </div>
              )}
            </div>

            {/* Tráfico reference */}
            <div style={{
              fontSize: 12, color: '#9B9B9B', marginBottom: 20,
              fontFamily: 'monospace',
            }}>
              Tráfico: {info.trafico_id}
            </div>

            {/* Upload area */}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx"
              multiple
              onChange={handleUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                width: '100%', padding: '16px 24px', borderRadius: 12,
                background: '#C9A84C', color: '#FFFFFF', border: 'none',
                fontSize: 16, fontWeight: 700, cursor: uploading ? 'wait' : 'pointer',
                minHeight: 56, opacity: uploading ? 0.7 : 1,
              }}
            >
              {uploading ? 'Subiendo...' : '📎 Subir documento'}
            </button>

            <p style={{ fontSize: 11, color: '#9B9B9B', textAlign: 'center', marginTop: 8 }}>
              PDF, JPG, PNG o XLSX · máximo 25MB
            </p>

            {/* Already uploaded */}
            {uploaded.length > 0 && (
              <div style={{ marginTop: 16 }}>
                {uploaded.map(f => (
                  <div key={f} style={{ fontSize: 13, color: '#16A34A', padding: '4px 0' }}>
                    ✅ {f}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#DC2626' }}>
                {error}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Success state */}
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
                Documento recibido
              </div>
              <p style={{ fontSize: 14, color: '#6B6B6B', marginBottom: 4 }}>
                {info.company_id} será notificado automáticamente.
              </p>
              <p style={{ fontSize: 13, color: '#9B9B9B' }}>
                Gracias por su pronta respuesta. 🦀
              </p>
            </div>

            {/* Upload more button */}
            {remaining.length > 0 && (
              <button
                onClick={() => { setComplete(false); setShowReferral(false) }}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10,
                  background: 'transparent', border: '1px solid #E8E5E0',
                  fontSize: 14, fontWeight: 600, color: '#6B6B6B',
                  cursor: 'pointer', marginBottom: 16, minHeight: 48,
                }}
              >
                Subir otro documento ({remaining.length} pendiente{remaining.length !== 1 ? 's' : ''})
              </button>
            )}

            {/* Referral CTA */}
            {showReferral && (
              <div style={{
                marginTop: 16, padding: '16px 20px', borderRadius: 12,
                background: 'rgba(196,150,60,0.04)',
                border: '1px solid rgba(196,150,60,0.15)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>
                  ¿Trabaja con otros importadores en México?
                </div>
                <p style={{ fontSize: 13, color: '#6B6B6B', marginBottom: 12, lineHeight: 1.5 }}>
                  CRUZ organiza todos sus documentos automáticamente.
                  Sus clientes reciben todo a tiempo, sin llamadas ni correos.
                </p>
                <a
                  href={`https://evco-portal.vercel.app/info-proveedores?ref=${token}`}
                  onClick={() => {
                    // Track referral click
                    fetch('/api/upload-token', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ token, action: 'referral_click' }),
                    }).catch((err) => console.error('[proveedor] referral click:', err.message))
                  }}
                  style={{
                    display: 'inline-block', padding: '10px 20px',
                    borderRadius: 8, background: '#C9A84C', color: '#FFFFFF',
                    fontSize: 13, fontWeight: 700, textDecoration: 'none',
                    minHeight: 40,
                  }}
                >
                  Más información →
                </a>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 32, paddingTop: 16, borderTop: '1px solid #E8E5E0' }}>
          <div style={{ fontSize: 11, color: '#9B9B9B' }}>
            CRUZ — Renato Zapata & Company
          </div>
          <div style={{ fontSize: 10, color: '#C4C4C4', marginTop: 2 }}>
            Patente 3596 · Aduana 240 · Est. 1941
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#FAFAF8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#FFFFFF',
    borderRadius: 16,
    padding: '32px 28px',
    border: '1px solid #E8E5E0',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  } as React.CSSProperties,
  logo: {
    fontSize: 24,
    fontWeight: 800,
    color: '#C9A84C',
    letterSpacing: '0.1em',
    marginBottom: 4,
  } as React.CSSProperties,
}
