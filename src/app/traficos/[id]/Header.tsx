import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { fmtDateTime } from '@/lib/format-utils'
import {
  ACCENT_CYAN,
  AMBER,
  RED,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import {
  EVENT_CATEGORY_COLORS,
  getCurrentState,
  type EventCatalogRow,
} from '@/lib/events-catalog'
import type { EventRow } from './types'

function daysBetween(from: string | null | undefined, to: Date = new Date()): number | null {
  if (!from) return null
  const ms = to.getTime() - new Date(from).getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.floor(ms / 86_400_000))
}

function daysColor(days: number | null): string {
  if (days === null) return TEXT_MUTED
  if (days > 14) return RED
  if (days > 7) return AMBER
  return TEXT_MUTED
}

interface HeaderProps {
  traficoNumber: string
  cliente: string
  patente: string | null
  aduana: string | null
  tipoOperacion: string | null
  events: EventRow[]
  createdAt: string | null
}

/**
 * Detail header. Cubre la tres-standards:
 *   · 11 PM Executive — estatus pill + días activos visibles en 3 s.
 *   · SAT Audit — patente + aduana + tipo de operación siempre arriba.
 *   · 3 AM Driver — número de tráfico en JetBrains Mono 32px.
 */
export function Header({
  traficoNumber,
  cliente,
  patente,
  aduana,
  tipoOperacion,
  events,
  createdAt,
}: HeaderProps) {
  const currentState = getCurrentState(
    events.map((e) => ({ event_type: e.event_type, created_at: e.created_at })),
  )
  const currentEvent = events.find((e) => e.event_type === currentState) ?? null

  const stateLabel = currentEvent?.display_name_es ?? 'Sin eventos'
  const stateColor = currentEvent?.category
    ? EVENT_CATEGORY_COLORS[currentEvent.category]
    : ACCENT_CYAN

  const days = daysBetween(createdAt)
  const daysFg = daysColor(days)

  const latestTs = events[0]?.created_at ?? null

  const subtitleParts = [
    cliente,
    patente ? `Patente ${patente}` : null,
    aduana ? `Aduana ${aduana}` : null,
    tipoOperacion ?? null,
  ].filter(Boolean)

  return (
    <div style={{ marginBottom: 20 }}>
      <Link
        href="/traficos"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: TEXT_MUTED,
          textDecoration: 'none',
          minHeight: 60,
          lineHeight: '60px',
        }}
      >
        <ArrowLeft size={14} /> Tráficos
      </Link>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginTop: 4,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 32,
            fontWeight: 800,
            color: TEXT_PRIMARY,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          {traficoNumber}
        </h1>

        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: stateColor,
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${stateColor}66`,
            padding: '4px 10px',
            borderRadius: 999,
          }}
        >
          {stateLabel}
        </span>

        {days !== null && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: daysFg,
            }}
          >
            {days} día{days === 1 ? '' : 's'} activo
          </span>
        )}

        {latestTs && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: TEXT_MUTED,
            }}
          >
            Últ. evento: {fmtDateTime(latestTs)}
          </span>
        )}
      </div>

      {subtitleParts.length > 0 && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: TEXT_MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginTop: 6,
          }}
        >
          {subtitleParts.join(' · ')}
        </div>
      )}
    </div>
  )
}

// Type import helper — avoids an unused import lint warning for a type
// that is only referenced conceptually in this file's docstring.
export type { EventCatalogRow }
