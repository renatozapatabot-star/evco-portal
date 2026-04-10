'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCookieValue } from '@/lib/client-config'
import { AduanaMark } from '@/components/command-center/CruzMark'

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0f1c' }} />}>
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
      {/* Subtle grid texture */}
      <div className="login-grid" />

      {/* CRUZ watermark */}
      <div className="login-watermark" aria-hidden="true">ADUANA</div>

      {/* Floating gold accent */}
      <div className="login-glow" />

      <div
        className="login-container"
        style={{
          opacity: entering ? 0 : mounted ? 1 : 0,
          transform: entering ? 'translateY(8px) scale(0.98)' : mounted ? 'translateY(0)' : 'translateY(12px)',
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
              <div className="login-cruz-wordmark">ADUANA</div>
            </div>
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

          {/* Platform stats — social proof */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
            padding: '12px 0', margin: '12px 0 0',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Stat value="30,707" label="tráficos" />
            <Stat value="307K" label="documentos" />
            <Stat value="64K" label="facturas" />
          </div>

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
          background:
            radial-gradient(ellipse at 50% 30%, rgba(0,229,255,0.06) 0%, transparent 50%),
            linear-gradient(180deg, #05070B 0%, #0B1220 100%);
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
            linear-gradient(rgba(0,229,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,229,255,0.02) 1px, transparent 1px);
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
          color: rgba(0,229,255,0.03);
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
          background: radial-gradient(circle, rgba(0,229,255,0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-container {
          width: 100%;
          max-width: 400px;
          position: relative;
          z-index: 1;
        }

        /* ── Session Card — glass ── */
        .login-session-card {
          background: rgba(9,9,11,0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(0,229,255,0.2);
          border-radius: 20px 20px 0 0;
          padding: 20px 24px;
          margin-bottom: -1px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 15px rgba(0,229,255,0.3);
          position: relative;
          z-index: 1;
        }
        .login-session-label {
          font-size: 12px; color: #8B949E; margin-bottom: 6px; font-weight: 500;
        }
        .login-session-name {
          font-size: 16px; font-weight: 700; color: #E6EDF3; margin-bottom: 2px;
        }
        .login-session-role {
          font-size: 12px; color: #8B949E; margin-bottom: 16px;
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
        .login-btn-gold:hover { background: #eab308; transform: translateY(-1px); }
        .login-btn-gold:active { transform: translateY(0); }
        .login-btn-outline {
          flex: 1; display: flex; align-items: center; justify-content: center;
          height: 60px; border-radius: 10px; font-size: 13px; font-weight: 600;
          text-decoration: none; color: #8B949E; border: 1px solid rgba(255,255,255,0.12);
          transition: background 150ms ease, border-color 150ms ease;
        }
        .login-btn-outline:hover { background: rgba(9,9,11,0.75); border-color: rgba(255,255,255,0.2); }

        /* ── Login Card — glass ── */
        .login-card {
          background: rgba(9,9,11,0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 40px;
          border: 1px solid rgba(0,229,255,0.2);
          box-shadow:
            0 10px 30px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,255,255,0.06),
            0 0 15px rgba(0,229,255,0.3);
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
          color: #E6EDF3;
          line-height: 1;
          text-align: center;
          text-shadow: 0 0 20px rgba(0,229,255,0.3);
        }
        .login-cruz-accent {
          width: 40px;
          height: 2px;
          background: linear-gradient(90deg, #00f0ff, #0088ff);
          margin: 14px auto 0;
          border-radius: 1px;
        }
        .login-brand-company {
          margin-top: 16px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.15em;
          color: #E6EDF3;
          font-family: var(--font-sans);
        }
        .login-brand-subtitle {
          margin-top: 6px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.08em;
          color: #8B949E;
        }

        .login-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
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
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #9B9B9B;
          margin-bottom: 6px;
        }

        .login-input {
          width: 100%;
          height: 60px;
          border: 1.5px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 0 16px;
          font-size: 16px;
          background: rgba(9,9,11,0.75);
          color: #E6EDF3;
          outline: none;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .login-input::placeholder {
          color: #6E7681;
        }
        .login-input:focus {
          border-color: rgba(0,229,255,0.5);
          box-shadow: 0 0 0 3px rgba(0,229,255,0.15), 0 0 20px rgba(0,229,255,0.2);
          background: rgba(255,255,255,0.06);
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
          background: #eab308;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(234,179,8,0.25), 0 0 16px rgba(234,179,8,0.2);
        }
        .login-submit:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: none;
        }
        .login-submit:disabled {
          background: rgba(234,179,8,0.3);
          color: #64748b;
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
          border-top: 1px solid rgba(255,255,255,0.06);
          text-align: center;
        }
        .login-footer-name {
          font-size: 13px; color: #8B949E; font-weight: 500;
        }
        .login-footer-meta {
          font-size: 11px; color: #6E7681; margin-top: 4px;
          font-family: var(--font-mono);
          letter-spacing: 0.02em;
        }

        /* ── Mobile ── */
        @media (max-width: 480px) {
          .login-card { padding: 32px 24px; border-radius: 16px; }
          .login-cruz-wordmark { font-size: 34px; letter-spacing: 0.18em; }
        }
        @media (max-width: 375px) {
          .login-session-actions { gap: 8px; }
        }
      `}</style>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 16, fontWeight: 700, color: '#eab308' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}
