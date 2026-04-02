'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCookieValue } from '@/lib/client-config'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<{ role: string; name: string } | null>(null)
  const [isNight, setIsNight] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const role = getCookieValue('user_role')
    if (role) {
      setSession({
        role,
        name: getCookieValue('company_name') ?? '',
      })
    }
    // Auto-dim check
    const h = new Date().getHours()
    setIsNight(h >= 22 || h < 6)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        const next = searchParams.get('next')
        router.push(next && next.startsWith('/') ? next : '/')
        router.refresh()
      } else {
        setError('Contraseña incorrecta. Contacta a Renato Zapata & Company.')
        setPassword('')
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    }
    setLoading(false)
  }

  // Night mode shifts card bg and text
  const cardBg = isNight ? 'var(--navy-800)' : '#FFFFFF'
  const cardText = isNight ? '#CBD5E1' : '#1A1A1A'
  const cardTextSub = isNight ? '#94A3B8' : '#6B6B6B'
  const cardTextMuted = isNight ? '#64748B' : '#9B9B9B'
  const inputBg = isNight ? '#0F1924' : '#FAFAF8'
  const borderColor = isNight ? '#2D3A4D' : '#E8E5E0'

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--navy-900)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'var(--font-sans, "DM Sans", system-ui, sans-serif)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Z watermark */}
      <div style={{
        position: 'absolute', bottom: -40, right: -40,
        fontSize: 280, fontWeight: 800,
        fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
        color: 'rgba(212,168,67,0.04)',
        lineHeight: 1, pointerEvents: 'none', userSelect: 'none',
      }}>
        Z
      </div>

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        {/* Active session banner */}
        {session && (
          <div style={{
            background: cardBg, border: `1px solid ${borderColor}`,
            borderRadius: 20, padding: '20px 28px', marginBottom: 16,
            boxShadow: '0 4px 24px rgba(11,22,35,0.12)',
          }}>
            <div style={{ fontSize: 13, color: cardTextSub, marginBottom: 8 }}>Sesión activa</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: cardText, marginBottom: 4 }}>
              {session.name || session.role}
            </div>
            <div style={{ fontSize: 12, color: cardTextMuted, marginBottom: 16 }}>
              {session.role === 'broker' ? 'Operador interno' : session.role === 'admin' ? 'Administrador' : 'Cliente'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href="/" style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 44, borderRadius: 8, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', color: 'var(--navy-900)', background: '#D4A843',
              }}>
                Ir al portal
              </a>
              <a href="/api/auth/logout" style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 44, borderRadius: 8, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', color: cardTextSub, border: `1px solid ${borderColor}`,
              }}>
                Cambiar cuenta
              </a>
            </div>
          </div>
        )}

        {/* Login card */}
        <div style={{
          background: cardBg, borderRadius: 20, padding: 40,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        }}>
          {/* Z mark */}
          <div style={{ textAlign: 'center' }}>
            <span style={{
              display: 'inline-block', fontSize: 44, fontWeight: 800,
              color: '#D4A843',
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            }}>
              Z
            </span>
          </div>

          {/* CRUZ label */}
          <div style={{
            textAlign: 'center', marginTop: 8,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.2em',
            textTransform: 'uppercase' as const, color: cardTextMuted,
          }}>
            CRUZ
          </div>

          {/* Divider */}
          <div style={{
            height: 1, background: borderColor, margin: '24px 0',
          }} />

          {/* Error */}
          {error && (
            <div className="shake-error" style={{
              display: 'flex', gap: 10, padding: '12px 14px',
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 10, marginBottom: 16, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#991B1B' }}>
                  {error}
                </div>
                <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>
                  <a href="https://wa.me/19565551234" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#B91C1C', textDecoration: 'underline', fontWeight: 600 }}>WhatsApp</a>
                  {' · '}
                  <a href="mailto:ai@renatozapata.com" style={{ color: '#B91C1C', textDecoration: 'underline', fontWeight: 600 }}>Email</a>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin}>
            {/* Email label */}
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              color: cardTextMuted, marginBottom: 6,
            }}>
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              style={{
                width: '100%', height: 44, border: `1.5px solid ${borderColor}`,
                borderRadius: 8, padding: '0 14px', fontSize: 16,
                background: inputBg, color: cardText, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#D4A843'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(212,168,67,0.2)' }}
              onBlur={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.boxShadow = 'none' }}
            />

            {/* Password label */}
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              color: cardTextMuted, marginTop: 16, marginBottom: 6,
            }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="············"
              required
              autoFocus
              style={{
                width: '100%', height: 44, border: `1.5px solid ${borderColor}`,
                borderRadius: 8, padding: '0 14px', fontSize: 16,
                background: inputBg, color: cardText, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#D4A843'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(212,168,67,0.2)' }}
              onBlur={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.boxShadow = 'none' }}
            />

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !password}
              style={{
                width: '100%', height: 44, marginTop: 24,
                background: loading || !password ? '#E8E5E0' : '#D4A843',
                border: 'none', borderRadius: 8,
                color: loading || !password ? '#9B9B9B' : 'var(--navy-900)',
                fontSize: 14, fontWeight: 700,
                cursor: loading || !password ? 'default' : 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.02em',
                opacity: loading ? 0.7 : 1,
                transition: 'background 150ms ease',
              }}
            >
              {loading ? 'Iniciando...' : 'Iniciar sesión →'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <a
                href="mailto:ai@renatozapata.com?subject=Recuperar%20acceso%20a%20CRUZ"
                style={{ fontSize: 12, color: cardTextMuted, textDecoration: 'none' }}
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          </form>

          {/* Bottom identity */}
          <div style={{
            marginTop: 32, paddingTop: 20,
            borderTop: `1px solid ${borderColor}`, textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: cardTextSub }}>
              Renato Zapata &amp; Company
            </div>
            <div style={{ fontSize: 11, color: cardTextMuted, marginTop: 4 }}>
              Patente 3596 · Aduana 240 · Est. 1941
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
