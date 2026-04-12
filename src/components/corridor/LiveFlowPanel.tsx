'use client'

// Block 7 · Corridor Map — bottom-left LIVE FLOW panel.
// AguilaMark + 4 metric rows + INTELLIGENCE | AUTOMATION | COMPLIANCE footer.

import { AguilaMark } from '@/components/brand/AguilaMark'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_DIM,
  BG_ELEVATED,
  BORDER_HAIRLINE,
  TEXT_TERTIARY,
} from '@/lib/design-system'

export interface LiveFlowPanelProps {
  shipments: number
  knownPositions: number
  totalPositions: number
}

export function LiveFlowPanel({ shipments, knownPositions, totalPositions }: LiveFlowPanelProps) {
  const visibilityPct = totalPositions > 0
    ? Math.round((knownPositions / totalPositions) * 100)
    : 0

  const rows: Array<{ label: string; value: string }> = [
    { label: 'SHIPMENTS', value: String(shipments) },
    { label: 'BORDERS', value: '2' },
    { label: 'COUNTRIES', value: '2' },
    { label: 'VISIBILITY', value: `${visibilityPct}%` },
  ]

  return (
    <div
      className="aguila-corridor-liveflow"
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        width: 280,
        padding: 20,
        background: BG_ELEVATED,
        border: `1px solid ${BORDER_HAIRLINE}`,
        borderRadius: 20,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 500,
        boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <AguilaMark size={18} tone="silver" />
        <span
          style={{
            fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
            fontSize: 9,
            letterSpacing: '0.18em',
            color: TEXT_TERTIARY,
          }}
        >
          LIVE FLOW
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
                fontSize: 10,
                letterSpacing: '0.14em',
                color: ACCENT_SILVER_DIM,
              }}
            >
              {r.label}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 24,
                fontWeight: 600,
                color: ACCENT_SILVER,
              }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: `1px solid ${BORDER_HAIRLINE}`,
          fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
          fontSize: 9,
          letterSpacing: '0.18em',
          color: TEXT_TERTIARY,
          textAlign: 'center',
        }}
      >
        INTELLIGENCE · AUTOMATION · COMPLIANCE
      </div>
    </div>
  )
}

export default LiveFlowPanel
