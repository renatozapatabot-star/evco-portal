'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { fmtRelativeTime, fmtDateTime } from '@/lib/format-utils'
import { ACCENT_SILVER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from '@/lib/design-system'
import type { MensajeriaMessage } from '@/lib/mensajeria/feed'

interface Props {
  messages: MensajeriaMessage[]
  /** When true, subscribe to Realtime on mensajeria_messages (client surface). */
  realtime?: boolean
  /** For realtime filter on client surface. */
  companyId?: string
  emptyLabel?: string
  /** When set (feature flag off), render placeholder instead of the feed. */
  placeholder?: string
  max?: number
}

export function MensajeriaFeed({
  messages, realtime = false, companyId, emptyLabel = 'Sin mensajes recientes.',
  placeholder, max = 10,
}: Props) {
  const [items, setItems] = useState<MensajeriaMessage[]>(messages)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Realtime disabled in v9.2 — Supabase channel reconnects on missing/
  // unauthorized table were causing WebSocket storms. Re-enable after schema
  // + RLS are confirmed in production. See core-invariants rule 35.
  useEffect(() => {
    if (debounceRef.current) return () => { /* noop cleanup */ }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])
  void realtime; void companyId; void max

  if (placeholder) {
    return (
      <div style={{ padding: '32px 8px', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
        {placeholder}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: '32px 8px', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
        {emptyLabel}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
      {items.slice(0, max).map((m) => (
        <MessageBubble key={m.id} msg={m} />
      ))}
    </div>
  )
}

function MessageBubble({ msg }: { msg: MensajeriaMessage }) {
  const abs = fmtDateTime(msg.created_at)
  const rel = fmtRelativeTime(msg.created_at)
  const sender = msg.sender_display_name ?? 'Renato Zapata & Company'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT_SILVER, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sender}
          </span>
          {msg.sender_role ? (
            <span style={{
              fontSize: 9, fontWeight: 700,
              padding: '1px 6px', borderRadius: 999,
              background: 'rgba(192,197,206,0.10)',
              color: TEXT_MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}>
              {msg.sender_role}
            </span>
          ) : null}
        </div>
        <span title={abs} style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: 10, color: TEXT_MUTED, flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {rel}
        </span>
      </div>
      <div style={{
        fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.5,
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        wordBreak: 'break-word',
      }}>
        {msg.body}
      </div>
      {msg.attachment_count && msg.attachment_count > 0 ? (
        <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginLeft: 4 }}>
          📎 {msg.attachment_count} archivo{msg.attachment_count === 1 ? '' : 's'}
        </div>
      ) : null}
    </div>
  )
}
