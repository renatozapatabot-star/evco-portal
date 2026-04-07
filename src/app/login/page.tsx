'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCookieValue } from '@/lib/client-config'

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0D0D0C' }} />}>
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
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const role = getCookieValue('user_role')
    if (role) {
      setSession({ role, name: getCookieValue('company_name') ?? '' })
    }
    // Trigger entrance animation
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

  const roleLabel = session?.role === 'broker'
    ? 'Operador interno'
    : session?.role === 'admin'
      ? 'Administrador'
      : 'Cliente'

  return (
    <div className="login-page">
      {/* Subtle grid texture */}
      <div className="login-grid" />

      {/* CRUZ watermark */}
      <div className="login-watermark" aria-hidden="true">CRUZ</div>

      {/* Floating gold accent */}
      <div className="login-glow" />

      <div
        className="login-container"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 500ms cubic-bezier(.2,0,0,1), transform 500ms cubic-bezier(.2,0,0,1)',
        }}
      >
        {/* Active session banner */}
        {session && (
          <div className="login-session-card">
            <p className="login-session-label">Sesión activa</p>
            <p className="login-session-name">{session.name || session.role}</p>
            <p className="login-session-role">{roleLabel}</p>
            <div className="login-session-actions">
              <a href="/" className="login-btn-gold">
                Ir al portal
              </a>
              <a href="/api/auth/logout" className="login-btn-outline">
                Cambiar cuenta
              </a>
            </div>
          </div>
        )}

        {/* Login card */}
        <div className="login-card" style={session ? { borderRadius: '0 0 20px 20px' } : undefined}>
          {/* Brand */}
          <div className="login-brand">
            <div className="login-cruz-wordmark">CRUZ</div>
            <div className="login-cruz-accent" />
            <div className="login-brand-company">RENATO ZAPATA &amp; CO.</div>
            <div className="login-brand-subtitle">Portal de Clientes</div>
          </div>

          <div className="login-divider" />

          {/* Error */}
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
              <label htmlFor="login-code" className="login-label">
                CÓDIGO DE ACCESO
              </label>
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

            <button
              type="submit"
              disabled={loading || !password}
              className="login-submit"
            >
              <span>{loading ? 'Iniciando...' : 'Iniciar sesión'}</span>
              {!loading && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 6 }}>
                  <path d="M3 8h10m-4-4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {loading && (
                <span className="login-spinner" />
              )}
            </button>

            {/* Password recovery removed — contact broker directly */}
          </form>

          {/* Footer identity */}
          <div className="login-footer">
            <p className="login-footer-name">Renato Zapata &amp; Company</p>
            <p className="login-footer-meta">Patente 3596 · Aduana 240 · Est. 1941</p>
          </div>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--navy-900);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: var(--font-sans);
          position: relative;
          overflow: hidden;
        }

        .login-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(212,168,67,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,168,67,0.03) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 70%);
        }

        .login-watermark {
          position: absolute;
          bottom: -40px;
          right: -60px;
          font-size: 200px;
          font-weight: 800;
          font-family: var(--font-sans);
          letter-spacing: 0.15em;
          color: rgba(212,168,67,0.025);
          line-height: 1;
          pointer-events: none;
          user-select: none;
        }

        .login-glow {
          position: absolute;
          top: 30%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(196,150,60,0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-container {
          width: 100%;
          max-width: 400px;
          position: relative;
          z-index: 1;
        }

        /* ── Session Card ── */
        .login-session-card {
          background: #FFFFFF;
          border: 1px solid #E8E5E0;
          border-radius: 20px 20px 0 0;
          padding: 20px 24px;
          margin-bottom: -1px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.12);
          position: relative;
          z-index: 1;
        }
        .login-session-label {
          font-size: 12px; color: #6B6B6B; margin-bottom: 6px; font-weight: 500;
        }
        .login-session-name {
          font-size: 16px; font-weight: 700; color: #1A1A1A; margin-bottom: 2px;
        }
        .login-session-role {
          font-size: 12px; color: #9B9B9B; margin-bottom: 16px;
        }
        .login-session-actions {
          display: flex; gap: 10px;
        }
        .login-btn-gold {
          flex: 1; display: flex; align-items: center; justify-content: center;
          height: 60px; border-radius: 10px; font-size: 13px; font-weight: 600;
          text-decoration: none; color: var(--navy-900); background: var(--gold-400);
          transition: background 150ms ease, transform 100ms ease;
        }
        .login-btn-gold:hover { background: #C9A84C; transform: translateY(-1px); }
        .login-btn-gold:active { transform: translateY(0); }
        .login-btn-outline {
          flex: 1; display: flex; align-items: center; justify-content: center;
          height: 60px; border-radius: 10px; font-size: 13px; font-weight: 600;
          text-decoration: none; color: #6B6B6B; border: 1px solid #E8E5E0;
          transition: background 150ms ease, border-color 150ms ease;
        }
        .login-btn-outline:hover { background: #FAFAF8; border-color: #D1CEC9; }

        /* ── Login Card ── */
        .login-card {
          background: #FFFFFF;
          border-radius: 20px;
          padding: 40px;
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.03),
            0 2px 4px rgba(0,0,0,0.04),
            0 12px 40px rgba(0,0,0,0.25);
        }

        /* ── Brand ── */
        .login-brand {
          text-align: center;
        }
        .login-cruz-wordmark {
          font-family: var(--font-sans);
          font-size: 42px;
          font-weight: 700;
          letter-spacing: 0.22em;
          color: var(--navy-900);
          line-height: 1;
          text-align: center;
        }
        .login-cruz-accent {
          width: 40px;
          height: 2px;
          background: var(--gold-400);
          margin: 14px auto 0;
          border-radius: 1px;
        }
        .login-brand-company {
          margin-top: 16px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.15em;
          color: #1A1A1A;
          font-family: var(--font-sans);
        }
        .login-brand-subtitle {
          margin-top: 6px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.08em;
          color: #9B9B9B;
        }

        .login-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #E8E5E0, transparent);
          margin: 28px 0;
        }

        /* ── Error ── */
        .login-error {
          display: flex; gap: 10px; padding: 12px 14px;
          background: #FEF2F2; border: 1px solid #FECACA;
          border-radius: 10px; margin-bottom: 20px;
          align-items: flex-start;
        }
        .login-error-icon { flex-shrink: 0; margin-top: 1px; }
        .login-error-text {
          font-size: 13px; font-weight: 600; color: #991B1B; line-height: 1.4;
        }
        .login-error-links {
          font-size: 11px; color: #B91C1C; margin-top: 4px;
        }
        .login-error-links a {
          color: #B91C1C; text-decoration: underline; font-weight: 600;
        }

        /* ── Form ── */
        .login-form { display: flex; flex-direction: column; }

        .login-field { margin-bottom: 16px; }

        .login-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #9B9B9B;
          margin-bottom: 6px;
        }

        .login-input {
          width: 100%;
          height: 60px;
          border: 1.5px solid #E8E5E0;
          border-radius: 10px;
          padding: 0 16px;
          font-size: 16px;
          background: #FAFAF8;
          color: #1A1A1A;
          outline: none;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .login-input::placeholder {
          color: #C4C0B9;
        }
        .login-input:focus {
          border-color: var(--gold-400);
          box-shadow: 0 0 0 3px rgba(212,168,67,0.12);
          background: #FFFFFF;
        }

        /* ── Submit ── */
        .login-submit {
          width: 100%;
          height: 60px;
          margin-top: 8px;
          background: var(--gold-400);
          border: none;
          border-radius: 10px;
          color: var(--navy-900);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          letter-spacing: 0.01em;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 150ms ease, transform 100ms ease, opacity 150ms ease;
          position: relative;
        }
        .login-submit:hover:not(:disabled) {
          background: #C9A84C;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(196,150,60,0.25);
        }
        .login-submit:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: none;
        }
        .login-submit:disabled {
          background: #E8E5E0;
          color: #9B9B9B;
          cursor: default;
        }

        .login-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(11,22,35,0.2);
          border-top-color: var(--navy-900);
          border-radius: 50%;
          animation: spin 600ms linear infinite;
          margin-left: 8px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ── Forgot ── */
        .login-forgot {
          text-align: center;
          margin-top: 16px;
        }
        .login-forgot a {
          font-size: 12px;
          color: #9B9B9B;
          text-decoration: none;
          transition: color 150ms ease;
        }
        .login-forgot a:hover {
          color: var(--gold-400);
        }

        /* ── Footer ── */
        .login-footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #F0EEEA;
          text-align: center;
        }
        .login-footer-name {
          font-size: 13px; color: #6B6B6B; font-weight: 500;
        }
        .login-footer-meta {
          font-size: 11px; color: #B0ADA6; margin-top: 4px;
          font-family: var(--font-mono);
          letter-spacing: 0.02em;
        }

        /* ── Mobile ── */
        @media (max-width: 480px) {
          .login-card { padding: 32px 24px; border-radius: 16px; }
          .login-cruz-wordmark { font-size: 34px; letter-spacing: 0.18em; }
        }
      `}</style>
    </div>
  )
}
