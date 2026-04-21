'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { BG_CARD, BORDER, TEXT_MUTED } from '@/lib/design-system'

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  badge?: string | number
  hidden?: boolean
}

export function CollapsibleSection({ title, defaultOpen = false, children, badge, hidden }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  if (hidden) return null

  return (
    <div style={{
      background: BG_CARD,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid ${BORDER}`,
      borderRadius: 20,
      overflow: 'hidden',
      marginTop: 16,
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: TEXT_MUTED,
          minHeight: 60,
        }}
      >
        <span style={{
          fontSize: 'var(--aguila-fs-meta)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {title}
          {badge !== undefined && (
            <span style={{
              marginLeft: 8,
              fontSize: 'var(--aguila-fs-meta)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--portal-fg-4)',
            }}>
              {badge}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          {children}
        </div>
      )}
    </div>
  )
}
