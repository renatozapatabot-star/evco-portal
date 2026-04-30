'use client'

/**
 * Timeline of every event on a lead: stage changes, field edits, calls,
 * notes, emails, meetings. Plus an inline "Registrar actividad" form for
 * manual logging.
 *
 * Server passes initialActivities so we avoid a fetch-on-mount flicker.
 * After a manual log succeeds, we optimistically prepend the new row.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  Clock,
  Phone,
  Mail,
  MailOpen,
  Users,
  FileText,
  ExternalLink,
  ArrowRight,
  Settings,
} from 'lucide-react'
import { GlassCard, AguilaSelect, AguilaTextarea } from '@/components/aguila'
import {
  LEAD_ACTIVITY_KIND_LABELS,
  MANUAL_ACTIVITY_KINDS,
  type LeadActivityKind,
  type LeadActivityRow,
} from '@/lib/leads/types'

interface Props {
  leadId: string
  initialActivities: LeadActivityRow[]
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Chicago',
    })
  } catch {
    return iso
  }
}

function fmtDayLabel(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const rowDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDays = Math.round(
      (today.getTime() - rowDay.getTime()) / 86_400_000,
    )
    if (diffDays === 0) return 'Hoy'
    if (diffDays === 1) return 'Ayer'
    if (diffDays < 7) {
      return d.toLocaleDateString('es-MX', { weekday: 'long' })
    }
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Chicago',
    })
  } catch {
    return iso
  }
}

// Map kind → icon + tone tint for the timeline dot.
const KIND_ICON: Record<
  LeadActivityKind,
  { Icon: typeof Check; fg: string; bg: string }
> = {
  stage_change: {
    Icon: ArrowRight,
    fg: 'var(--portal-status-green-fg)',
    bg: 'var(--portal-status-green-bg)',
  },
  field_update: {
    Icon: Settings,
    fg: 'var(--portal-fg-3)',
    bg: 'var(--portal-ink-3)',
  },
  note: {
    Icon: FileText,
    fg: 'var(--portal-fg-2)',
    bg: 'var(--portal-ink-3)',
  },
  call: {
    Icon: Phone,
    fg: 'var(--portal-status-amber-fg)',
    bg: 'var(--portal-status-amber-bg)',
  },
  email_sent: {
    Icon: Mail,
    fg: 'var(--portal-fg-3)',
    bg: 'var(--portal-ink-3)',
  },
  email_received: {
    Icon: MailOpen,
    fg: 'var(--portal-fg-3)',
    bg: 'var(--portal-ink-3)',
  },
  meeting: {
    Icon: Users,
    fg: 'var(--portal-status-amber-fg)',
    bg: 'var(--portal-status-amber-bg)',
  },
  demo_sent: {
    Icon: ExternalLink,
    fg: 'var(--portal-status-green-fg)',
    bg: 'var(--portal-status-green-bg)',
  },
  system: {
    Icon: Check,
    fg: 'var(--portal-fg-4)',
    bg: 'var(--portal-ink-3)',
  },
}

function groupByDay(
  rows: LeadActivityRow[],
): Array<{ day: string; items: LeadActivityRow[] }> {
  const groups = new Map<string, LeadActivityRow[]>()
  for (const row of rows) {
    try {
      const d = new Date(row.occurred_at)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const existing = groups.get(key)
      if (existing) existing.push(row)
      else groups.set(key, [row])
    } catch {
      const existing = groups.get('unknown')
      if (existing) existing.push(row)
      else groups.set('unknown', [row])
    }
  }
  return Array.from(groups.entries()).map(([, items]) => ({
    day: fmtDayLabel(items[0]?.occurred_at ?? new Date().toISOString()),
    items,
  }))
}

const DEFAULT_KIND: LeadActivityKind = 'call'

export function LeadActivityTimeline({ leadId, initialActivities }: Props) {
  const router = useRouter()
  const [activities, setActivities] =
    useState<LeadActivityRow[]>(initialActivities)
  const [formOpen, setFormOpen] = useState(false)
  const [kind, setKind] = useState<LeadActivityKind>(DEFAULT_KIND)
  const [summary, setSummary] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)

  const grouped = useMemo(() => groupByDay(activities), [activities])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = summary.trim()
    if (!trimmed) {
      setError('Escribe un resumen breve.')
      return
    }
    setSubmitting(true)
    try {
      const csrfToken =
        typeof document !== 'undefined'
          ? document.cookie.match(/csrf_token=([^;]+)/)?.[1] ?? ''
          : ''
      const res = await fetch(`/api/leads/${leadId}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          kind,
          summary: trimmed,
          occurred_at: occurredAt
            ? new Date(occurredAt).toISOString()
            : undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.error) {
        setError(body?.error?.message ?? 'save_failed')
        return
      }
      if (body?.data) {
        setActivities((prev) => [body.data as LeadActivityRow, ...prev])
        setSummary('')
        setOccurredAt('')
        setKind(DEFAULT_KIND)
        setFormOpen(false)
        setFlash(true)
        setTimeout(() => setFlash(false), 1400)
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
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div
          className="portal-eyebrow"
          style={{
            fontSize: 'var(--portal-fs-label)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--portal-fg-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Actividad
          {flash ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 'var(--portal-fs-tiny)',
                color: 'var(--portal-status-green-fg)',
                marginLeft: 4,
              }}
            >
              <Check size={12} strokeWidth={2.5} />
              Registrado
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className={
            formOpen ? 'portal-btn portal-btn--ghost' : 'portal-btn portal-btn--primary'
          }
          style={{ minHeight: 36, padding: '0 14px', fontSize: 'var(--portal-fs-sm)' }}
        >
          {formOpen ? 'Cancelar' : 'Registrar actividad'}
        </button>
      </div>

      {formOpen ? (
        <form
          onSubmit={submit}
          style={{
            display: 'grid',
            gap: 12,
            padding: 16,
            borderRadius: 'var(--portal-r-3)',
            background: 'var(--portal-ink-3)',
            border: '1px solid var(--portal-line-2)',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(160px, 220px) minmax(200px, 260px)',
              gap: 12,
            }}
          >
            <AguilaSelect
              label="Tipo"
              value={kind}
              onChange={(e) => setKind(e.target.value as LeadActivityKind)}
              options={MANUAL_ACTIVITY_KINDS.map((k) => ({
                value: k,
                label: LEAD_ACTIVITY_KIND_LABELS[k],
              }))}
            />
            <div>
              <label
                className="portal-label"
                style={{ display: 'block', marginBottom: 6 }}
              >
                Cuándo (opcional)
              </label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="portal-input"
                style={{ fontFamily: 'var(--portal-font-mono)', width: '100%' }}
              />
            </div>
          </div>
          <AguilaTextarea
            label="Resumen"
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Ej. Llamada 15 min — decidió agendar demo el viernes a las 10 AM"
          />
          {error ? (
            <div
              role="alert"
              style={{
                fontSize: 'var(--portal-fs-sm)',
                color: 'var(--portal-status-red-fg)',
              }}
            >
              {error}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="portal-btn portal-btn--primary"
              disabled={submitting}
              style={{ minHeight: 40, padding: '0 18px' }}
            >
              {submitting ? (
                <>
                  <Clock size={14} strokeWidth={2.2} style={{ marginRight: 6 }} />
                  Guardando…
                </>
              ) : (
                'Guardar'
              )}
            </button>
          </div>
        </form>
      ) : null}

      {grouped.length === 0 ? (
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            fontSize: 'var(--portal-fs-sm)',
            color: 'var(--portal-fg-4)',
          }}
        >
          Aún sin actividad. Registra tu primera llamada, email o nota para
          empezar el histórico.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {grouped.map((g) => (
            <div key={g.day}>
              <div
                style={{
                  fontSize: 'var(--portal-fs-tiny)',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--portal-fg-4)',
                  marginBottom: 8,
                  fontFamily: 'var(--portal-font-mono)',
                }}
              >
                {g.day}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {g.items.map((a) => {
                  const meta = KIND_ICON[a.kind] ?? KIND_ICON.system
                  const { Icon } = meta
                  return (
                    <div
                      key={a.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 1fr auto',
                        gap: 12,
                        alignItems: 'start',
                        padding: '8px 4px',
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          background: meta.bg,
                          color: meta.fg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={14} strokeWidth={2.2} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 'var(--portal-fs-sm)',
                            color: 'var(--portal-fg-1)',
                            lineHeight: 1.4,
                          }}
                        >
                          {a.summary}
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--portal-fs-tiny)',
                            color: 'var(--portal-fg-4)',
                            marginTop: 2,
                          }}
                        >
                          {LEAD_ACTIVITY_KIND_LABELS[a.kind] ?? a.kind}
                          {a.actor_name ? ` · ${a.actor_name}` : ''}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--portal-fs-tiny)',
                          color: 'var(--portal-fg-4)',
                          fontFamily: 'var(--portal-font-mono)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fmtDateTime(a.occurred_at)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}
