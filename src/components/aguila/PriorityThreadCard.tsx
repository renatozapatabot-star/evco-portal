'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, AMBER, ACCENT_SILVER } from '@/lib/design-system'
import { fmtRelativeTime, fmtDateTime } from '@/lib/format-utils'
import type { MensajeriaThread } from '@/lib/mensajeria/feed'

export function PriorityThreadsPanel({ threads }: { threads: MensajeriaThread[] }) {
  if (threads.length === 0) return null
  return (
    <div style={{ gridColumn: 'span 2' }}>
      <GlassCard severity="warning" padding="18px 20px" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} color={AMBER} />
          <span style={{
            fontSize: 'var(--aguila-fs-label, 10px)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 'var(--aguila-ls-label, 0.08em)',
            color: AMBER,
          }}>
            Hilos escalados · requieren tu atención
          </span>
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 11, color: TEXT_MUTED,
          }}>
            {threads.length}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {threads.map((t) => (
            <PriorityThreadCard key={t.id} thread={t} />
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

function PriorityThreadCard({ thread }: { thread: MensajeriaThread }) {
  return (
    <Link href={`/mensajeria/${encodeURIComponent(thread.id)}`} style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '10px 12px',
      borderRadius: 12,
      background: 'rgba(251,191,36,0.06)',
      border: '1px solid rgba(251,191,36,0.18)',
      textDecoration: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: TEXT_PRIMARY,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {thread.subject ?? 'Hilo escalado'}
        </span>
        {thread.escalated_at ? (
          <span title={fmtDateTime(thread.escalated_at)} style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 10, color: TEXT_MUTED, flexShrink: 0,
          }}>
            {fmtRelativeTime(thread.escalated_at)}
          </span>
        ) : null}
      </div>
      {thread.company_id ? (
        <span style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: 10, color: TEXT_MUTED, letterSpacing: '0.02em',
        }}>
          {thread.company_id}
        </span>
      ) : null}
      {thread.last_message_preview ? (
        <span style={{
          fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {thread.last_message_preview}
        </span>
      ) : null}
      <span style={{ fontSize: 10, color: ACCENT_SILVER, marginTop: 2 }}>Ver hilo →</span>
    </Link>
  )
}
