'use client'

import Link from 'next/link'
import { ChevronRight, CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { URGENCY_COLORS, type Urgency } from '@/lib/card-urgency'

interface WorkflowCardProps {
  href: string
  label: string
  Icon: LucideIcon
  urgency: Urgency
  /** KPI count to display — null hides the number area */
  kpi: number | null
  /** Label under the section name */
  subtitle: string
  /** Stagger animation delay in ms */
  delay?: number
}

export function WorkflowCard({ href, label, Icon, urgency, kpi, subtitle, delay = 0 }: WorkflowCardProps) {
  const borderColor = URGENCY_COLORS[urgency]
  const isGood = urgency === 'green' && (kpi === 0 || kpi === null)
  const isNeutral = urgency === 'neutral'

  return (
    <Link
      href={href}
      style={{
        textDecoration: 'none',
        display: 'block',
        animation: `fadeInUp 200ms ease both`,
        animationDelay: `${delay}ms`,
      }}
    >
      <div
        className="cc-workflow-card"
        style={{
          padding: '16px 20px',
          borderRadius: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${borderColor}`,
          transition: 'border-color 150ms, box-shadow 150ms',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          minHeight: 72,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--gold, #C9A84C)'
          e.currentTarget.style.borderLeftColor = borderColor
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(196,150,60,0.1)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.borderLeftColor = borderColor
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <Icon size={24} strokeWidth={1.5} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {label}
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            {isGood && (
              <CheckCircle2 size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />
            )}
            <span style={{ fontWeight: 500 }}>
              {subtitle}
            </span>
          </div>
        </div>

        {/* KPI area */}
        <div style={{
          fontSize: 22,
          fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          color: isGood ? 'var(--success)' : isNeutral ? 'var(--text-muted)' : borderColor,
          flexShrink: 0,
          minWidth: 28,
          textAlign: 'right',
        }}>
          {isGood ? (
            <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
          ) : kpi !== null ? (
            kpi
          ) : (
            <span style={{ fontSize: 18 }}>&mdash;</span>
          )}
        </div>

        <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>
    </Link>
  )
}
