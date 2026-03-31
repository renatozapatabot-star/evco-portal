'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GOLD, GOLD_GRADIENT, RED } from '@/lib/design-system'

const T = {
  bg: '#0D0D0D', surface: '#161616', border: '#2A2A2A',
  text: '#E8E6E0', textSub: '#9C9690', textMuted: '#666',
  gold: GOLD, goldBg: 'rgba(201,168,76,0.1)',
  red: RED, redBg: 'rgba(220,38,38,0.1)',
  shadow: '0 4px 24px rgba(0,0,0,0.4)',
}

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<{ role: string; name: string } | null>(null)
  const router = useRouter()

  // Check if already authenticated
  useState(() => {
    if (typeof document === 'undefined') return
    const authMatch = document.cookie.match(/(^| )portal_auth=([^;]+)/)
    const roleMatch = document.cookie.match(/(^| )user_role=([^;]+)/)
    const nameMatch = document.cookie.match(/(^| )company_name=([^;]+)/)
    if (authMatch && authMatch[2] === 'authenticated' && roleMatch) {
      setSession({
        role: roleMatch[2],
        name: nameMatch ? decodeURIComponent(nameMatch[2]) : '',
      })
    }
  })

  function getHomeRoute(role: string): string {
    if (role === 'broker') return '/broker'
    if (role === 'admin') return '/admin'
    return '/'
  }

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
        const data = await res.json()
        router.push(getHomeRoute(data.role))
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

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
      fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: '#CC1B2F', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 8px 32px rgba(204, 27, 47, 0.25)',
          }}>
            <span style={{
              color: '#FFF', fontWeight: 900, fontSize: 32,
              fontFamily: 'var(--font-geist-sans)',
              letterSpacing: '-0.02em',
            }}>Z</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.01em' }}>CRUZ</div>
          <div style={{
            fontSize: 12, color: T.textMuted, marginTop: 4,
            letterSpacing: '0.06em', textTransform: 'uppercase' as const,
          }}>Renato Zapata &amp; Company &middot; Patente 3596</div>
        </div>

        {/* Active session banner */}
        {session && (
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 16, padding: '20px 28px', marginBottom: 16,
            boxShadow: T.shadow,
          }}>
            <div style={{ fontSize: 13, color: T.textSub, marginBottom: 8 }}>Sesion activa</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>
              {session.name || session.role}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
              {session.role === 'broker' ? 'Operador interno' : session.role === 'admin' ? 'Administrador' : 'Cliente'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href={getHomeRoute(session.role)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 40, borderRadius: 8, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', color: '#1A1710',
                background: GOLD_GRADIENT,
              }}>
                Ir al portal
              </a>
              <a href="/api/auth/logout" style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 40, borderRadius: 8, fontSize: 13, fontWeight: 600,
                textDecoration: 'none',
                color: T.textSub, border: `1px solid ${T.border}`,
              }}>
                Cambiar cuenta
              </a>
            </div>
          </div>
        )}

        <div style={{ background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: '32px 28px', boxShadow: T.shadow }}>
          <h2 style={{ color: T.text, fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>
            {session ? 'Ingresar con otra cuenta' : 'Acceso al Portal'}
          </h2>
          <p style={{ color: T.textMuted, fontSize: 13, margin: '0 0 24px' }}>
            Ingresa tu contraseña para continuar
          </p>

          {error && (
            <div style={{ background: T.redBg, border: `1px solid ${T.red}30`,
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              color: T.red, fontSize: 13 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: T.textSub, fontSize: 12,
                fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em' }}>
                CONTRASEÑA
              </label>
              <input type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="************"
                required autoFocus
                style={{ width: '100%', height: 42, border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: '0 14px', fontSize: 14,
                  background: T.bg, color: T.text, outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <button type="submit" disabled={loading || !password}
              style={{ width: '100%', height: 42,
                background: loading || !password ? '#333' : GOLD_GRADIENT,
                border: 'none', borderRadius: 8, color: loading || !password ? '#666' : '#1A1710',
                fontSize: 14, fontWeight: 700, cursor: loading || !password ? 'default' : 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.02em' }}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: T.textMuted, fontSize: 11, marginTop: 20 }}>
          Problemas de acceso? Contacta ai@renatozapata.com
        </p>
        <p style={{ textAlign: 'center', color: T.textMuted, fontSize: 10, marginTop: 8 }}>
          CRUZ Intelligence Platform &middot; Patente 3596 &middot; Aduana 240
        </p>
      </div>
    </div>
  )
}
