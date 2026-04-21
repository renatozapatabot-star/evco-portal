'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import {
  GlassCard,
  AguilaInput,
  AguilaTextarea,
} from '@/components/aguila'

/**
 * Inline lead-capture form for /pitch.
 *
 * POSTs to /api/leads with { source: 'demo', source_url: '/pitch' }.
 * On success, the card swaps to a calm confirmation state — stays on
 * the pitch URL so the prospect can continue browsing / share / open
 * the demo afterward.
 *
 * Client-only because it manages form state + fetch. Server-rendered
 * pitch page stays static-ready above the fold.
 */
export function PitchLeadForm() {
  const [firmName, setFirmName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [notes, setNotes] = useState('')
  // Honeypot field. Real humans never fill it; simple bots fill every field.
  // If this ends up non-empty, we silently drop the submission.
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = firmName.trim().length >= 2 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    // Honeypot trip — pretend we submitted, don't actually POST
    if (honeypot.trim().length > 0) {
      setSubmitted(true)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firm_name: firmName.trim(),
          contact_name: contactName.trim() || undefined,
          contact_email: contactEmail.trim() || undefined,
          contact_phone: contactPhone.trim() || undefined,
          notes: notes.trim() || undefined,
          source: 'demo',
          source_url: '/pitch',
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.error) {
        const msg =
          typeof body?.error?.message === 'string'
            ? body.error.message
            : 'submit_failed'
        setError(
          msg === 'firm_name_required'
            ? 'Por favor ingrese el nombre de la empresa.'
            : 'No se pudo enviar. Intente de nuevo en un momento.',
        )
        return
      }
      setSubmitted(true)
    } catch {
      setError('Error de conexión. Intente de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <GlassCard tier="hero" padding={32} style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--portal-status-green-bg)',
            border: '1px solid var(--portal-status-green-ring)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Check size={28} color="var(--portal-status-green-fg)" strokeWidth={2.4} />
        </div>
        <div
          style={{
            fontFamily: 'var(--portal-font-display)',
            fontSize: 'var(--portal-fs-xl)',
            color: 'var(--portal-fg-1)',
            marginBottom: 8,
            letterSpacing: '-0.01em',
          }}
        >
          Solicitud recibida.
        </div>
        <p
          style={{
            margin: '0 auto',
            maxWidth: 420,
            fontSize: 'var(--portal-fs-sm)',
            color: 'var(--portal-fg-4)',
            lineHeight: 1.5,
          }}
        >
          Renato Zapata IV le contactará dentro de 24 horas. Mientras,
          puede explorar el demo en vivo.
        </p>
        <div style={{ marginTop: 20 }}>
          <Link
            href="/demo/live"
            className="portal-btn portal-btn--primary portal-btn--lg"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            Ver demo en vivo
          </Link>
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard tier="hero" padding={28}>
      <div
        style={{
          fontFamily: 'var(--portal-font-display)',
          fontSize: 'var(--portal-fs-xl)',
          color: 'var(--portal-fg-1)',
          letterSpacing: '-0.01em',
          marginBottom: 4,
          textAlign: 'center',
        }}
      >
        Solicite acceso — 24 horas de respuesta.
      </div>
      <p
        style={{
          margin: '0 auto 20px',
          maxWidth: 520,
          fontSize: 'var(--portal-fs-sm)',
          color: 'var(--portal-fg-4)',
          lineHeight: 1.5,
          textAlign: 'center',
        }}
      >
        Sólo necesitamos el nombre de su empresa. Renato IV revisa
        personalmente cada solicitud.
      </p>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <AguilaInput
          label="Nombre de la empresa"
          required
          placeholder="Empresa S.A. de C.V."
          value={firmName}
          onChange={(e) => setFirmName(e.target.value)}
          autoComplete="organization"
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          <AguilaInput
            label="Su nombre (opcional)"
            placeholder="Juan García López"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            autoComplete="name"
          />
          <AguilaInput
            label="Correo (opcional)"
            type="email"
            placeholder="juan@empresa.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <AguilaInput
          label="Teléfono / WhatsApp (opcional)"
          type="tel"
          placeholder="+52 81 1234 5678"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          autoComplete="tel"
        />
        <AguilaTextarea
          label="Contexto (opcional)"
          placeholder="Volumen mensual, corredor principal, fracción típica…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
        {/* Honeypot — absolutely positioned off-screen. Bots fill all
            inputs; humans never see this one. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: -10000,
            top: 'auto',
            width: 1,
            height: 1,
            overflow: 'hidden',
          }}
        >
          <label>
            Apellido (no llenar)
            <input
              type="text"
              name="apellido_secundario"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </label>
        </div>
        {error ? (
          <div
            role="alert"
            style={{
              color: 'var(--portal-status-red-fg)',
              fontSize: 'var(--portal-fs-sm)',
              background: 'var(--portal-status-red-bg)',
              border: '1px solid var(--portal-status-red-ring)',
              borderRadius: 10,
              padding: '10px 14px',
            }}
          >
            {error}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={!canSubmit}
          className="portal-btn portal-btn--primary portal-btn--lg"
          style={{
            width: '100%',
            marginTop: 8,
            opacity: canSubmit ? 1 : 0.6,
            cursor: canSubmit ? 'pointer' : 'wait',
          }}
        >
          {submitting ? 'Enviando…' : 'Solicitar acceso'}
        </button>
      </form>
    </GlassCard>
  )
}
