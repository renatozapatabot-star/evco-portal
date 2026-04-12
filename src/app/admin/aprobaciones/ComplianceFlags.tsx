'use client'

import { AlertTriangle, CheckCircle } from 'lucide-react'

interface Props {
  flags: string[]
}

export function ComplianceFlags({ flags }: Props) {
  if (flags.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px',
        background: 'rgba(34,197,94,0.06)',
        border: '1px solid rgba(34,197,94,0.15)',
        borderRadius: 12,
      }}>
        <CheckCircle size={16} color="#22C55E" />
        <span style={{ fontSize: 13, color: '#22C55E', fontWeight: 600 }}>
          Sin alertas de cumplimiento
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {flags.map((flag, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 12px',
          borderLeft: '3px solid #FBBF24',
          background: 'rgba(251,191,36,0.04)',
          borderRadius: '0 8px 8px 0',
        }}>
          <AlertTriangle size={14} color="#FBBF24" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: '#E6EDF3', lineHeight: 1.5 }}>
            {flag}
          </span>
        </div>
      ))}
    </div>
  )
}
