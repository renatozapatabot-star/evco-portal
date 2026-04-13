'use client'

import Link from 'next/link'
import { fmtRelativeTime, fmtDateTime } from '@/lib/format-utils'
import { ACCENT_SILVER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from '@/lib/design-system'

export interface TimelineItem {
  id: string
  title: string
  subtitle?: string
  timestamp: string | Date
  href?: string
  accessory?: React.ReactNode
}

interface Props {
  items: TimelineItem[]
  max?: number
  emptyLabel?: string
}

export function TimelineFeed({ items, max = 5, emptyLabel = 'Sin actividad registrada.' }: Props) {
  const visible = items.slice(0, max)
  if (visible.length === 0) {
    return <div style={{ color: TEXT_MUTED, fontSize: 12, padding: '16px 0' }}>{emptyLabel}</div>
  }
  return (
    <ol className="aguila-timeline" style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
      <span aria-hidden style={{
        position: 'absolute',
        left: 4, top: 8, bottom: 8,
        width: 0,
        borderLeft: `2px dashed ${ACCENT_SILVER}44`,
      }} />
      {visible.map((item, i) => (
        <li key={item.id} style={{ position: 'relative', paddingLeft: 20, paddingTop: i === 0 ? 0 : 12, paddingBottom: 4 }}>
          <span
            className={i === 0 ? 'aguila-timeline-dot-top' : ''}
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: i === 0 ? 4 : 16,
              width: 10, height: 10,
              borderRadius: '50%',
              background: ACCENT_SILVER,
              boxShadow: i === 0 ? `0 0 10px ${ACCENT_SILVER}AA` : 'none',
            }}
          />
          <Row item={item} />
        </li>
      ))}
      <style jsx>{`
        @keyframes aguila-dot-pulse {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%      { transform: scale(1.18); opacity: 0.72; }
        }
        .aguila-timeline-dot-top { animation: aguila-dot-pulse 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .aguila-timeline-dot-top { animation: none; }
        }
      `}</style>
    </ol>
  )
}

function Row({ item }: { item: TimelineItem }) {
  const abs = fmtDateTime(item.timestamp)
  const rel = fmtRelativeTime(item.timestamp)
  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: 13, fontWeight: 700, color: ACCENT_SILVER,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          minWidth: 0,
        }}>
          {item.title}
        </span>
        <span title={abs} style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: 10, color: TEXT_MUTED, flexShrink: 0,
        }}>
          {rel}
        </span>
      </div>
      {(item.subtitle || item.accessory) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {item.subtitle && (
            <span style={{
              fontSize: 11, color: TEXT_SECONDARY,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, minWidth: 0,
            }}>
              {item.subtitle}
            </span>
          )}
          {item.accessory}
        </div>
      )}
    </div>
  )
  if (!item.href) return body
  return (
    <Link href={item.href} style={{ textDecoration: 'none', color: TEXT_PRIMARY, display: 'block' }}>
      {body}
    </Link>
  )
}
