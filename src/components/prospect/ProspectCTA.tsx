/**
 * ProspectCTA — conversion form on /prospect/[token].
 *
 * One job: take a prospect's interest signal and route it to Tito within
 * 5 seconds via Telegram. Optional phone, optional message.
 *
 * On success: surface "Renato Zapata III te contactará en 24 horas" inline,
 * never redirect. On failure: calm Spanish error + leave form fillable.
 */

'use client'

import { useState, type FormEvent } from 'react'
import { GlassCard } from '@/components/aguila/GlassCard'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  BG_DEEP,
  GREEN,
  SILVER_GRADIENT,
} from '@/lib/design-system'

interface Props {
  rfc: string
  razonSocial: string | null
  token: string
}

const MONO = 'var(--portal-font-mono), Geist Mono, monospace'
// Soft mint for the success-state confirmation text — outside the canonical palette.
const SUCCESS_TEXT_SOFT = 'rgba(134,239,172,0.95)' // design-token (mint, success cell)
// Soft pink for inline error text — outside the canonical palette.
const ERROR_TEXT_SOFT = 'rgba(252,165,165,0.95)' // design-token (pink, error cell)

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function ProspectCTA({ rfc, razonSocial, token }: Props) {
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (status === 'submitting' || status === 'success') return

    setStatus('submitting')
    setErrorMessage(null)

    try {
      const res = await fetch(`/api/prospect/${encodeURIComponent(token)}/cta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim() || null,
          message: message.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('error')
        setErrorMessage(json?.error?.message || 'No pudimos enviar tu mensaje. Intenta de nuevo.')
        return
      }
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage((err as Error).message || 'Error de red. Verifica tu conexión.')
    }
  }

  if (status === 'success') {
    return (
      <GlassCard tier="hero" padding={24}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span
            aria-hidden
            style={{
              width: 10, height: 10, borderRadius: '50%', background: GREEN,
              marginTop: 8, boxShadow: '0 0 12px rgba(34,197,94,0.5)', flexShrink: 0,
            }}
          />
          <div>
            <p style={{
              margin: 0, fontSize: 'var(--aguila-fs-meta, 11px)', color: ACCENT_SILVER_DIM,
              letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600,
            }}>
              Mensaje recibido
            </p>
            <p style={{
              margin: '6px 0 0', fontSize: 'var(--aguila-fs-kpi-small, 18px)', color: ACCENT_SILVER_BRIGHT, fontWeight: 600,
              letterSpacing: '-0.01em',
            }}>
              Renato Zapata III te contactará en 24 horas.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--aguila-fs-body, 13px)', color: SUCCESS_TEXT_SOFT }}>
              Mientras tanto, esta vista preliminar sigue disponible para que sigas explorando.
            </p>
          </div>
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard tier="hero" padding={24}>
      <p style={{
        margin: 0, fontSize: 'var(--aguila-fs-meta, 11px)', color: ACCENT_SILVER_DIM,
        letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600,
      }}>
        Hablemos en 24 horas
      </p>
      <p style={{
        margin: '6px 0 16px', fontSize: 'var(--aguila-fs-kpi-small, 18px)', color: ACCENT_SILVER_BRIGHT, fontWeight: 600,
        letterSpacing: '-0.01em',
      }}>
        Esta vista preliminar es lo que ya sabemos sobre {razonSocial || 'tu operación'}.
        En cuanto trabajemos juntos, cada número se vuelve tuyo en tiempo real.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label
            htmlFor="prospect-cta-phone"
            style={{
              display: 'block', fontSize: 'var(--aguila-fs-label, 10px)', color: ACCENT_SILVER_DIM,
              letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4,
            }}
          >
            Teléfono · opcional
          </label>
          <input
            id="prospect-cta-phone"
            type="tel"
            inputMode="tel"
            placeholder="+52 81 1234 5678"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            disabled={status === 'submitting'}
            className="portal-input"
            style={{
              fontSize: 15, // WHY: one step smaller than fs-md (16) — phone input reads as data, not heading.
              fontFamily: MONO, fontVariantNumeric: 'tabular-nums',
              minHeight: 48,
            }}
          />
        </div>

        <div>
          <label
            htmlFor="prospect-cta-message"
            style={{
              display: 'block', fontSize: 'var(--aguila-fs-label, 10px)', color: ACCENT_SILVER_DIM,
              letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4,
            }}
          >
            Comentario · opcional
          </label>
          <textarea
            id="prospect-cta-message"
            placeholder="¿Algo específico que te gustaría revisar con Tito?"
            value={message}
            onChange={e => setMessage(e.target.value)}
            disabled={status === 'submitting'}
            rows={3}
            className="portal-input"
            style={{
              fontSize: 'var(--aguila-fs-section, 14px)', fontFamily: 'inherit',
              resize: 'vertical', minHeight: 80,
            }}
          />
        </div>

        <button
          type="submit"
          disabled={status === 'submitting'}
          aria-label={`Solicitar conversación sobre RFC ${rfc}`}
          style={{
            minHeight: 60,
            padding: '0 24px',
            borderRadius: 14,
            border: '1px solid rgba(192,197,206,0.4)',
            background: SILVER_GRADIENT,
            color: BG_DEEP,
            fontSize: 15, // WHY: CTA copy at 15 sits between fs-section (14) and fs-md (16) — canonical hero-card button size.
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: status === 'submitting' ? 'wait' : 'pointer',
            opacity: status === 'submitting' ? 0.7 : 1,
            transition: 'transform 80ms ease, opacity 150ms ease',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 12px rgba(192,197,206,0.18)',
          }}
        >
          {status === 'submitting' ? 'Enviando…' : 'Hablemos en 24 horas'}
        </button>

        {errorMessage ? (
          <p style={{
            margin: 0, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            color: ERROR_TEXT_SOFT, fontSize: 'var(--aguila-fs-body, 13px)',
          }}>
            {errorMessage}
          </p>
        ) : null}

        <p style={{ margin: 0, fontSize: 'var(--aguila-fs-meta, 11px)', color: ACCENT_SILVER_DIM, lineHeight: 1.5 }}>
          Tu información va directamente a Renato Zapata III · Director General.
          No la compartimos. No te enviaremos correos masivos. RFC{' '}
          <span style={{ fontFamily: MONO, color: ACCENT_SILVER }}>{rfc}</span>.
        </p>
      </form>
    </GlassCard>
  )
}
