'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getCookieValue } from '@/lib/client-config'

export default function CambiarContrasena() {
  const router = useRouter()
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const companyName = typeof document !== 'undefined'
    ? (getCookieValue('company_name') ?? '')
    : ''

  const isValid = currentPw.length >= 1 && newPw.length >= 6 && newPw === confirmPw && currentPw !== newPw

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    setError(null)

    try {
      const csrfToken = getCookieValue('csrf_token') || ''
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          current_password: currentPw,
          new_password: newPw,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || 'Error al cambiar contraseña')
        return
      }

      setSuccess(true)
      // Log out after 3 seconds so they can re-login with new password
      setTimeout(() => {
        fetch('/api/auth', { method: 'DELETE' }).then(() => {
          router.push('/login')
        })
      }, 3000)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary, #FAFAF8)', padding: 16,
      }}>
        <div style={{
          maxWidth: 400, width: '100%', textAlign: 'center',
          background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border, #E8E5E0)',
          borderRadius: 12, padding: 32,
        }}>
          <CheckCircle size={48} style={{ color: 'var(--success-500, #16A34A)', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary, #1A1A1A)', marginBottom: 8 }}>
            Contraseña actualizada
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary, #6B6B6B)' }}>
            Redirigiendo al inicio de sesión...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary, #FAFAF8)', padding: 16,
    }}>
      <form onSubmit={handleSubmit} style={{
        maxWidth: 400, width: '100%',
        background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border, #E8E5E0)',
        borderRadius: 12, padding: 32,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Lock size={32} style={{ color: 'var(--gold, #C9A84C)', margin: '0 auto 12px' }} />
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary, #1A1A1A)', marginBottom: 4 }}>
            Cambiar contraseña
          </h1>
          {companyName && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary, #6B6B6B)' }}>{companyName}</p>
          )}
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
            background: 'var(--red-50, #FEF2F2)', border: '1px solid var(--red-200, #FECACA)',
            borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--red-700, #B91C1C)',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Current password */}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary, #1A1A1A)', display: 'block', marginBottom: 6 }}>
            Contraseña actual
          </span>
          <div style={{ position: 'relative' }}>
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%', padding: '12px 44px 12px 12px', fontSize: 15,
                border: '1px solid var(--border, #E8E5E0)', borderRadius: 8,
                background: 'var(--bg-primary, #FAFAF8)', minHeight: 60,
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 8,
                color: 'var(--text-muted, #9B9B9B)', minHeight: 44, minWidth: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label={showCurrent ? 'Ocultar' : 'Mostrar'}
            >
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        {/* New password */}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary, #1A1A1A)', display: 'block', marginBottom: 6 }}>
            Nueva contraseña
          </span>
          <div style={{ position: 'relative' }}>
            <input
              type={showNew ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              style={{
                width: '100%', padding: '12px 44px 12px 12px', fontSize: 15,
                border: '1px solid var(--border, #E8E5E0)', borderRadius: 8,
                background: 'var(--bg-primary, #FAFAF8)', minHeight: 60,
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 8,
                color: 'var(--text-muted, #9B9B9B)', minHeight: 44, minWidth: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label={showNew ? 'Ocultar' : 'Mostrar'}
            >
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {newPw.length > 0 && newPw.length < 6 && (
            <span style={{ fontSize: 12, color: 'var(--amber-text, #92400E)', marginTop: 4, display: 'block' }}>
              Mínimo 6 caracteres
            </span>
          )}
        </label>

        {/* Confirm password */}
        <label style={{ display: 'block', marginBottom: 24 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary, #1A1A1A)', display: 'block', marginBottom: 6 }}>
            Confirmar nueva contraseña
          </span>
          <input
            type="password"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            required
            autoComplete="new-password"
            style={{
              width: '100%', padding: 12, fontSize: 15,
              border: `1px solid ${confirmPw && confirmPw !== newPw ? 'var(--red-500, #DC2626)' : 'var(--border, #E8E5E0)'}`,
              borderRadius: 8, background: 'var(--bg-primary, #FAFAF8)', minHeight: 60,
              boxSizing: 'border-box',
            }}
          />
          {confirmPw && confirmPw !== newPw && (
            <span style={{ fontSize: 12, color: 'var(--red-text, #991B1B)', marginTop: 4, display: 'block' }}>
              Las contraseñas no coinciden
            </span>
          )}
        </label>

        {currentPw === newPw && newPw.length > 0 && (
          <div style={{
            fontSize: 12, color: 'var(--amber-text, #92400E)', marginBottom: 16,
          }}>
            La nueva contraseña debe ser diferente a la actual
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || loading}
          style={{
            width: '100%', padding: 14, fontSize: 15, fontWeight: 600,
            background: isValid && !loading ? 'var(--gold, #C9A84C)' : 'var(--border, #E8E5E0)',
            color: isValid && !loading ? '#FFFFFF' : 'var(--text-muted, #9B9B9B)',
            border: 'none', borderRadius: 8, cursor: isValid && !loading ? 'pointer' : 'not-allowed',
            minHeight: 60, transition: 'background 150ms',
          }}
        >
          {loading ? 'Cambiando...' : 'Cambiar contraseña'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a
            href="/"
            style={{ fontSize: 13, color: 'var(--text-secondary, #6B6B6B)', textDecoration: 'none' }}
          >
            Volver al inicio
          </a>
        </div>
      </form>
    </div>
  )
}
