'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getCookieValue } from '@/lib/client-config'
import { BG_ELEVATED } from '@/lib/design-system'
import { AguilaPasswordInput } from '@/components/aguila'

export default function CambiarContrasena() {
  const router = useRouter()
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
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
        background: 'var(--portal-ink-0)', padding: 16,
      }}>
        <div style={{
          maxWidth: 400, width: '100%', textAlign: 'center',
          background: BG_ELEVATED, border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: 32,
        }}>
          <CheckCircle size={48} style={{ color: 'var(--success-500, #16A34A)', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 600, color: 'var(--portal-fg-1)', marginBottom: 8 }}>
            Contraseña actualizada
          </h2>
          <p style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--text-secondary, #6B6B6B)' }}>
            Redirigiendo al inicio de sesión...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--portal-ink-0)', padding: 16,
    }}>
      <form onSubmit={handleSubmit} style={{
        maxWidth: 400, width: '100%',
        background: BG_ELEVATED, border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: 32,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Lock size={32} style={{ color: 'var(--gold, #E8EAED)', margin: '0 auto 12px' }} />
          <h1 style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 600, color: 'var(--portal-fg-1)', marginBottom: 4 }}>
            Cambiar contraseña
          </h1>
          {companyName && (
            <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary, #6B6B6B)' }}>{companyName}</p>
          )}
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
            background: 'var(--red-50, var(--portal-status-red-bg))', border: '1px solid var(--red-200, #FECACA)',
            borderRadius: 8, marginBottom: 16, fontSize: 'var(--aguila-fs-body)', color: 'var(--red-700, #B91C1C)',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Current password */}
        <div style={{ marginBottom: 16 }}>
          <AguilaPasswordInput
            label="Contraseña actual"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {/* New password */}
        <div style={{ marginBottom: 16 }}>
          <AguilaPasswordInput
            label="Nueva contraseña"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            hint={newPw.length > 0 && newPw.length < 6 ? 'Mínimo 6 caracteres' : undefined}
          />
        </div>

        {/* Confirm password */}
        <div style={{ marginBottom: 24 }}>
          <AguilaPasswordInput
            label="Confirmar nueva contraseña"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
            autoComplete="new-password"
            error={confirmPw && confirmPw !== newPw ? 'Las contraseñas no coinciden' : undefined}
          />
        </div>

        {currentPw === newPw && newPw.length > 0 && (
          <div style={{
            fontSize: 'var(--aguila-fs-compact)', color: 'var(--amber-text, #92400E)', marginBottom: 16,
          }}>
            La nueva contraseña debe ser diferente a la actual
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || loading}
          style={{
            width: '100%', padding: 14, fontSize: 15, fontWeight: 600,
            background: isValid && !loading ? 'var(--gold, #E8EAED)' : 'rgba(255,255,255,0.08)',
            color: isValid && !loading ? 'var(--portal-fg-1)' : 'var(--portal-fg-5)',
            border: 'none', borderRadius: 8, cursor: isValid && !loading ? 'pointer' : 'not-allowed',
            minHeight: 60, transition: 'background 150ms',
          }}
        >
          {loading ? 'Cambiando...' : 'Cambiar contraseña'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link
            href="/"
            style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary, #6B6B6B)', textDecoration: 'none' }}
          >
            Volver al inicio
          </Link>
        </div>
      </form>
    </div>
  )
}
