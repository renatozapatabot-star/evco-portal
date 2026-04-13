'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCookieValue } from '@/lib/client-config'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0A0A0C' }} />}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<{ role: string; name: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [entering, setEntering] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const role = getCookieValue('user_role')
    if (role) {
      setSession({ role, name: getCookieValue('company_name') ?? '' })
    }
    requestAnimationFrame(() => setMounted(true))
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
        setEntering(true)
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('cruz_just_entered', '1')
        const next = searchParams.get('next')
        await new Promise(resolve => setTimeout(resolve, 300))
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

  const roleLabel = session?.role === 'broker'
    ? 'Operador interno'
    : session?.role === 'admin'
      ? 'Administrador'
      : 'Cliente'

  return (
    <div className="login-page">
      {/* Topo hairline overlay */}
      <div className="login-topo" aria-hidden="true" />
      {/* Subtle radial silver glow */}
      <div className="login-glow" />
      {/* Ambient drifting aura behind eagle */}
      <div className="login-aura" aria-hidden="true" />

      <div
        className={`login-container${mounted && !entering ? ' is-entered' : ''}${entering ? ' is-exiting' : ''}`}
      >
        {/* Centered eagle */}
        <div className="login-eagle">
          <AguilaMark size={140} tone="silver" />
        </div>

        {/* Wordmark */}
        <div className="login-wordmark">
          <AguilaWordmark size={40} tone="silver" />
        </div>

        {/* Tagline */}
        <p className="login-tagline">TOTAL VISIBILIDAD. SIN FRONTERAS.</p>

        {/* Active session banner */}
        {session && (
          <div className="login-session-card">
            <p className="login-session-label">Sesión activa</p>
            <p className="login-session-name">{session.name || session.role}</p>
            <p className="login-session-role">{roleLabel}</p>
            <div className="login-session-actions">
              <Link href="/" className="login-btn-silver">Ir al portal</Link>
              <a href="/api/auth/logout" className="login-btn-outline">Cambiar cuenta</a>
            </div>
          </div>
        )}

        {/* Glass form card */}
        <div className="login-card">
          {error && (
            <div className="login-error shake-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="login-error-icon">
                <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zM8 11.5A.75.75 0 118 10a.75.75 0 010 1.5z" fill="#DC2626"/>
              </svg>
              <div>
                <p className="login-error-text">{error}</p>
                <p className="login-error-links">
                  <a href="https://wa.me/19565551234" target="_blank" rel="noopener noreferrer">WhatsApp</a>
                  {' · '}
                  <a href="mailto:ai@renatozapata.com">Email</a>
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form" noValidate>
            <div className="login-field">
              <label htmlFor="login-code" className="login-label">CÓDIGO DE ACCESO</label>
              <input
                id="login-code"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Código de acceso"
                required
                autoFocus
                className="login-input"
                autoComplete="off"
              />
            </div>

            <button type="submit" disabled={loading || !password} className="login-submit">
              <span>{loading ? 'Iniciando…' : 'Entrar'}</span>
              {!loading && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 8 }}>
                  <path d="M3 8h10m-4-4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {loading && <span className="login-spinner" />}
            </button>
          </form>
        </div>

        {/* Footer identity */}
        <p className="login-footer">Patente 3596 · Aduana 240 · Laredo TX · Est. 1941</p>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          min-height: 100dvh;
          background: #0A0A0C;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
          font-family: var(--font-sans);
          position: relative;
          overflow: hidden;
        }
        .login-topo {
          position: absolute;
          top: -10%;
          right: -10%;
          width: 70%;
          height: 70%;
          background-image: url('/brand/topo-hairline.svg');
          background-repeat: no-repeat;
          background-size: cover;
          background-position: top right;
          opacity: 0.15;
          pointer-events: none;
        }
        .login-glow {
          position: absolute;
          top: 30%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(192,197,206,0.10) 0%, transparent 70%);
          pointer-events: none;
        }
        .login-aura {
          position: absolute;
          top: 22%;
          left: 50%;
          width: 400px;
          height: 400px;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(192,197,206,0.08) 0%, transparent 65%);
          pointer-events: none;
          z-index: 0;
          will-change: transform;
          animation: auraDrift 12s ease-in-out infinite;
        }
        @keyframes auraDrift {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          25% { transform: translate(calc(-50% + 8px), calc(-50% - 6px)) scale(1.02); }
          50% { transform: translate(calc(-50% - 6px), calc(-50% + 8px)) scale(1.04); }
          75% { transform: translate(calc(-50% + 4px), calc(-50% + 4px)) scale(1.02); }
        }
        .login-container {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: opacity 500ms cubic-bezier(.2,0,0,1), transform 500ms cubic-bezier(.2,0,0,1);
        }
        .login-container.is-exiting {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }
        .login-eagle,
        .login-wordmark,
        .login-tagline,
        .login-session-card,
        .login-card,
        .login-footer {
          opacity: 0;
        }
        .login-container.is-entered .login-eagle {
          animation: aguilaRise 600ms cubic-bezier(.2,0,0,1) 0ms both;
        }
        .login-container.is-entered .login-wordmark {
          animation: aguilaRise 600ms cubic-bezier(.2,0,0,1) 180ms both;
        }
        .login-container.is-entered .login-tagline {
          animation: aguilaFade 500ms cubic-bezier(.2,0,0,1) 340ms both;
        }
        .login-container.is-entered .login-session-card,
        .login-container.is-entered .login-card {
          animation: aguilaRiseCard 600ms cubic-bezier(.2,0,0,1) 480ms both;
        }
        .login-container.is-entered .login-footer {
          animation: aguilaFade 500ms cubic-bezier(.2,0,0,1) 640ms both;
        }
        @keyframes aguilaRise {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes aguilaRiseCard {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes aguilaFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .login-eagle {
          margin-bottom: 16px;
          filter: drop-shadow(0 0 24px rgba(192,197,206,0.18));
        }
        .login-wordmark {
          margin-bottom: 12px;
        }
        .login-tagline {
          font-size: 10px;
          letter-spacing: 0.3em;
          color: #7A7E86;
          text-transform: uppercase;
          margin: 0 0 32px;
          text-align: center;
        }
        .login-session-card {
          width: 100%;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(192,197,206,0.18);
          border-radius: 20px 20px 0 0;
          padding: 20px 24px;
          margin-bottom: -1px;
        }
        .login-session-label { font-size: 11px; color: #7A7E86; margin-bottom: 6px; letter-spacing: 0.08em; text-transform: uppercase; }
        .login-session-name { font-size: 16px; font-weight: 600; color: #E8EAED; margin-bottom: 2px; }
        .login-session-role { font-size: 12px; color: #7A7E86; margin-bottom: 16px; }
        .login-session-actions { display: flex; gap: 10px; }
        .login-btn-silver {
          flex: 1; display: flex; align-items: center; justify-content: center;
          height: 60px; border-radius: 10px; font-size: 13px; font-weight: 600;
          text-decoration: none; color: #0A0A0C;
          background: linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%);
          transition: transform 100ms ease;
        }
        .login-btn-silver:hover { transform: translateY(-1px); }
        .login-btn-outline {
          flex: 1; display: flex; align-items: center; justify-content: center;
          height: 60px; border-radius: 10px; font-size: 13px; font-weight: 600;
          text-decoration: none; color: #C0C5CE;
          border: 1px solid rgba(192,197,206,0.18);
          background: rgba(0,0,0,0.4);
        }
        .login-btn-outline:hover { border-color: rgba(192,197,206,0.4); }

        .login-card {
          width: 100%;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 32px;
          border: 1px solid rgba(192,197,206,0.18);
          box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(192,197,206,0.08);
        }

        .login-error {
          display: flex; gap: 10px; padding: 12px 14px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
          border-radius: 10px; margin-bottom: 20px; align-items: flex-start;
        }
        .login-error-icon { flex-shrink: 0; margin-top: 1px; }
        .login-error-text { font-size: 13px; font-weight: 600; color: #FCA5A5; line-height: 1.4; }
        .login-error-links { font-size: 11px; color: #F87171; margin-top: 4px; }
        .login-error-links a { color: #F87171; text-decoration: underline; font-weight: 600; }

        .login-form { display: flex; flex-direction: column; }
        .login-field { margin-bottom: 16px; }
        .login-label {
          display: block; font-size: 10px; font-weight: 600;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: #7A7E86; margin-bottom: 8px;
        }
        .login-input {
          width: 100%; height: 60px;
          border: 1px solid rgba(192,197,206,0.18);
          border-radius: 10px; padding: 0 16px;
          font-size: 16px; background: rgba(0,0,0,0.4);
          color: #E8EAED; outline: none;
          font-family: inherit; box-sizing: border-box;
          transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
        }
        .login-input::placeholder {
          color: #9AA0A8;
          font-size: 15px;
          letter-spacing: 0.02em;
        }
        .login-input:focus {
          border-color: rgba(232,234,237,0.7);
          background: rgba(0,0,0,0.55);
          box-shadow: 0 0 0 3px rgba(192,197,206,0.18), 0 0 20px rgba(192,197,206,0.08);
        }

        .login-submit {
          width: 100%; height: 60px; margin-top: 8px;
          background: linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%);
          border: none; border-radius: 10px;
          color: #0A0A0C; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          letter-spacing: 0.05em; text-transform: uppercase;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 1px rgba(232,234,237,0.08), 0 8px 24px rgba(0,0,0,0.4);
          transition: all 220ms cubic-bezier(.2,0,0,1);
        }
        .login-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #F5F7FA 0%, #D8DCE3 50%, #8A8E96 100%);
          transform: translateY(-1px);
          box-shadow: 0 0 0 1px rgba(232,234,237,0.3), 0 12px 32px rgba(192,197,206,0.25), 0 0 24px rgba(192,197,206,0.2);
        }
        .login-submit:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
          box-shadow: 0 0 0 1px rgba(232,234,237,0.15), 0 4px 12px rgba(0,0,0,0.4);
        }
        .login-submit:disabled { opacity: 0.4; cursor: default; box-shadow: none; }

        .login-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(10,10,12,0.2);
          border-top-color: #0A0A0C;
          border-radius: 50%;
          animation: spin 600ms linear infinite;
          margin-left: 8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .login-footer {
          margin-top: 40px;
          font-size: 9px;
          color: rgba(122,126,134,0.55);
          letter-spacing: 0.12em;
          font-family: var(--font-mono);
          text-align: center;
        }

        @media (max-width: 480px) {
          .login-card { padding: 24px; border-radius: 16px; }
          .login-eagle svg { width: 110px; height: 110px; }
          .login-aura { width: 280px; height: 280px; top: 18%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-aura { animation: none; }
          .login-container.is-entered .login-eagle,
          .login-container.is-entered .login-wordmark,
          .login-container.is-entered .login-tagline,
          .login-container.is-entered .login-session-card,
          .login-container.is-entered .login-card,
          .login-container.is-entered .login-footer {
            animation: aguilaFade 300ms ease both !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </div>
  )
}
