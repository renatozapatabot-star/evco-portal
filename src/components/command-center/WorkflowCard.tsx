'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface CardAction {
  label: string
  href: string
  primary?: boolean
}

interface WorkflowCardProps {
  href: string
  label: string
  Icon: LucideIcon
  /** KPI count — null hides number */
  kpi: number | null
  subtitle: string
  variant: 'large' | 'small'
  actions: CardAction[]
  delay?: number
}

export function WorkflowCard({ href, label, Icon, kpi, subtitle, variant, actions, delay = 0 }: WorkflowCardProps) {
  const isLarge = variant === 'large'
  const isGood = !isLarge && (kpi === 0 || kpi === null)

  if (isLarge) {
    return (
      <div
        className="cc-card-large"
        style={{
          padding: '24px 28px',
          borderRadius: 16,
          background: '#1A1A1A',
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          animation: `ccCountUp 300ms ease both`,
          animationDelay: `${delay}ms`,
          cursor: 'default',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Icon size={24} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.6)' }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>{label}</span>
        </div>

        {/* Big KPI */}
        <div style={{ marginBottom: 20 }}>
          <span style={{
            fontSize: 40,
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: '#FFFFFF',
            lineHeight: 1,
            animation: `ccCountUp 400ms ease both`,
            animationDelay: `${delay + 100}ms`,
            display: 'inline-block',
          }}>
            {kpi ?? 0}
          </span>
          <span style={{
            fontSize: 16,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            marginLeft: 10,
          }}>
            {subtitle}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {actions.map(action => (
            <Link
              key={action.label}
              href={action.href}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                minHeight: 44,
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'background 150ms, transform 150ms',
                ...(action.primary ? {
                  background: 'var(--gold, #C9A84C)',
                  color: '#1A1A1A',
                } : {
                  background: 'transparent',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.25)',
                }),
              }}
              onMouseEnter={e => {
                if (action.primary) {
                  e.currentTarget.style.background = 'var(--gold-hover, #B8933B)'
                } else {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                }
              }}
              onMouseLeave={e => {
                if (action.primary) {
                  e.currentTarget.style.background = 'var(--gold, #C9A84C)'
                } else {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // ── SMALL CARD (healthy/neutral) — entire card clickable ──
  return (
    <Link
      href={href}
      style={{
        textDecoration: 'none',
        display: 'block',
        animation: `ccCountUp 300ms ease both`,
        animationDelay: `${delay}ms`,
      }}
    >
      <div
        className="cc-card-small"
        style={{
          padding: '20px 16px',
          borderRadius: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 8,
          minHeight: 140,
          cursor: 'pointer',
        }}
      >
        {/* Icon + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={20} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
        </div>

        {/* Status / KPI */}
        <div style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flex: 1,
        }}>
          {isGood && <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />}
          {kpi !== null && kpi > 0 ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{kpi} </span>
          ) : null}
          <span>{subtitle}</span>
        </div>

        {/* Gold action button */}
        {actions[0] && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 16px',
              borderRadius: 8,
              background: 'var(--gold, #C9A84C)',
              color: '#1A1A1A',
              fontSize: 12,
              fontWeight: 700,
              marginTop: 'auto',
            }}
          >
            {actions[0].label}
          </span>
        )}
      </div>
    </Link>
  )
}
