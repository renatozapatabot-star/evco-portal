'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { fmtDateTime } from '@/lib/format-utils'
import type { PulseItem } from '@/hooks/use-activity-pulse'

interface ActivityPulseSectionProps {
  pulse: PulseItem[]
  loading: boolean
  defaultCollapsed?: boolean
  /** Dark theme for desktop right column */
  dark?: boolean
}

export function ActivityPulseSection({ pulse, loading, defaultCollapsed = false, dark = false }: ActivityPulseSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  if (!loading && pulse.length === 0) return null

  const textColor = dark ? 'rgba(255,255,255,0.85)' : 'var(--text-primary)'
  const textMuted = dark ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)'
  const textSub = dark ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary)'
  const hoverBg = dark ? 'rgba(255,255,255,0.06)' : '#F5F4F0'
  const linkColor = dark ? 'var(--gold, #E8EAED)' : 'var(--gold-dark, #7A7E86)'

  return (
    <div className={dark ? 'cc-pulse-dark' : ''}>
      {/* Header */}
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
        <div style={{ fontSize: 13, fontWeight: 700, color: textSub, flex: 1, textAlign: 'left' }}>
          Actividad reciente{pulse.length > 0 ? ` (${pulse.length})` : ''}
        </div>
        {collapsed ? (
          <ChevronRight size={14} style={{ color: textMuted }} />
        ) : (
          <ChevronDown size={14} style={{ color: textMuted }} />
        )}
      </button>

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
                  onMouseEnter={e => { e.currentTarget.style.background = hoverBg }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: item.color,
                  }} />
                  <div style={{
                    flex: 1, minWidth: 0, fontSize: 13, color: textColor,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.text}
                  </div>
                  <span style={{
                    fontSize: 11, color: textMuted, flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {fmtDateTime(item.timestamp)}
                  </span>
                </Link>
              ))}
              <Link
                href="/actividad"
                style={{
                  fontSize: 13, color: linkColor,
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
