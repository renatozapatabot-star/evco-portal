'use client'

// PORTAL · /login — bundle-parity cinematic login surface (2026-04-24).
// Ports screen-login.jsx from the Claude Design bundle: giant PORTAL
// wordmark with pulsing emerald dot, living cartographic background,
// green-glow contraseña input, 3-state Entrar button (idle → auth →
// ok), LoginLiveWire rotating strip, Est. 1941 identity chip.
//
// Auth mechanism preserved unchanged: POST /api/auth {password} →
// role-aware landing (admin/broker → /admin/eagle · operator →
// /operador/inicio · else → /inicio) with ?stale=1 and ?next handling.

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  PortalLastSeenLine,
  PortalLoginBackgroundLineMap,
  PortalLoginCardChrome,
  PortalLoginHandshakeRow,
  PortalLoginLiveWire,
} from '@/components/portal'
import { getCookieValue } from '@/lib/client-config'

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: 'var(--portal-ink-0)' }} />
      }
    >
      <LoginContent />
    </Suspense>
  )
}

type Status = 'idle' | 'auth' | 'ok'

function LoginContent() {
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [session, setSession] = useState<{ role: string; name: string } | null>(null)
  const [dots, setDots] = useState(0)
  const [inputFocused, setInputFocused] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [errorPulse, setErrorPulse] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const role = getCookieValue('user_role')
    if (role) setSession({ role, name: getCookieValue('company_name') ?? '' })
    if (searchParams.get('stale') === '1') {
      setError('Tu sesión venció con un cambio de configuración. Vuelve a iniciar sesión.')
    }
  }, [searchParams])

  useEffect(() => {
    if (status !== 'auth') return
    const i = setInterval(() => setDots(d => (d + 1) % 4), 280)
    return () => clearInterval(i)
  }, [status])

  // Caps Lock detector — listens globally for keyboard events and
  // tracks the modifier state. The dot is gated on inputFocused at
  // render time, so we don't need to reset capsLockOn on blur (it
  // simply stops rendering).
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      try {
        setCapsLockOn(ev.getModifierState('CapsLock'))
      } catch {
        // getModifierState is widely supported; fall back silently
      }
    }
    window.addEventListener('keydown', handler)
    window.addEventListener('keyup', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('keyup', handler)
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 3 || status !== 'idle') return
    setError('')
    setStatus('auth')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('cruz_just_entered', '1')
        }
        const next = searchParams.get('next')
        let landing = '/'
        if (!next || !next.startsWith('/')) {
          try {
            const body = await res.clone().json()
            const role: string | undefined = body?.role
            if (role === 'admin' || role === 'broker') landing = '/admin/eagle'
            else if (role === 'operator') landing = '/operador/inicio'
            else landing = '/inicio'
          } catch {
            landing = '/'
          }
        } else {
          landing = next
        }
        setStatus('ok')
        await new Promise(r => setTimeout(r, 450))
        router.push(landing)
        router.refresh()
      } else if (res.status === 429) {
        setStatus('idle')
        setError('Demasiados intentos. Espera un minuto antes de intentar de nuevo.')
        setPassword('')
        setErrorPulse(p => p + 1)
      } else {
        setStatus('idle')
        setError('Código incorrecto. Contacta a Renato Zapata & Company.')
        setPassword('')
        setErrorPulse(p => p + 1)
      }
    } catch {
      setStatus('idle')
      setError('Error de conexión. Intenta de nuevo.')
      setErrorPulse(p => p + 1)
    }
  }

  const canSubmit = password.length >= 3 && status === 'idle'
  const roleLabel =
    session?.role === 'broker' ? 'Agente'
      : session?.role === 'admin' ? 'Admin'
      : session?.role === 'operator' ? 'Operador'
      : 'Cliente'

  return (
    <div
      data-attention={inputFocused ? 'focused' : undefined}
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse 60% 40% at 50% 50%, color-mix(in oklch, var(--portal-ink-1) 50%, var(--portal-ink-0)) 0%, var(--portal-ink-0) 70%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        color: 'var(--portal-fg-1)',
      }}
    >
      {/* Living cartographic background (zIndex 0). data-portal-aurora
          opts the wrapper into the focus-attention dim rule in
          portal-components.css — opacity drops to 0.85 while the user
          is in the password field. */}
      <div
        data-portal-aurora
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <PortalLoginBackgroundLineMap />
      </div>

      {/* Subtle grid anchor (zIndex 1) */}
      <svg
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: 0.35,
        }}
      >
        <defs>
          <pattern id="portal-grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0H0v64" fill="none" stroke="rgba(255,255,255,0.022)" strokeWidth="1" />
          </pattern>
          <radialGradient id="portal-grid-mask" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="60%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor="white" stopOpacity="0.3" />
          </radialGradient>
          <mask id="portal-grid-mask-m">
            <rect width="100%" height="100%" fill="url(#portal-grid-mask)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#portal-grid)" mask="url(#portal-grid-mask-m)" />
      </svg>

      {/* Center vignette (zIndex 2) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 38% 50% at 50% 52%, color-mix(in oklch, var(--portal-ink-0) 70%, transparent) 0%, color-mix(in oklch, var(--portal-ink-0) 30%, transparent) 45%, transparent 75%)',
        }}
      />

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 28px',
          position: 'relative',
          zIndex: 5,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          {/* Quiet eyebrow */}
          <div
            style={{
              fontFamily: 'var(--portal-font-mono)',
              fontSize: 10,
              letterSpacing: '0.32em',
              color: 'var(--portal-fg-5)',
              textTransform: 'uppercase',
              paddingLeft: 'calc(14px + 22px + 0.2em)',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              animation: 'portalFadeUp 900ms var(--portal-ease-out) 40ms both',
            }}
          >
            <span style={{ width: 18, height: 1, background: 'var(--portal-line-3)' }} />
            Un sistema de Renato Zapata &amp; Co.
          </div>

          {/* PORTAL wordmark with pulsing dot */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              marginBottom: 6,
              animation: 'portalFadeUp 900ms var(--portal-ease-out) 80ms both',
            }}
          >
            <span style={{ position: 'relative', width: 14, height: 14, flexShrink: 0 }}>
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 999,
                  background: 'var(--portal-green-2)',
                  boxShadow: '0 0 16px var(--portal-green-glow)',
                  animation: 'portalDotPulse 2.4s ease-in-out infinite',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: 999,
                  border: '1px solid var(--portal-green-2)',
                  opacity: 0.55,
                  animation: 'portalPing 2.4s ease-out infinite',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: 999,
                  border: '1px solid var(--portal-green-2)',
                  opacity: 0.35,
                  animation: 'portalPing 2.4s ease-out 1.2s infinite',
                }}
              />
            </span>
            <span
              style={{
                fontFamily: 'var(--portal-font-serif)',
                fontSize: 'clamp(44px, 6.5vw, 68px)',
                fontWeight: 400,
                letterSpacing: '0.28em',
                color: 'var(--portal-fg-1)',
                textShadow: '0 0 32px color-mix(in oklch, var(--portal-green-2) 14%, transparent)',
                lineHeight: 1,
                paddingLeft: '0.2em',
              }}
            >
              PORTAL
            </span>
          </div>

          {/* Patente subtitle */}
          <div
            style={{
              fontFamily: 'var(--portal-font-mono)',
              fontSize: 11,
              letterSpacing: '0.28em',
              color: 'var(--portal-fg-4)',
              textTransform: 'uppercase',
              paddingLeft: 'calc(14px + 22px + 0.2em)',
              marginBottom: 20,
              animation: 'portalFadeUp 900ms var(--portal-ease-out) 180ms both',
            }}
          >
            Patente <span style={{ color: 'var(--portal-fg-2)' }}>3596</span> · Aduana{' '}
            <span style={{ color: 'var(--portal-fg-2)' }}>240</span> ·{' '}
            <span style={{ color: 'var(--portal-green-3)' }}>Laredo TX ↔ Nuevo Laredo TAMPS</span>
          </div>

          {/* Delicate divider */}
          <div
            style={{
              height: 1,
              width: '100%',
              background:
                'linear-gradient(90deg, transparent 0%, var(--portal-line-2) 30%, var(--portal-line-2) 70%, transparent 100%)',
              marginBottom: 36,
              animation: 'portalFadeUp 900ms var(--portal-ease-out) 260ms both',
            }}
          />

          {/* Active session banner — short-circuits login when cookie present */}
          {session && status === 'idle' && (
            <div
              style={{
                marginBottom: 20,
                padding: '14px 16px',
                background: 'color-mix(in oklch, var(--portal-ink-1) 80%, transparent)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid var(--portal-line-2)',
                borderRadius: 'var(--portal-r-3)',
                fontFamily: 'var(--portal-font-mono)',
                fontSize: 11,
                letterSpacing: '0.14em',
                color: 'var(--portal-fg-3)',
              }}
            >
              <div style={{ color: 'var(--portal-fg-5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.22em', fontSize: 10 }}>
                Sesión activa
              </div>
              <div style={{ color: 'var(--portal-fg-1)', marginBottom: 10, fontSize: 14, letterSpacing: '0.04em' }}>
                {session.name || session.role} · <span style={{ color: 'var(--portal-fg-3)' }}>{roleLabel}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link
                  href="/"
                  style={{
                    padding: '8px 14px',
                    background: 'var(--portal-green-2)',
                    color: 'var(--portal-ink-0)',
                    borderRadius: 'var(--portal-r-2)',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    fontFamily: 'var(--portal-font-sans)',
                  }}
                >
                  Continuar →
                </Link>
                <a
                  href="/api/auth/logout"
                  style={{
                    padding: '8px 14px',
                    border: '1px solid var(--portal-line-2)',
                    color: 'var(--portal-fg-2)',
                    borderRadius: 'var(--portal-r-2)',
                    fontSize: 12,
                    letterSpacing: '0.04em',
                    fontFamily: 'var(--portal-font-sans)',
                  }}
                >
                  Cambiar cuenta
                </a>
              </div>
            </div>
          )}

          {/* Boot-up handshake — VUCEM · OK · SAT · OK · CBP · OK
              appears mid-boot, settles to dim. Hidden when an active
              session is short-circuiting login. */}
          {!session && (
            <div style={{ marginBottom: 8, animation: 'portalFadeUp 900ms var(--portal-ease-out) 360ms both' }}>
              <PortalLoginHandshakeRow />
            </div>
          )}

          {/* Form wrapped in PortalLoginCardChrome — 4 hairline corner
              ticks draw in sequence on first paint, framing the form
              like a Swiss instrument coming online. */}
          <PortalLoginCardChrome style={{ width: '100%' }}>
          <form
            onSubmit={handleLogin}
            style={{ width: '100%', animation: 'portalFadeUp 900ms var(--portal-ease-out) 320ms both' }}
            noValidate
          >
            <label
              htmlFor="portal-code"
              style={{
                display: 'block',
                fontFamily: 'var(--portal-font-mono)',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.28em',
                color: 'var(--portal-fg-4)',
                textTransform: 'uppercase',
                textAlign: 'left',
                marginBottom: 12,
                marginLeft: 2,
              }}
            >
              Contraseña
            </label>
            {/* Focus-trace wrapper — emerald hairline draws from
                center outward on focus via .portal-input-focus-trace
                ::after rule. Tremor key remounts the container to
                replay the shake animation on each fresh error. */}
            <div
              key={`input-${errorPulse}`}
              className={`portal-input-focus-trace${error ? ' portal-tremor' : ''}`}
              style={{
                position: 'relative',
                borderRadius: 'var(--portal-r-4)',
              }}
            >
              <input
                id="portal-code"
                ref={inputRef}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value.slice(0, 64))}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="········"
                autoFocus
                autoComplete="current-password"
                disabled={status !== 'idle'}
                style={{
                  width: '100%',
                  padding: '22px 22px',
                  paddingRight: inputFocused && capsLockOn ? 110 : 22,
                  background: 'color-mix(in oklch, var(--portal-ink-1) 80%, transparent)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  border: '1px solid ' + (password.length ? 'var(--portal-green-3)' : 'var(--portal-line-2)'),
                  borderRadius: 'var(--portal-r-4)',
                  fontFamily: 'var(--portal-font-sans)',
                  fontSize: 17,
                  fontWeight: 400,
                  letterSpacing: password.length ? '0.3em' : '0.01em',
                  textAlign: 'left',
                  color: 'var(--portal-fg-1)',
                  outline: 'none',
                  boxShadow: password.length
                    ? '0 12px 40px -12px rgba(0,0,0,0.6)'
                    : '0 12px 40px -12px rgba(0,0,0,0.6)',
                  transition: 'all var(--portal-dur-2) var(--portal-ease-out)',
                  boxSizing: 'border-box',
                  caretColor: 'var(--portal-green-2)',
                }}
              />
              {inputFocused && capsLockOn && (
                <span
                  aria-live="polite"
                  style={{
                    position: 'absolute',
                    right: 18,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'var(--portal-font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.22em',
                    color: 'var(--portal-amber)',
                    textTransform: 'uppercase',
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: 'var(--portal-amber)',
                      boxShadow:
                        '0 0 8px color-mix(in oklch, var(--portal-amber) 60%, transparent)',
                    }}
                  />
                  Mayús
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              data-state={status === 'auth' ? 'loading' : status === 'ok' ? 'success' : undefined}
              style={{
                width: '100%',
                marginTop: 14,
                padding: '18px 20px',
                background:
                  status === 'ok'
                    ? 'var(--portal-green-2)'
                    : canSubmit
                      ? 'var(--portal-green-2)'
                      : 'color-mix(in oklch, var(--portal-ink-2) 80%, transparent)',
                color: canSubmit || status === 'ok' ? 'var(--portal-ink-0)' : 'var(--portal-fg-5)',
                border: '1px solid ' + (canSubmit || status === 'ok' ? 'var(--portal-green-2)' : 'var(--portal-line-2)'),
                borderRadius: 'var(--portal-r-4)',
                fontFamily: 'var(--portal-font-sans)',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '0.04em',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow:
                  status === 'ok'
                    ? '0 0 0 1px var(--portal-green-3), 0 0 32px var(--portal-green-glow)'
                    : canSubmit
                      ? '0 0 32px var(--portal-green-glow), 0 10px 30px -8px var(--portal-green-3)'
                      : 'none',
                transition: 'all var(--portal-dur-2) var(--portal-ease-out)',
                animation: status === 'ok' ? 'portalSuccessPulse 620ms var(--portal-ease-out)' : undefined,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                minHeight: 60,
              }}
            >
              {status === 'idle' && (
                <>
                  Entrar <span style={{ fontSize: 18 }}>→</span>
                </>
              )}
              {status === 'auth' && <>Verificando{'.'.repeat(dots)}</>}
              {status === 'ok' && <>✓ Acceso concedido</>}
            </button>

            {error && (
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 14px',
                  border: '1px solid color-mix(in oklch, var(--portal-red) 40%, transparent)',
                  background: 'color-mix(in oklch, var(--portal-red) 6%, transparent)',
                  borderRadius: 'var(--portal-r-3)',
                  fontFamily: 'var(--portal-font-sans)',
                  fontSize: 13,
                  color: 'var(--portal-fg-2)',
                  lineHeight: 1.4,
                }}
                role="alert"
              >
                {error}
              </div>
            )}

            <PortalLoginLiveWire />

            <div
              style={{
                marginTop: 18,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'var(--portal-font-mono)',
                fontSize: 10,
                letterSpacing: '0.22em',
                color: 'var(--portal-fg-5)',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg
                  aria-hidden
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                TLS 1.3 · 2FA
              </span>
              <a
                href="mailto:contacto@renatozapata.com?subject=Recuperar%20acceso%20PORTAL"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'var(--portal-font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  color: 'var(--portal-fg-4)',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                }}
              >
                ¿Olvidó su código?
              </a>
            </div>

            {/* Trust line — "Último acceso · 27 abr 2026 · 14:32 ·
                Nuevo Laredo · Chrome/macOS". Reads the HMAC-signed
                last_seen cookie set on the prior successful login.
                Renders nothing on first login. */}
            <PortalLastSeenLine />
          </form>
          </PortalLoginCardChrome>
        </div>
      </main>
    </div>
  )
}
