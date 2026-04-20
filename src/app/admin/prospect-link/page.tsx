/**
 * /admin/prospect-link
 *
 * Admin entry point for Tito (or Renato IV) to generate a prospect
 * magic link in seconds. One field, one button — paste the URL into
 * WhatsApp/email/Mensajería to a prospect.
 *
 * Works without trade_prospects (the build-9 migration) being applied —
 * queries aduanet_facturas directly for preview metrics.
 */

'use client'

import { useState, type FormEvent } from 'react'
import { GlassCard } from '@/components/aguila/GlassCard'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  BG_DEEP,
  SILVER_GRADIENT,
} from '@/lib/design-system'

const MONO = 'var(--portal-font-mono), Geist Mono, monospace'
const SUCCESS_TEXT_SOFT = 'rgba(134,239,172,0.95)' // design-token (mint, success accent)
const ERROR_TEXT_SOFT = 'rgba(252,165,165,0.95)'   // design-token (pink, error accent)

type Status = 'idle' | 'generating' | 'success' | 'error'

interface GenerateResponse {
  data: {
    url: string
    token: string
    expires_at: string
    rfc: string
    razon_social: string | null
    total_pedimentos: number
    total_valor_usd: number
    primary_patente: string | null
    primary_patente_is_us: boolean
  } | null
  error: { code: string; message: string } | null
  warning?: string | null
}

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

function fmtInt(n: number): string {
  return n.toLocaleString('es-MX')
}

