'use client'

/**
 * Renders one of three states depending on the lead:
 *   1. Lead not yet won → null (card doesn't render)
 *   2. Lead is won + not converted → conversion form
 *   3. Lead is already converted → success banner with tenant link
 *
 * The conversion form posts to /api/leads/[id]/convert which inserts
 * the `companies` row, stamps the lead with client_code_assigned +
 * converted_at, and emits a `system` activity on the timeline.
 *
 * Slug convention: lower-case, [a-z0-9-], 3-40 chars. Pre-filled
 * from firm_name via a simple slugify so the happy path is one click.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, ExternalLink, Clock } from 'lucide-react'
import { GlassCard, AguilaInput, AguilaSelect } from '@/components/aguila'
import type { LeadRow } from '@/lib/leads/types'

interface Props {
  lead: LeadRow
  onConverted?: (updated: LeadRow) => void
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function slugify(firmName: string): string {
  return firmName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40)
}

export function LeadConvertCard({ lead, onConverted }: Props) {
  const router = useRouter()
  const [companyId, setCompanyId] = useState('')
  const [claveCliente, setClaveCliente] = useState('')
  const [language, setLanguage] = useState<'es' | 'en'>('es')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill the slug from firm_name the first time the card renders.
  useEffect(() => {
    if (!companyId) setCompanyId(slugify(lead.firm_name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.firm_name])

  // State 1: lead isn't closed-won and isn't converted — don't render.
  if (lead.stage !== 'won' && !lead.converted_at) return null

  // State 3: already converted — success banner.
  if (lead.converted_at && lead.client_code_assigned) {
    return (
      <GlassCard
        tier="hero"
        padding={20}
        style={{
          borderColor: 'var(--portal-status-green-ring)',
          background: 'var(--portal-status-green-bg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <CheckCircle2
            size={28}
            strokeWidth={2}
            color="var(--portal-status-green-fg)"
            style={{ flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                fontFamily: 'var(--portal-font-mono)',
                fontSize: 'var(--portal-fs-tiny)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--portal-status-green-fg)',
                marginBottom: 4,
              }}
            >
              Cliente activo
            </div>
            <div
              style={{
                fontSize: 'var(--portal-fs-lg)',
                fontWeight: 600,
                color: 'var(--portal-fg-1)',
                marginBottom: 2,
              }}
            >
              {lead.firm_name}
            </div>
            <div
              style={{
                fontSize: 'var(--portal-fs-sm)',
                color: 'var(--portal-fg-3)',
              }}
            >
              Tenant{' '}
              <code
                style={{
                  fontFamily: 'var(--portal-font-mono)',
                  color: 'var(--portal-fg-1)',
                }}
              >
                {lead.client_code_assigned}
              </code>{' '}
              · convertido{' '}
              {new Date(lead.converted_at).toLocaleDateString('es-MX', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>
          <Link
            href="/admin/monitor/tenants"
            className="portal-btn portal-btn--ghost"
            style={{
              minHeight: 44,
              padding: '0 14px',
              fontSize: 'var(--portal-fs-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Ver en monitor
            <ExternalLink size={14} strokeWidth={2.2} />
          </Link>
        </div>
      </GlassCard>
    )
  }

  // State 2: closed-won, not yet converted — render the form.

  const slugValid =
    companyId.length >= 3 &&
    companyId.length <= 40 &&
    SLUG_RE.test(companyId)
  const claveValid = !claveCliente.trim() || /^\d{1,10}$/.test(claveCliente.trim())
  const canSubmit = slugValid && claveValid && !submitting

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      const csrfToken =
        typeof document !== 'undefined'
          ? document.cookie.match(/csrf_token=([^;]+)/)?.[1] ?? ''
          : ''
      const res = await fetch(`/api/leads/${lead.id}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          company_id: companyId,
          clave_cliente: claveCliente.trim() || undefined,
          language,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.error) {
        setError(body?.error?.message ?? 'conversion_failed')
        return
      }
      if (body?.data?.lead) {
        onConverted?.(body.data.lead as LeadRow)
        router.refresh()
      }
    } catch {
      setError('network_error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <GlassCard tier="hero" padding={20}>
      <div
        className="portal-eyebrow"
        style={{
          fontSize: 'var(--portal-fs-label)',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--portal-fg-4)',
          marginBottom: 4,
        }}
      >
        Convertir a cliente
      </div>
      <div
        style={{
          fontSize: 'var(--portal-fs-sm)',
          color: 'var(--portal-fg-3)',
          marginBottom: 16,
          maxWidth: 640,
          lineHeight: 1.5,
        }}
      >
        Crea el tenant en{' '}
        <code
          style={{
            fontFamily: 'var(--portal-font-mono)',
            color: 'var(--portal-fg-2)',
          }}
        >
          companies
        </code>
        . Una vez creado, el sync nocturno empieza a correr para este
        cliente y las superficies del portal muestran sus datos. La clave
        GlobalPC puedes llenarla ahora o después — sin clave, el sync
        GlobalPC queda en pausa hasta que la agregues.
      </div>

      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <AguilaInput
            label="company_id (slug)"
            mono
            required
            value={companyId}
            onChange={(e) =>
              setCompanyId(e.target.value.toLowerCase().slice(0, 40))
            }
            placeholder="acme-sa"
            aria-invalid={!slugValid}
          />
          <AguilaInput
            label="Clave GlobalPC"
            mono
            value={claveCliente}
            onChange={(e) =>
              setClaveCliente(e.target.value.replace(/\D/g, '').slice(0, 10))
            }
            placeholder="1234"
            aria-invalid={!claveValid}
          />
          <AguilaSelect
            label="Idioma"
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'es' | 'en')}
            options={[
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>

        {!slugValid && companyId ? (
          <div
            role="alert"
            style={{
              fontSize: 'var(--portal-fs-sm)',
              color: 'var(--portal-status-amber-fg)',
            }}
          >
            El slug debe tener 3–40 caracteres, solo letras/números y
            guiones entre segmentos.
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            style={{
              fontSize: 'var(--portal-fs-sm)',
              color: 'var(--portal-status-red-fg)',
            }}
          >
            Error: {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className="portal-btn portal-btn--primary"
            disabled={!canSubmit}
            style={{
              minHeight: 44,
              padding: '0 20px',
              fontSize: 'var(--portal-fs-sm)',
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            {submitting ? (
              <>
                <Clock
                  size={14}
                  strokeWidth={2.2}
                  style={{ marginRight: 6 }}
                />
                Creando tenant…
              </>
            ) : (
              'Crear tenant'
            )}
          </button>
        </div>
      </form>
    </GlassCard>
  )
}
