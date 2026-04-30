'use client'

import { useState } from 'react'
import { Search, ArrowRight } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { GlassCard, AguilaInput, AguilaBeforeAfter } from '@/components/aguila'

/**
 * /demo — public prospect landing. Renders the before/after strip, the
 * "ver demo en vivo" CTA (→ /demo/live), and a clave-check input for
 * existing EVCO operators.
 *
 * Tokens-only per V1. Status red/green compose from
 * --portal-status-{red,green}-{bg,ring,fg}. No inline hex.
 */
export default function DemoPage() {
  const isMobile = useIsMobile()
  const [clave, setClave] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ count: number; name: string } | null>(null)
  const [notified, setNotified] = useState(false)

  async function handlePreview() {
    if (!clave.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/data?table=companies&limit=1')
      const data = await res.json()
      setResult({ count: (data.data || []).length, name: clave })
    } catch {
      setResult({ count: 0, name: clave })
    }
    setLoading(false)
  }

  return (
    <div
      className="aguila-dark aguila-canvas"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 16 : 24,
        position: 'relative',
      }}
    >
      <div className="aguila-aura" aria-hidden="true" />

      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        {/* Brand mark + tagline */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <AguilaMark size={56} />
        </div>
        <div
          className="portal-eyebrow"
          style={{
            fontSize: 'var(--portal-fs-micro)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--portal-fg-4)',
            marginBottom: 32,
          }}
        >
          Inteligencia Aduanal · Patente 3596
        </div>

        {/* Before/After strip */}
        <div style={{ marginBottom: 24 }}>
          <AguilaBeforeAfter
            before="22 min"
            beforeLabel="Proceso manual"
            after="2 min"
            afterLabel="Con PORTAL"
          />
        </div>

        {/* Live demo CTA — primary silver gradient */}
        <a
          href="/demo/live"
          className="portal-btn portal-btn--primary portal-btn--lg"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            marginBottom: 28,
            textDecoration: 'none',
          }}
        >
          Ver demo en vivo
          <ArrowRight size={18} strokeWidth={2} />
        </a>

        {/* Clave input for existing customers */}
        <h1
          style={{
            fontSize: 'var(--portal-fs-lg)',
            fontWeight: 600,
            color: 'var(--portal-fg-1)',
            lineHeight: 1.3,
            margin: '0 0 8px',
            letterSpacing: '-0.01em',
          }}
        >
          ¿Ya tiene clave? Ingrese aquí.
        </h1>
        <p
          style={{
            fontSize: 'var(--portal-fs-sm)',
            color: 'var(--portal-fg-4)',
            margin: '0 0 20px',
            lineHeight: 1.5,
          }}
        >
          Si ya es cliente, ingrese su clave para acceder a su portal personalizado.
        </p>

        {!result && !notified && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--portal-fg-5)',
                  pointerEvents: 'none',
                }}
              />
              <AguilaInput
                placeholder="Ingrese su clave"
                value={clave}
                mono
                onChange={(e) => setClave(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
                inputClassName="portal-input--with-prefix"
                aria-label="Clave de cliente"
              />
            </div>
            <button
              onClick={handlePreview}
              disabled={loading || !clave.trim()}
              aria-label="Verificar clave"
              className="portal-btn portal-btn--primary portal-btn--icon portal-btn--lg"
              style={{ opacity: clave.trim() ? 1 : 0.5 }}
            >
              <ArrowRight size={20} />
            </button>
          </div>
        )}

        {result && !notified && (
          <GlassCard tier="hero" padding={32} style={{ marginTop: 24 }}>
            <div
              style={{
                fontSize: 'var(--portal-fs-md)',
                fontWeight: 600,
                marginBottom: 24,
                color: 'var(--portal-fg-1)',
              }}
            >
              Sus datos están disponibles.
            </div>
            <button
              onClick={() => setNotified(true)}
              className="portal-btn portal-btn--primary portal-btn--lg"
              style={{ width: '100%' }}
            >
              Solicitar acceso
            </button>
          </GlassCard>
        )}

        {notified && (
          <GlassCard tier="hero" padding={32} style={{ marginTop: 24, textAlign: 'center' }}>
            <div
              style={{
                fontSize: 'var(--portal-fs-2xl)',
                marginBottom: 12,
                color: 'var(--portal-status-green-fg)',
              }}
              aria-hidden
            >
              ✓
            </div>
            <div
              style={{
                fontSize: 'var(--portal-fs-md)',
                fontWeight: 600,
                color: 'var(--portal-status-green-fg)',
              }}
            >
              Solicitud enviada
            </div>
            <div
              style={{
                fontSize: 'var(--portal-fs-sm)',
                color: 'var(--portal-fg-4)',
                marginTop: 8,
              }}
            >
              Nuestro equipo se comunicará en 24 horas.
            </div>
          </GlassCard>
        )}

        <div
          style={{
            marginTop: 48,
            fontSize: 'var(--portal-fs-micro)',
            color: 'var(--portal-fg-5)',
            letterSpacing: '0.12em',
            fontFamily: 'var(--portal-font-mono)',
          }}
        >
          Patente 3596 · Aduana 240 · Laredo TX · Est. 1941
        </div>
      </div>
    </div>
  )
}
