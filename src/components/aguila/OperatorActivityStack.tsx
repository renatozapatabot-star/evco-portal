'use client'

import Link from 'next/link'
import { Pin } from 'lucide-react'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, AMBER, ACCENT_SILVER } from '@/lib/design-system'
import { fmtRelativeTime, fmtDateTime } from '@/lib/format-utils'
import { TimelineFeed, type TimelineItem } from './TimelineFeed'
import type { MensajeriaMessage, MensajeriaThread } from '@/lib/mensajeria/feed'

interface Props {
  auditItems: TimelineItem[]
  messages: MensajeriaMessage[]
  pinnedThreads: MensajeriaThread[]
  emptyLabel?: string
}

/**
 * Operator Actividad Reciente: escalated threads pinned at top, then an
 * interleaved (by timestamp) feed of audit_log events + Mensajería messages.
 */
export function OperatorActivityStack({ auditItems, messages, pinnedThreads, emptyLabel = 'Sin actividad reciente.' }: Props) {
  // Merge audit + messages into one timeline, sorted desc.
  const msgAsItems: TimelineItem[] = messages.slice(0, 10).map((m) => ({
    id: `msg-${m.id}`,
    title: `💬 ${m.sender_display_name ?? 'Mensaje'}`,
    subtitle: m.body.length > 80 ? `${m.body.slice(0, 77)}…` : m.body,
    timestamp: m.created_at,
  }))
  const merged: TimelineItem[] = [...auditItems, ...msgAsItems]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {pinnedThreads.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Pin size={11} color={AMBER} />
            <span style={{
              fontSize: 'var(--aguila-fs-label, 10px)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 'var(--aguila-ls-label, 0.08em)',
              color: AMBER,
            }}>
              Hilos escalados
            </span>
          </div>
          {pinnedThreads.slice(0, 3).map((t) => (
            <Link key={t.id} href={`/mensajeria/${encodeURIComponent(t.id)}`} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.15)',
              textDecoration: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.subject ?? t.id}
                </span>
                {t.escalated_at ? (
                  <span title={fmtDateTime(t.escalated_at)} style={{
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: 10, color: TEXT_MUTED, flexShrink: 0,
                  }}>
                    {fmtRelativeTime(t.escalated_at)}
                  </span>
                ) : null}
              </div>
              {t.last_message_preview ? (
                <span style={{ fontSize: 11, color: TEXT_SECONDARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.last_message_preview}
                </span>
              ) : null}
              <span style={{ fontSize: 10, color: ACCENT_SILVER }}>
                Ver hilo →
              </span>
            </Link>
          ))}
        </div>
      ) : null}
      <TimelineFeed items={merged} max={10} emptyLabel={emptyLabel} />
    </div>
  )
}
