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
  const router = useRouter()

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
        if (data.role === 'admin') {
          router.push('/admin')
        } else {
          router.push('/')
        }
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

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: GOLD_GRADIENT,
            borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 24, fontWeight: 900, color: '#1A1710',
            fontFamily: 'Georgia, serif', boxShadow: '0 4px 12px rgba(201,168,76,0.3)' }}>Z</div>
          <h1 style={{ color: T.text, fontSize: 20, fontWeight: 700, margin: '0 0 4px',
            letterSpacing: '-0.01em' }}>CRUZ Intelligence Platform</h1>
          <p style={{ color: T.textMuted, fontSize: 13, margin: 0 }}>
            Renato Zapata &amp; Company &middot; Patente 3596
          </p>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: '32px 28px', boxShadow: T.shadow }}>
          <h2 style={{ color: T.text, fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>
            Acceso al Portal
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
          CRUZ Intelligence Platform &middot; 50 clients &middot; Aduana 240
        </p>
      </div>
    </div>
  )
}
