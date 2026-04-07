'use client'

import { COLORS } from './types'

export default function DrivingModeBadge() {
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      backgroundColor: 'rgba(34,197,94,0.15)',
      border: `1px solid ${COLORS.green}`,
      borderRadius: 20,
      animation: 'drivingPulse 2s ease-in-out infinite',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2">
        <path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2M5 17l-1 3m16-3 1 3" />
        <circle cx="7.5" cy="17" r="1.5" />
        <circle cx="16.5" cy="17" r="1.5" />
      </svg>
      <span style={{ color: COLORS.green, fontSize: 12, fontWeight: 600 }}>
        Modo Conducci&oacute;n
      </span>
    </div>
  )
}
