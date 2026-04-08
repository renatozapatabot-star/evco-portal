'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface CardAction {
  label: string
  href: string
  primary?: boolean
}

type CardUrgency = 'red' | 'amber' | 'green' | 'neutral'

interface WorkflowCardProps {
  href: string
  label: string
  Icon: LucideIcon
  kpi: number | null
  subtitle: string
  variant: 'large' | 'small' | 'uniform'
  actions: CardAction[]
  delay?: number
  /** For last card spanning full width on mobile odd count */
  spanFull?: boolean
  /** Card urgency for border color */
  urgency?: CardUrgency
}

export function WorkflowCard({ href, label, Icon, kpi, subtitle, variant, actions, delay = 0, spanFull, urgency }: WorkflowCardProps) {
  const isGood = urgency === 'green' || urgency === 'neutral' || (!urgency && (kpi === 0 || kpi === null))
  const isUrgent = urgency === 'red' || urgency === 'amber'

  // ── UNIFORM VARIANT — all cards same style, full command center feel ──
  if (variant === 'uniform') {
    const hasData = kpi !== null && kpi > 0
    const isFormatUSD = subtitle.includes('USD')
    const displayKpi = isFormatUSD && kpi
      ? `$${kpi.toLocaleString()}`
      : kpi !== null ? kpi.toLocaleString() : ''

    return (
      <div
        className="cc-card"
        style={{
          padding: '20px 20px',
          borderRadius: 14,
          background: 'var(--bg-elevated, #222222)',
          border: isUrgent
            ? '1px solid rgba(220,38,38,0.25)'
            : isGood
              ? '1px solid rgba(22,163,74,0.25)'
              : '1px solid rgba(255,255,255,0.08)',
          borderTop: isUrgent
            ? '3px solid rgba(220,38,38,0.7)'
            : isGood
              ? '3px solid rgba(22,163,74,0.5)'
              : '3px solid rgba(201,168,76,0.4)',
          boxShadow: isUrgent
            ? '0 2px 12px rgba(220,38,38,0.1)'
            : isGood
              ? '0 2px 12px rgba(22,163,74,0.08)'
              : '0 2px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 180,
          animation: `ccCountUp 300ms ease both`,
          animationDelay: `${delay}ms`,
          position: 'relative',
          opacity: isGood && !hasData ? 0.85 : 1,
          ...(spanFull ? { gridColumn: '1 / -1' } : {}),
        }}
      >
        {/* Status indicator — top right */}
        {isGood && (
          <div className="cc-check-badge">
            <CheckCircle2 size={14} style={{ color: '#FFFFFF' }} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Icon size={22} strokeWidth={1.5} style={{ color: isUrgent ? 'rgba(220,38,38,0.7)' : isGood ? 'rgba(22,163,74,0.7)' : 'rgba(255,255,255,0.5)' }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>{label}</span>
        </div>

        <div style={{ marginBottom: 16, minHeight: 40 }}>
          {hasData ? (
            <>
              <span style={{
                fontSize: isFormatUSD ? 26 : 32,
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: '#FFFFFF',
                lineHeight: 1,
                textShadow: '0 0 16px rgba(201,168,76,0.2)',
                display: 'inline-block',
              }}>
                {displayKpi}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 500,
                color: 'rgba(255,255,255,0.5)', marginLeft: 8,
              }}>
                {isFormatUSD ? subtitle.replace('USD ', '') : subtitle}
              </span>
            </>
          ) : (
            <span style={{
              fontSize: 14,
              color: isGood ? 'rgba(22,163,74,0.7)' : 'rgba(255,255,255,0.4)',
              fontWeight: 600,
            }}>
              {subtitle}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
          {actions.map(action => (
            <Link
              key={action.label}
              href={action.href}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
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
                  border: '1px solid rgba(255,255,255,0.2)',
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

  // ── LARGE VARIANT (legacy) ──
  if (variant === 'large') {
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

  // ── SMALL CARD (legacy) — entire card clickable, equal height ──
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
