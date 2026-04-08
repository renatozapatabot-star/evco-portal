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
  kpi: number | null
  subtitle: string
  variant: 'large' | 'small'
  actions: CardAction[]
  delay?: number
  /** For last small card spanning full width on mobile */
  spanFull?: boolean
}

export function WorkflowCard({ href, label, Icon, kpi, subtitle, variant, actions, delay = 0, spanFull }: WorkflowCardProps) {
  const isLarge = variant === 'large'
  const isGood = !isLarge && (kpi === 0 || kpi === null)

  if (isLarge) {
    return (
      <div
        className="cc-card"
        style={{
          padding: '24px 28px',
          borderRadius: 16,
          background: 'var(--bg-elevated, #222222)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          animation: `ccCountUp 300ms ease both`,
          animationDelay: `${delay}ms`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Icon size={24} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.6)' }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>{label}</span>
        </div>

        <div style={{ marginBottom: 20 }}>
          <span style={{
            fontSize: 40,
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: '#FFFFFF',
            lineHeight: 1,
            textShadow: '0 0 20px rgba(201,168,76,0.25)',
            animation: `ccCountUp 400ms ease both`,
            animationDelay: `${delay + 100}ms`,
            display: 'inline-block',
          }}>
            {kpi ?? 0}
          </span>
          <span style={{
            fontSize: 16, fontWeight: 500,
            color: 'rgba(255,255,255,0.6)', marginLeft: 10,
          }}>
            {subtitle}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {actions.map(action => (
            <Link
              key={action.label}
              href={action.href}
              className="cc-card"
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                minHeight: 44,
                display: 'inline-flex',
                alignItems: 'center',
                ...(action.primary ? {
                  background: 'var(--gold, #C9A84C)',
                  color: '#1A1A1A',
                  border: 'none',
                } : {
                  background: 'transparent',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.25)',
                }),
              }}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // ── SMALL CARD — entire card clickable, equal height ──
  return (
    <Link
      href={href}
      style={{
        textDecoration: 'none',
        display: 'block',
        animation: `ccCountUp 300ms ease both`,
        animationDelay: `${delay}ms`,
        ...(spanFull ? { gridColumn: '1 / -1' } : {}),
      }}
    >
      <div
        className="cc-card"
        style={{
          padding: '20px 16px',
          borderRadius: 12,
          background: '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          color: '#1A1A1A',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 160,
          height: '100%',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        {/* Green checkmark badge — top right */}
        {isGood && (
          <div className="cc-check-badge">
            <CheckCircle2 size={14} style={{ color: '#FFFFFF' }} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={24} strokeWidth={1.5} style={{ color: '#6B6B6B' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{label}</span>
        </div>

        <div style={{
          fontSize: 13, color: '#6B6B6B',
          display: 'flex', alignItems: 'center', gap: 4,
          marginTop: 8,
        }}>
          {kpi !== null && kpi > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{kpi} </span>
          )}
          <span>{subtitle}</span>
        </div>

        {actions[0] && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 16px',
            borderRadius: 8,
            background: 'var(--gold, #C9A84C)',
            color: '#1A1A1A',
            fontSize: 12,
            fontWeight: 700,
            marginTop: 'auto',
            alignSelf: 'flex-start',
          }}>
            {actions[0].label}
          </span>
        )}
      </div>
    </Link>
  )
}
