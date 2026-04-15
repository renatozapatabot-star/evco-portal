'use client'

import Link from 'next/link'
import { Activity } from 'lucide-react'
import { fmtRelativeTime, fmtDateTime } from '@/lib/format-utils'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_MUTED, TEXT_SECONDARY, ACCENT_SILVER,
} from '@/lib/design-system'

export interface ActividadStripItem {
  id: string
  label: string
  detail?: string
  timestamp: string | Date
  href?: string
  tone?: 'silver' | 'warning' | 'danger'
}

interface Props {
  items: ActividadStripItem[]
  emptyLabel?: string
  title?: string
}

/**
 * ZAPATA AI v10 — horizontal activity ticker that sits ABOVE the hero KPIs.
 * Role-scoped content: each cockpit page passes role-appropriate items
 * (audit_log events, Mensajería messages, escalations, etc.). Read-only;
 * deeper context lives in the right-rail actividadSlot.
 */
export function ActividadStrip({ items, emptyLabel = 'Sin actividad reciente.', title = 'Actividad reciente' }: Props) {
  const visible = items.slice(0, 12)

  return (
    <section
      aria-label={title}
      style={{
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 'var(--aguila-radius-card, 20px)',
        boxShadow: GLASS_SHADOW,
        padding: '10px 16px',
        marginBottom: 'var(--aguila-gap-card, 16px)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingRight: 12, borderRight: `1px solid ${BORDER}` }}>
        <Activity size={12} color={ACCENT_SILVER} />
        <span style={{
          fontSize: 'var(--aguila-fs-label, 10px)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 'var(--aguila-ls-label, 0.08em)',
          color: TEXT_MUTED,
        }}>{title}</span>
      </div>
      {visible.length === 0 ? (
        <span style={{ fontSize: 12, color: TEXT_MUTED }}>{emptyLabel}</span>
      ) : (
        visible.map((it) => <Chip key={it.id} item={it} />)
      )}
    </section>
  )
}

function Chip({ item }: { item: ActividadStripItem }) {
  const rel = fmtRelativeTime(item.timestamp)
  const abs = fmtDateTime(item.timestamp)
  const toneColor =
    item.tone === 'warning' ? '#FBBF24'
    : item.tone === 'danger' ? '#EF4444'
    : ACCENT_SILVER

  const body = (
    <span
      title={abs}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${BORDER}`,
        fontSize: 12,
        color: TEXT_SECONDARY,
        cursor: item.href ? 'pointer' : 'default',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      <span aria-hidden style={{
        width: 6, height: 6, borderRadius: '50%',
        background: toneColor,
        boxShadow: `0 0 6px ${toneColor}66`,
        flexShrink: 0,
      }} />
      <span style={{ color: '#E6EDF3', fontWeight: 600 }}>{item.label}</span>
      {item.detail ? <span style={{ color: TEXT_MUTED }}>· {item.detail}</span> : null}
      <span style={{
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: 10,
        color: TEXT_MUTED,
        marginLeft: 4,
      }}>{rel}</span>
    </span>
  )

  if (!item.href) return body
  return <Link href={item.href} style={{ textDecoration: 'none', display: 'inline-flex', flexShrink: 0 }}>{body}</Link>
}
