'use client'

import Link from 'next/link'
import { Activity } from 'lucide-react'
import {
  TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER, GREEN, AMBER, GOLD,
} from '@/lib/design-system'
import {
  GlassCard,
  severityFromCount,
  TimelineFeed, type TimelineItem,
} from '@/components/aguila'
import type { DecisionRow } from './types'

interface Props {
  colaCount: number
  feed: DecisionRow[]
}

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  'En Proceso':       { bg: 'rgba(192,197,206,0.12)', fg: ACCENT_SILVER,   label: 'En proceso' },
  'Documentacion':    { bg: 'var(--portal-status-gray-bg)', fg: TEXT_SECONDARY,  label: 'Documentación' },
  'En Aduana':        { bg: 'var(--portal-status-gray-bg)', fg: TEXT_SECONDARY,  label: 'En aduana' },
  'Pedimento Pagado': { bg: 'var(--portal-status-green-bg)',   fg: GREEN,           label: 'Pagado' },
  'Cruzado':          { bg: 'var(--portal-status-green-bg)',   fg: GREEN,           label: 'Cruzado' },
}

function StatusPill({ label }: { label: string | null }) {
  const c = (label && STATUS_PILL[label]) || { bg: 'var(--portal-status-gray-bg)', fg: TEXT_MUTED, label: label || '—' }
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
      <GlassCard tier="hero" severity={colaCount > 0 ? severity : undefined}>
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
              color: 'var(--portal-ink-0)',
              fontWeight: 700,
              fontSize: 'var(--aguila-fs-body)',
              textDecoration: 'none',
              width: '100%',
            }}
          >
            Ver cola →
          </Link>
        ) : (
          <p style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_SECONDARY, margin: 0 }}>
            Sin excepciones pendientes.
          </p>
        )}
      </GlassCard>

      {/* Actividad reciente */}
      <GlassCard tier="hero" padding="16px 20px">
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
      </GlassCard>
    </aside>
  )
}

function truncate(s: string | null, n: number): string {
  if (!s) return '—'
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}
