'use client'

import { useMemo, useState } from 'react'
import * as LucideIcons from 'lucide-react'
import { Activity } from 'lucide-react'
import {
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'
import { useTrack } from '@/lib/telemetry/useTrack'
import {
  EVENT_CATEGORY_COLORS,
  getCurrentState,
  getSuggestedActions,
  resolveEventColor,
  type Category,
} from '@/lib/events-catalog'
import type { EventRow } from '../types'

type LucideIconName = keyof typeof LucideIcons

type FilterMode = 'all' | 'mine' | 'critical'

interface CronologiaTabProps {
  traficoId: string
  events: EventRow[]
  currentUserId: string
}

function isCritical(row: EventRow): boolean {
  if (row.category === 'exception') return true
  if (row.category === 'inspection' && row.color_token === 'RED') return true
  return false
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const mins = totalMinutes % 60
  return `${days} día${days === 1 ? '' : 's'} ${hours} hora${hours === 1 ? '' : 's'} ${mins} minuto${mins === 1 ? '' : 's'}`
}

function resolveIcon(
  name: string | null | undefined,
): React.ComponentType<{ size?: number; style?: React.CSSProperties }> | null {
  if (!name) return null
  const pascal = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  const key = pascal as LucideIconName
  const Comp = LucideIcons[key] as unknown
  if (typeof Comp === 'function' || (typeof Comp === 'object' && Comp !== null)) {
    return Comp as React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  }
  return null
}

export function CronologiaTab({ traficoId, events, currentUserId }: CronologiaTabProps) {
  const [filter, setFilter] = useState<FilterMode>('all')
  const [openEvent, setOpenEvent] = useState<EventRow | null>(null)
  const track = useTrack()

  const filtered = useMemo(() => {
    if (filter === 'mine') {
      return events.filter((e) => {
        const actor = (e.payload as { actor?: string } | null)?.actor
        return actor === currentUserId
      })
    }
    if (filter === 'critical') {
      return events.filter(isCritical)
    }
    return events
  }, [events, filter, currentUserId])

  const totalDuration = useMemo(() => {
    if (events.length < 2) return null
    const sorted = [...events].sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    const first = new Date(sorted[0].created_at).getTime()
    const last = new Date(sorted[sorted.length - 1].created_at).getTime()
    if (Number.isNaN(first) || Number.isNaN(last)) return null
    return last - first
  }, [events])

  if (events.length === 0) {
    const nextExpected = deriveNextExpected(events)
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          padding: '40px 16px',
          color: TEXT_MUTED,
          background: BG_CARD,
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
        }}
      >
        <Activity size={28} />
        <div style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY, textAlign: 'center', maxWidth: 420 }}>
          Sin eventos registrados. Los eventos aparecerán automáticamente cuando el embarque avance por el sistema.
        </div>
        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 4 }}>
          Último evento esperado: <strong style={{ color: TEXT_SECONDARY }}>{nextExpected}</strong>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Sticky filter bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          display: 'flex',
          gap: 6,
          padding: '8px 0',
          background: 'rgba(255,255,255,0.045)',
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <FilterButton
          active={filter === 'all'}
          onClick={() => {
            setFilter('all')
            track('page_view', {
              entityType: 'trafico_cronologia',
              entityId: traficoId,
              metadata: { event: 'cronologia_filter_changed', filter: 'all' },
            })
          }}
          label="Todos los eventos"
        />
        <FilterButton
          active={filter === 'mine'}
          onClick={() => {
            setFilter('mine')
            track('page_view', {
              entityType: 'trafico_cronologia',
              entityId: traficoId,
              metadata: { event: 'cronologia_filter_changed', filter: 'mine' },
            })
          }}
          label="Solo mi actividad"
        />
        <FilterButton
          active={filter === 'critical'}
          onClick={() => {
            setFilter('critical')
            track('page_view', {
              entityType: 'trafico_cronologia',
              entityId: traficoId,
              metadata: { event: 'cronologia_filter_changed', filter: 'critical' },
            })
          }}
          label="Solo eventos críticos"
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
          Sin eventos que coincidan con el filtro.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((e) => {
            const color = e.category
              ? resolveEventColor({ category: e.category, color_token: e.color_token })
              : EVENT_CATEGORY_COLORS.manual
            const Icon = resolveIcon(e.icon_name)
            const actor = (e.payload as { actor?: string } | null)?.actor ?? 'Sistema'

            return (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  setOpenEvent(e)
                  track('page_view', {
                    entityType: 'trafico_cronologia',
                    entityId: traficoId,
                    metadata: {
                      event: 'cronologia_event_opened',
                      event_type: e.event_type,
                    },
                  })
                }}
                style={{
                  textAlign: 'left',
                  background: BG_CARD,
                  backdropFilter: `blur(${GLASS_BLUR})`,
                  WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
                  borderLeft: `3px solid ${color}`,
                  border: `1px solid ${BORDER}`,
                  borderLeftWidth: 3,
                  borderRadius: 12,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  minHeight: 60,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                {Icon && <Icon size={18} style={{ color, flexShrink: 0, marginTop: 2 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--aguila-fs-body)',
                        fontWeight: 700,
                        color: TEXT_PRIMARY,
                      }}
                    >
                      {e.display_name_es ?? e.event_type}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--aguila-fs-meta)',
                        color: TEXT_MUTED,
                        fontFamily: 'var(--font-mono)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtDateTime(e.created_at)}
                    </span>
                  </div>
                  {e.description_es && (
                    <div style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_SECONDARY, marginTop: 4 }}>
                      {e.description_es}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      marginTop: 6,
                      fontSize: 'var(--aguila-fs-meta)',
                      color: TEXT_MUTED,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{actor}</span>
                    <span>·</span>
                    <span
                      style={{
                        color: e.visibility === 'public' ? TEXT_SECONDARY : TEXT_MUTED,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {e.visibility === 'public' ? 'Público' : 'Privado'}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {totalDuration !== null && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px 0 4px',
            fontSize: 'var(--aguila-fs-meta)',
            color: TEXT_MUTED,
            fontFamily: 'var(--font-mono)',
          }}
        >
          Duración total: {formatDuration(totalDuration)}
        </div>
      )}

      {openEvent && (
        <EventDrawer event={openEvent} onClose={() => setOpenEvent(null)} />
      )}
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 60,
        padding: '0 14px',
        background: active ? 'rgba(192,197,206,0.12)' : 'transparent',
        color: active ? TEXT_PRIMARY : TEXT_MUTED,
        border: `1px solid ${active ? 'rgba(192,197,206,0.4)' : BORDER}`,
        borderRadius: 12,
        fontSize: 'var(--aguila-fs-compact)',
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function EventDrawer({ event, onClose }: { event: EventRow; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,7,11,0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100vw)',
          height: '100%',
          background: 'rgba(255,255,255,0.045)',
          borderLeft: `1px solid ${BORDER}`,
          padding: 24,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontSize: 'var(--aguila-fs-meta)',
            fontWeight: 800,
            color: TEXT_MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 14,
          }}
        >
          {event.display_name_es ?? event.event_type}
        </div>

        <div style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY, marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>
            {fmtDateTime(event.created_at)} · workflow {event.workflow ?? '—'}
          </div>
          {event.description_es && <p style={{ marginTop: 8 }}>{event.description_es}</p>}
        </div>

        <div
          style={{
            fontSize: 'var(--aguila-fs-meta)',
            fontWeight: 700,
            color: TEXT_MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          Payload
        </div>
        <pre
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--aguila-fs-compact)',
            color: TEXT_SECONDARY,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: 'rgba(0,0,0,0.3)',
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
          }}
        >
          {JSON.stringify(event.payload ?? {}, null, 2)}
        </pre>

        <button
          type="button"
          onClick={onClose}
          style={{
            minHeight: 60,
            width: '100%',
            marginTop: 16,
            background: 'rgba(255,255,255,0.05)',
            color: TEXT_PRIMARY,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            fontSize: 'var(--aguila-fs-body)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

function deriveNextExpected(events: EventRow[]): string {
  const hasCreated = events.some((e) => e.event_type === 'trafico_created')
  if (!hasCreated) return 'Embarque creado'
  const currentState = getCurrentState(
    events.map((e) => ({ event_type: e.event_type, created_at: e.created_at })),
  )
  const actions = getSuggestedActions(currentState)
  return actions[0]?.label_es ?? 'Embarque creado'
}

// Re-export the Category type so external modules can share it.
export type { Category }
