'use client'

import Link from 'next/link'
import { Activity } from 'lucide-react'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER, GREEN, AMBER, GOLD,
} from '@/lib/design-system'
import {
  SeverityRibbon, severityFromCount,
  TimelineFeed, type TimelineItem,
} from '@/components/aguila'
import type { DecisionRow } from './types'

interface Props {
  colaCount: number
  feed: DecisionRow[]
}

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  'En Proceso':       { bg: 'rgba(192,197,206,0.12)', fg: ACCENT_SILVER,   label: 'En proceso' },
  'Documentacion':    { bg: 'rgba(148,163,184,0.12)', fg: TEXT_SECONDARY,  label: 'Documentación' },
  'En Aduana':        { bg: 'rgba(148,163,184,0.12)', fg: TEXT_SECONDARY,  label: 'En aduana' },
  'Pedimento Pagado': { bg: 'rgba(34,197,94,0.12)',   fg: GREEN,           label: 'Pagado' },
  'Cruzado':          { bg: 'rgba(34,197,94,0.12)',   fg: GREEN,           label: 'Cruzado' },
}

function StatusPill({ label }: { label: string | null }) {
  const c = (label && STATUS_PILL[label]) || { bg: 'rgba(148,163,184,0.1)', fg: TEXT_MUTED, label: label || '—' }
  return (
    <span style={{
      fontSize: 'var(--aguila-fs-label)', fontWeight: 600,
      padding: '2px 8px', borderRadius: 20,
      background: c.bg, color: c.fg,
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

export function RightRail({ colaCount, feed }: Props) {
  const severity = severityFromCount(colaCount, { warn: 1, crit: 6 })
  const items: TimelineItem[] = feed.slice(0, 5).map((f) => ({
    id: String(f.id),
    title: f.trafico || '—',
    subtitle: f.decision ? truncate(f.decision, 72) : undefined,
    timestamp: f.created_at,
    href: f.trafico ? `/embarques/${encodeURIComponent(f.trafico)}` : undefined,
    accessory: <StatusPill label={f.decision_type} />,
  }))

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {/* Cola de excepciones */}
      <section style={{
        position: 'relative',
        overflow: 'hidden',
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        boxShadow: GLASS_SHADOW,
        padding: '20px 20px 20px 23px',
      }}>
        {colaCount > 0 && <SeverityRibbon tone={severity} />}
        <div style={{
          fontSize: 'var(--aguila-fs-label)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: TEXT_MUTED, margin: 0,
        }}>
          Cola de excepciones
        </div>
        <div style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: 'var(--aguila-fs-kpi-large)',
          fontWeight: 800,
          color: colaCount > 0 ? (severity === 'critical' ? AMBER : GOLD) : TEXT_MUTED,
          margin: '8px 0 12px 0',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {colaCount}
        </div>
        {colaCount > 0 ? (
          <Link
            href="/operador/cola"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              padding: '10px 16px',
              borderRadius: 12,
              background: GOLD,
              color: '#0D0D0C',
              fontWeight: 700,
              fontSize: 'var(--aguila-fs-body)',
              textDecoration: 'none',
              width: '100%',
            }}
          >
            Ver cola →
          </Link>
        ) : (
          <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: 0 }}>
            Sin excepciones pendientes.
          </p>
        )}
      </section>

      {/* Actividad reciente */}
      <section style={{
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        boxShadow: GLASS_SHADOW,
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: items.length > 0 ? 12 : 0 }}>
          <Activity size={14} color={ACCENT_SILVER} />
          <span style={{
            fontSize: 'var(--aguila-fs-label)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: TEXT_MUTED,
          }}>
            Actividad reciente
          </span>
          {items.length > 0 && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: GREEN, boxShadow: `0 0 6px ${GREEN}`, marginLeft: 4,
            }} />
          )}
        </div>
        <TimelineFeed items={items} max={5} emptyLabel="Aún no hay actividad registrada hoy." />
      </section>
    </aside>
  )
}

function truncate(s: string | null, n: number): string {
  if (!s) return '—'
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}
