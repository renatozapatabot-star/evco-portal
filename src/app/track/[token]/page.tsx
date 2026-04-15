'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { GOLD } from '@/lib/design-system'
import { fmtDate } from '@/lib/format-utils'

type Step = {
  key: string
  label: string
  done: boolean
  active?: boolean
}

type TrackingData = {
  reference: string
  description: string | null
  carrier: string | null
  status: string
  statusLabel: string
  estimatedDelivery: string | null
  steps: Step[]
  lastUpdated: string | null
}

// Track page uses dark theme intentionally — external-facing, not part of portal shell
const DARK = 'var(--navy-900, #0F0F0D)'
const SURFACE = 'var(--navy-800, #1A1A17)'
const MUTED = 'var(--text-muted, #6B6B5E)'
const WHITE = 'var(--bg-primary, #F5F5F0)'

const STATUS_COLORS: Record<string, string> = {
  IN_TRANSIT: 'var(--info-500)',
  CUSTOMS_CLEARANCE: 'var(--warning-500)',
  AT_BORDER: 'var(--warning-500)',
  CLEARED: 'var(--status-green)',
  DELIVERED: 'var(--status-green)',
}

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  return fmtDate(iso)
}

export default function TrackingPage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<TrackingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    fetch(`/api/tracking/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Error al cargar rastreo')
        }
        return res.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: DARK, color: WHITE, fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)' }}>
      {/* Header */}
      <header style={{
        padding: '20px 24px',
        borderBottom: `1px solid ${SURFACE}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${GOLD}, var(--gold-700))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--aguila-fs-section)', fontWeight: 800, color: DARK,
          }}>C</div>
          <div>
            <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, letterSpacing: '0.05em' }}>ZAPATA AI Tracking</div>
            <div style={{ fontSize: 'var(--aguila-fs-meta)', color: MUTED }}>Renato Zapata & Company</div>
          </div>
        </div>
        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: MUTED }}>
          Patente 3596
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px 80px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{
              width: 40, height: 40, border: `3px solid ${SURFACE}`,
              borderTopColor: GOLD, borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <div style={{ fontSize: 'var(--aguila-fs-body)', color: MUTED }}>Cargando rastreo...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {error && (
          <div style={{
            textAlign: 'center', padding: '80px 20px',
          }}>
            <div style={{ fontSize: 'var(--aguila-fs-kpi-hero)', marginBottom: 16 }}>&#128722;</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Enlace no disponible</div>
            <div style={{ fontSize: 'var(--aguila-fs-body)', color: MUTED, lineHeight: 1.6 }}>{error}</div>
          </div>
        )}

        {data && (
          <>
            {/* Reference & Status */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                Referencia
              </div>
              <div style={{ fontSize: 'var(--aguila-fs-title)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>
                {data.reference}
              </div>
              <div style={{
                display: 'inline-block',
                padding: '6px 16px',
                borderRadius: 20,
                fontSize: 'var(--aguila-fs-body)',
                fontWeight: 700,
                backgroundColor: STATUS_COLORS[data.status] || MUTED,
                color: 'rgba(255,255,255,0.045)',
              }}>
                {data.statusLabel}
              </div>
            </div>

            {/* Info Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
              {data.description && (
                <div style={{
                  gridColumn: '1 / -1',
                  padding: '14px 16px',
                  backgroundColor: SURFACE,
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: MUTED, marginBottom: 4 }}>Mercancía</div>
                  <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600 }}>{data.description}</div>
                </div>
              )}
              <div style={{
                padding: '14px 16px',
                backgroundColor: SURFACE,
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: MUTED, marginBottom: 4 }}>Entrega Estimada</div>
                <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: GOLD, fontFamily: 'var(--font-jetbrains-mono)' }}>
                  {data.status === 'DELIVERED' ? 'Entregado' : formatDate(data.estimatedDelivery)}
                </div>
              </div>
              {data.carrier && (
                <div style={{
                  padding: '14px 16px',
                  backgroundColor: SURFACE,
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: MUTED, marginBottom: 4 }}>Transportista</div>
                  <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600 }}>{data.carrier}</div>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                Progreso
              </div>
              <div style={{ position: 'relative', paddingLeft: 28 }}>
                {data.steps.map((step, i) => {
                  const isLast = i === data.steps.length - 1
                  const iconChar = step.done ? '\u2705' : step.active ? '\u23F3' : '\u26AA'
                  return (
                    <div key={step.key} style={{ position: 'relative', paddingBottom: isLast ? 0 : 28 }}>
                      {/* Connecting line */}
                      {!isLast && (
                        <div style={{
                          position: 'absolute',
                          left: -18,
                          top: 24,
                          bottom: 0,
                          width: 2,
                          backgroundColor: step.done ? GOLD : SURFACE,
                        }} />
                      )}
                      {/* Icon */}
                      <div style={{
                        position: 'absolute',
                        left: -28,
                        top: 0,
                        fontSize: 'var(--aguila-fs-kpi-small)',
                        lineHeight: '24px',
                      }}>
                        {iconChar}
                      </div>
                      {/* Label */}
                      <div style={{
                        fontSize: 'var(--aguila-fs-section)',
                        fontWeight: step.done || step.active ? 700 : 400,
                        color: step.done ? WHITE : step.active ? GOLD : MUTED,
                        lineHeight: '24px',
                      }}>
                        {step.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Last updated */}
            {data.lastUpdated && (
              <div style={{ fontSize: 'var(--aguila-fs-meta)', color: MUTED, textAlign: 'center' }}>
                Ultima actualizacion: <span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{formatDate(data.lastUpdated)}</span>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '14px 20px',
        backgroundColor: DARK,
        borderTop: `1px solid ${SURFACE}`,
        textAlign: 'center',
        fontSize: 'var(--aguila-fs-meta)',
        color: MUTED,
        lineHeight: 1.6,
      }}>
        Para detalles contacte a su agente aduanal &middot;{' '}
        <a href="mailto:ai@renatozapata.com" style={{ color: GOLD, textDecoration: 'none' }}>
          ai@renatozapata.com
        </a>
      </footer>
    </div>
  )
}
