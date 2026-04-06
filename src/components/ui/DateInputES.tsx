'use client'

import { fmtDate } from '@/lib/format-utils'

interface DateInputESProps {
  value: string
  onChange: (value: string) => void
  style?: React.CSSProperties
}

/**
 * Spanish-localized date input.
 * Wraps native <input type="date"> with a visible Spanish-formatted label.
 * Native picker handles selection; label shows "06 abr 2026" format.
 */
export function DateInputES({ value, onChange, style }: DateInputESProps) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          height: 32,
          border: '1px solid var(--border-card, #E8E5E0)',
          borderRadius: 6,
          padding: '0 8px',
          fontSize: 11,
          color: value ? 'transparent' : 'var(--text-muted, #9B9B9B)',
          background: 'var(--bg-card, #FFFFFF)',
          fontFamily: 'var(--font-mono)',
          minWidth: 130,
          ...style,
        }}
      />
      {value && (
        <span
          style={{
            position: 'absolute',
            left: 10,
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary, #1A1A1A)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {fmtDate(value)}
        </span>
      )}
    </div>
  )
}
