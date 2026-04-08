'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { fmtRelativeTime } from '@/lib/format-utils'
import type { PulseItem } from '@/hooks/use-activity-pulse'

interface ActivityPulseSectionProps {
  pulse: PulseItem[]
  loading: boolean
  /** Start collapsed on mobile */
  defaultCollapsed?: boolean
}

export function ActivityPulseSection({ pulse, loading, defaultCollapsed = false }: ActivityPulseSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  if (!loading && pulse.length === 0) return null

  return (
    <div>
      {/* Header — clickable to toggle */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: collapsed ? 0 : 10,
          padding: '8px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--success)',
          boxShadow: '0 0 6px rgba(22,163,74,0.4)',
          animation: 'cruzPulse 2s ease-in-out infinite',
          flexShrink: 0,
        }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', flex: 1, textAlign: 'left' }}>
          RZ trabajando{pulse.length > 0 ? ` (${pulse.length})` : ''}
        </div>
        {collapsed ? (
          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        )}
      </button>

      {/* Content */}
      {!collapsed && (
        <>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="skeleton-shimmer" style={{ height: 40, borderRadius: 8 }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {pulse.map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 8, textDecoration: 'none',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F5F4F0' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: item.color,
                  }} />
                  <div style={{
                    flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.text}
                  </div>
                  <span style={{
                    fontSize: 11, color: 'var(--text-muted)', flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {fmtRelativeTime(item.timestamp)}
                  </span>
                </Link>
              ))}
              <Link
                href="/actividad"
                style={{
                  fontSize: 13, color: 'var(--gold-dark, #8B6914)',
                  fontWeight: 600, padding: '8px 12px', textDecoration: 'none',
                }}
              >
                Ver toda la actividad &rarr;
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
