'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock } from 'lucide-react'
import {
  GlassCard,
  AguilaInput,
  AguilaTextarea,
  AguilaSelect,
  AguilaMetric,
} from '@/components/aguila'
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_SOURCE_LABELS,
  type LeadRow,
  type LeadStage,
  type LeadSource,
} from '@/lib/leads/types'

interface Props {
  initialLead: LeadRow
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Chicago',
    })
  } catch {
    return '—'
  }
}

function toInputDateTime(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    // datetime-local expects YYYY-MM-DDTHH:MM (local, no timezone suffix)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

export function LeadDetailClient({ initialLead }: Props) {
  const router = useRouter()
  const [lead, setLead] = useState<LeadRow>(initialLead)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveFlash, setSaveFlash] = useState<string | null>(null)
  const [_isPending, startTransition] = useTransition()

  // Local form state
  const [contactName, setContactName] = useState(lead.contact_name ?? '')
  const [contactEmail, setContactEmail] = useState(lead.contact_email ?? '')
  const [contactPhone, setContactPhone] = useState(lead.contact_phone ?? '')
  const [rfc, setRfc] = useState(lead.rfc ?? '')
  const [valueMonthly, setValueMonthly] = useState(
    lead.value_monthly_mxn != null ? String(lead.value_monthly_mxn) : '',
  )
  const [nextActionAt, setNextActionAt] = useState(
    toInputDateTime(lead.next_action_at),
  )
  const [nextActionNote, setNextActionNote] = useState(
    lead.next_action_note ?? '',
  )
  const [notes, setNotes] = useState(lead.notes ?? '')

  async function patch(payload: Record<string, unknown>, fieldKey: string) {
    setSaving(fieldKey)
    setError(null)
    try {
      const csrfToken =
        typeof document !== 'undefined'
          ? document.cookie.match(/csrf_token=([^;]+)/)?.[1] ?? ''
          : ''
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.error) {
        setError(body?.error?.message ?? 'update_failed')
        return false
      }
      if (body?.data) {
        setLead(body.data as LeadRow)
        setSaveFlash(fieldKey)
        setTimeout(() => setSaveFlash(null), 1400)
        startTransition(() => router.refresh())
      }
      return true
    } catch {
      setError('network_error')
      return false
    } finally {
      setSaving(null)
    }
  }

  function savedBadge(fieldKey: string) {
    if (saveFlash !== fieldKey) return null
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 'var(--portal-fs-tiny)',
          color: 'var(--portal-status-green-fg)',
          marginLeft: 8,
        }}
      >
        <Check size={12} strokeWidth={2.5} />
        Guardado
      </span>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Hero metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
        }}
      >
        <AguilaMetric
          label="Etapa actual"
          value={LEAD_STAGE_LABELS[lead.stage] ?? lead.stage}
          sub={
            lead.stage_changed_at
              ? `desde ${fmtDate(lead.stage_changed_at)}`
              : undefined
          }
          mono={false}
          tone={
            lead.stage === 'won'
              ? 'positive'
              : lead.stage === 'lost'
              ? 'negative'
              : lead.stage === 'demo-viewed' || lead.stage === 'demo-booked'
              ? 'attention'
              : 'neutral'
          }
        />
        <AguilaMetric
          label="Fuente"
          value={LEAD_SOURCE_LABELS[lead.source as LeadSource] ?? lead.source}
          sub={lead.source_campaign ?? undefined}
          mono={false}
        />
        <AguilaMetric
          label="Capturado"
          value={fmtDate(lead.created_at).split(',')[0] ?? '—'}
          sub={`ID ${lead.id.slice(0, 8)}`}
          mono={false}
        />
        <AguilaMetric
          label="Último contacto"
          value={
            lead.last_contact_at
              ? fmtDate(lead.last_contact_at).split(',')[0] ?? '—'
              : '—'
          }
          mono={false}
          tone={lead.last_contact_at ? 'neutral' : 'attention'}
          sub={lead.last_contact_at ? undefined : 'Aún sin tocar'}
        />
      </div>

      {error ? (
        <GlassCard
          tier="hero"
          padding="12px 16px"
          style={{
            borderColor: 'var(--portal-status-red-ring)',
            background: 'var(--portal-status-red-bg)',
            color: 'var(--portal-status-red-fg)',
            fontSize: 'var(--portal-fs-sm)',
          }}
        >
          Error: {error}
        </GlassCard>
      ) : null}

      {/* Stage transition buttons */}
      <GlassCard tier="hero" padding={20}>
        <div
          className="portal-eyebrow"
          style={{
            fontSize: 'var(--portal-fs-label)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--portal-fg-4)',
            marginBottom: 12,
          }}
        >
          Cambiar etapa
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {LEAD_STAGES.map((s) => {
            const active = s === lead.stage
            return (
              <button
                key={s}
                type="button"
                onClick={() => patch({ stage: s }, `stage:${s}`)}
                disabled={saving === `stage:${s}`}
                className={
                  active
                    ? 'portal-btn portal-btn--primary'
                    : 'portal-btn portal-btn--ghost'
                }
                style={{
                  minHeight: 44,
                  padding: '0 14px',
                  fontSize: 'var(--portal-fs-sm)',
                  opacity: saving === `stage:${s}` ? 0.6 : 1,
                }}
              >
                {LEAD_STAGE_LABELS[s]}
                {saving === `stage:${s}` ? (
                  <Clock
                    size={14}
                    strokeWidth={2.2}
                    aria-label="Guardando"
                    style={{ marginLeft: 6, opacity: 0.6 }}
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      </GlassCard>

      {/* Next action */}
      <GlassCard tier="hero" padding={20}>
        <div
          className="portal-eyebrow"
          style={{
            fontSize: 'var(--portal-fs-label)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--portal-fg-4)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Próxima acción
          {savedBadge('next_action')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 280px) 1fr',
            gap: 12,
            alignItems: 'start',
          }}
        >
          <div>
            <label
              className="portal-label"
              style={{ display: 'block', marginBottom: 6 }}
            >
              Fecha + hora
            </label>
            <input
              type="datetime-local"
              value={nextActionAt}
              onChange={(e) => setNextActionAt(e.target.value)}
              onBlur={() =>
                patch(
                  {
                    next_action_at: nextActionAt
                      ? new Date(nextActionAt).toISOString()
                      : null,
                  },
                  'next_action',
                )
              }
              className="portal-input"
              style={{ fontFamily: 'var(--portal-font-mono)' }}
            />
          </div>
          <AguilaTextarea
            label="Nota"
            rows={3}
            value={nextActionNote}
            onChange={(e) => setNextActionNote(e.target.value)}
            onBlur={() => patch({ next_action_note: nextActionNote }, 'next_action')}
            placeholder="Ej. Llamar antes del viernes, antes de la junta de comité"
          />
        </div>
      </GlassCard>

      {/* Contact details */}
      <GlassCard tier="hero" padding={20}>
        <div
          className="portal-eyebrow"
          style={{
            fontSize: 'var(--portal-fs-label)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--portal-fg-4)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Contacto
          {savedBadge('contact')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          <AguilaInput
            label="Nombre del contacto"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            onBlur={() => patch({ contact_name: contactName }, 'contact')}
          />
          <AguilaInput
            label="Correo"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            onBlur={() => patch({ contact_email: contactEmail }, 'contact')}
          />
          <AguilaInput
            label="Teléfono / WhatsApp"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            onBlur={() => patch({ contact_phone: contactPhone }, 'contact')}
          />
          <AguilaInput
            label="RFC"
            mono
            maxLength={13}
            value={rfc}
            onChange={(e) => setRfc(e.target.value.toUpperCase())}
            onBlur={() => patch({ rfc }, 'contact')}
          />
        </div>
      </GlassCard>

      {/* Deal shape + priority */}
      <GlassCard tier="hero" padding={20}>
        <div
          className="portal-eyebrow"
          style={{
            fontSize: 'var(--portal-fs-label)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--portal-fg-4)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Forma del deal
          {savedBadge('deal')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <AguilaInput
            label="Valor mensual estimado (MXN)"
            type="number"
            mono
            value={valueMonthly}
            onChange={(e) => setValueMonthly(e.target.value)}
            onBlur={() =>
              patch(
                {
                  value_monthly_mxn: valueMonthly.trim()
                    ? Number(valueMonthly)
                    : null,
                },
                'deal',
              )
            }
          />
          <AguilaSelect
            label="Prioridad"
            value={lead.priority}
            onChange={(e) =>
              patch({ priority: e.target.value }, 'deal')
            }
            options={[
              { value: 'high', label: 'Alta' },
              { value: 'normal', label: 'Normal' },
              { value: 'low', label: 'Baja' },
            ]}
          />
        </div>
      </GlassCard>

      {/* Notes */}
      <GlassCard tier="hero" padding={20}>
        <div
          className="portal-eyebrow"
          style={{
            fontSize: 'var(--portal-fs-label)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--portal-fg-4)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Notas libres
          {savedBadge('notes')}
        </div>
        <AguilaTextarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => patch({ notes }, 'notes')}
          rows={6}
          placeholder="Contexto, últimas conversaciones, objeciones, stakeholders…"
        />
      </GlassCard>
    </div>
  )
}