export default function ProspectLinkPage() {
  const [rfc, setRfc] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [response, setResponse] = useState<GenerateResponse | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate(e: FormEvent) {
    e.preventDefault()
    const trimmed = rfc.trim().toUpperCase()
    if (!trimmed) return

    setStatus('generating')
    setResponse(null)
    setCopied(false)

    try {
      const res = await fetch(`/api/admin/prospects/${encodeURIComponent(trimmed)}/generate-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = (await res.json()) as GenerateResponse
      setResponse(json)
      setStatus(json.data ? 'success' : 'error')
    } catch (err) {
      setResponse({ data: null, error: { code: 'NETWORK', message: (err as Error).message } })
      setStatus('error')
    }
  }

  async function handleCopy() {
    if (!response?.data?.url) return
    try {
      await navigator.clipboard.writeText(response.data.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="aguila-dark aguila-canvas" style={{ minHeight: '100vh', padding: '32px 16px' }}>
      <div className="aguila-aura" aria-hidden="true" />
      <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <header style={{ marginBottom: 24 }}>
          <p style={{
            margin: 0, fontSize: 'var(--aguila-fs-meta, 11px)', color: ACCENT_SILVER_DIM,
            letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600,
          }}>
            Prospectos · Generador de enlaces
          </p>
          <h1 style={{
            margin: '4px 0 0', fontSize: 'var(--aguila-fs-title, 24px)', color: ACCENT_SILVER_BRIGHT, fontWeight: 700,
            letterSpacing: '-0.01em',
          }}>
            Vista preliminar para un prospecto
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--aguila-fs-body, 13px)', color: ACCENT_SILVER, lineHeight: 1.5 }}>
            Ingresa el RFC. Generamos un enlace de 7 días con la vista de su
            operación según los registros públicos de Aduana 240. Comparte por
            WhatsApp / correo / Mensajería.
          </p>
        </header>

        <GlassCard tier="hero" padding={24}>
          <form
            onSubmit={handleGenerate}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <label
              htmlFor="rfc-input"
              style={{
                fontSize: 'var(--aguila-fs-label, 10px)', color: ACCENT_SILVER_DIM,
                letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600,
              }}
            >
              RFC del prospecto
            </label>
            <input
              id="rfc-input"
              type="text"
              placeholder="ABC123456XYZ"
              value={rfc}
              onChange={e => setRfc(e.target.value.toUpperCase())}
              disabled={status === 'generating'}
              className="portal-input"
              style={{
                // WHY: 18px input value reads as a serial number — bigger than
                // standard fs-md (16) so the RFC stands out as the primary input.
                fontSize: 'var(--aguila-fs-kpi-small, 18px)',
                fontFamily: MONO, letterSpacing: '0.04em',
                fontVariantNumeric: 'tabular-nums', minHeight: 56,
                textTransform: 'uppercase',
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={status === 'generating' || !rfc.trim()}
              style={{
                minHeight: 56,
                padding: '0 24px',
                borderRadius: 14,
                border: '1px solid rgba(192,197,206,0.4)',
                background: SILVER_GRADIENT,
                color: BG_DEEP,
                fontSize: 'var(--aguila-fs-section, 14px)', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: status === 'generating' ? 'wait' : 'pointer',
                opacity: status === 'generating' || !rfc.trim() ? 0.6 : 1,
              }}
            >
              {status === 'generating' ? 'Generando…' : 'Generar enlace'}
            </button>
          </form>
        </GlassCard>

        {status === 'error' && response?.error ? (
          <div style={{ marginTop: 16 }}>
            <GlassCard tier="secondary" padding={16}>
              <p style={{ margin: 0, color: ERROR_TEXT_SOFT, fontSize: 'var(--aguila-fs-section, 14px)' }}>
                {response.error.message}
              </p>
            </GlassCard>
          </div>
        ) : null}

        {status === 'success' && response?.data ? (
          <div style={{ marginTop: 16 }}>
            <GlassCard tier="hero" padding={24}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{
                  margin: 0, fontSize: 'var(--aguila-fs-meta, 11px)', color: SUCCESS_TEXT_SOFT,
                  letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700,
                }}>
                  Enlace listo para enviar
                </p>
                <div>
                  <p style={{
                    margin: 0, fontSize: 'var(--aguila-fs-meta, 11px)', color: ACCENT_SILVER_DIM,
                    letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
                  }}>
                    Empresa
                  </p>
                  <p style={{
                    margin: '2px 0 0', fontSize: 17 /* WHY: human-anchor razon-social, between fs-md (16) and fs-kpi-small (18) */, color: ACCENT_SILVER_BRIGHT, fontWeight: 600,
                  }}>
                    {response.data.razon_social || response.data.rfc}
                  </p>
                  <p style={{ margin: '2px 0 0', fontFamily: MONO, fontSize: 'var(--aguila-fs-compact, 12px)', color: ACCENT_SILVER }}>
                    RFC {response.data.rfc}
                  </p>
                </div>
                <div style={{
                  display: 'grid', gap: 12,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                }}>
                  <div>
                    <p style={{
                      margin: 0, fontSize: 'var(--aguila-fs-label, 10px)', color: ACCENT_SILVER_DIM,
                      letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600,
                    }}>
                      Pedimentos
                    </p>
                    <p style={{
                      margin: '2px 0 0', fontFamily: MONO, fontSize: 22 /* WHY: stat-cell value between fs-headline (20) and fs-title (24) */, color: ACCENT_SILVER_BRIGHT,
                      fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    }}>
                      {fmtInt(response.data.total_pedimentos)}
                    </p>
                  </div>
                  <div>
                    <p style={{
                      margin: 0, fontSize: 'var(--aguila-fs-label, 10px)', color: ACCENT_SILVER_DIM,
                      letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600,
                    }}>
                      Valor USD
                    </p>
                    <p style={{
                      margin: '2px 0 0', fontFamily: MONO, fontSize: 22 /* WHY: matches stat-cell sibling */, color: ACCENT_SILVER_BRIGHT,
                      fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    }}>
                      {fmtUSD(response.data.total_valor_usd)}
                    </p>
                  </div>
                  <div>
                    <p style={{
                      margin: 0, fontSize: 'var(--aguila-fs-label, 10px)', color: ACCENT_SILVER_DIM,
                      letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600,
                    }}>
                      Patente actual
                    </p>
                    <p style={{
                      margin: '2px 0 0', fontFamily: MONO, fontSize: 17 /* WHY: matches empresa-name 17 above */,
                      color: response.data.primary_patente_is_us ? SUCCESS_TEXT_SOFT : ACCENT_SILVER_BRIGHT,
                      fontWeight: 700,
                    }}>
                      {response.data.primary_patente || '—'}
                    </p>
                  </div>
                </div>
                <div>
                  <p style={{
                    margin: 0, fontSize: 'var(--aguila-fs-label, 10px)', color: ACCENT_SILVER_DIM,
                    letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600,
                  }}>
                    Enlace · 7 días
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <input
                      readOnly
                      value={response.data.url}
                      onFocus={e => e.currentTarget.select()}
                      className="portal-input"
                      style={{
                        flex: 1, minWidth: 240,
                        fontSize: 'var(--aguila-fs-compact, 12px)', fontFamily: MONO,
                        height: 44,
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      style={{
                        minHeight: 44, padding: '0 18px', borderRadius: 10,
                        border: '1px solid rgba(192,197,206,0.4)',
                        background: copied ? 'rgba(34,197,94,0.18)' : 'rgba(192,197,206,0.08)',
                        color: copied ? SUCCESS_TEXT_SOFT : ACCENT_SILVER_BRIGHT,
                        fontSize: 'var(--aguila-fs-compact, 12px)', fontWeight: 700,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        cursor: 'pointer', transition: 'all 150ms ease',
                      }}
                    >
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
                {response.warning ? (
                  <p style={{
                    margin: 0, fontSize: 'var(--aguila-fs-meta, 11px)', color: ACCENT_SILVER_DIM,
                    paddingTop: 8, borderTop: '1px solid var(--portal-line-1)',
                  }}>
                    Aviso interno: {response.warning} (probablemente la migración del log no está aplicada todavía — el enlace funciona igual)
                  </p>
                ) : null}
              </div>
            </GlassCard>
          </div>
        ) : null}
      </div>
    </div>
  )
}
