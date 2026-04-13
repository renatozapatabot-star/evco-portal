'use client'

import { GREEN, AMBER, RED, TEXT_SECONDARY, TEXT_MUTED } from '@/lib/design-system'

type Status = 'healthy' | 'warning' | 'critical'

const STATUS_COLOR: Record<Status, string> = {
  healthy: GREEN,
  warning: AMBER,
  critical: RED,
}

interface Props {
  status: Status
  timestamp: string
  summary: string
}

export function StateOfDayStrip({ status, timestamp, summary }: Props) {
  const color = STATUS_COLOR[status]
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 32,
        padding: '0 4px',
        fontSize: 12,
        color: TEXT_SECONDARY,
      }}
    >
      <span
        aria-hidden
        className="aguila-sod-dot"
        style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color,
          boxShadow: `0 0 10px ${color}99`,
          flexShrink: 0,
        }}
      />
      <span style={{
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: 11, color: TEXT_MUTED,
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}>
        {timestamp}
      </span>
      <span style={{
        fontSize: 12, color: TEXT_SECONDARY,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        minWidth: 0,
      }}>
        {summary}
      </span>
      <style jsx>{`
        @keyframes aguila-sod-dot {
          0%, 100% { opacity: 1;   transform: scale(1); }
          50%      { opacity: 0.6; transform: scale(1.2); }
        }
        .aguila-sod-dot { animation: aguila-sod-dot 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .aguila-sod-dot { animation: none; }
        }
      `}</style>
    </div>
  )
}
