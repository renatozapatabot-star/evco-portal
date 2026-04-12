'use client'

import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { haptic } from '@/hooks/use-haptic'

export type CardUrgency = 'red' | 'amber' | 'green' | 'neutral'

export interface CockpitAction {
  label: string
  href: string
  primary?: boolean
}

interface CockpitCardProps {
  title: string
  Icon?: LucideIcon
  kpi?: number | string | null
  subtitle?: string
  urgency?: CardUrgency
  actions?: CockpitAction[]
  children?: ReactNode
  delay?: number
}

// Urgency color system
const U_BORDER = { red: 'rgba(220,38,38,0.25)', amber: 'rgba(217,119,6,0.25)', green: 'rgba(22,163,74,0.25)', neutral: 'rgba(255,255,255,0.08)' }
const U_TOP    = { red: 'rgba(220,38,38,0.7)', amber: 'rgba(217,119,6,0.6)', green: 'rgba(22,163,74,0.5)', neutral: 'rgba(192,197,206,0.4)' }
const U_SHADOW = { red: 'rgba(220,38,38,0.1)', amber: 'rgba(217,119,6,0.08)', green: 'rgba(22,163,74,0.08)', neutral: 'rgba(0,0,0,0.2)' }
const U_ICON   = { red: 'rgba(220,38,38,0.7)', amber: 'rgba(217,119,6,0.7)', green: 'rgba(22,163,74,0.7)', neutral: 'rgba(255,255,255,0.5)' }

/**
 * Generic cockpit card — the primary UI element.
 * Dark background, urgency-colored top border, optional KPI, action buttons.
 * Supports children slot for embedding tables/charts/custom content.
 */
export function CockpitCard({
  title,
  Icon,
  kpi,
  subtitle,
  urgency = 'neutral',
  actions,
  children,
  delay = 0,
}: CockpitCardProps) {
  const prefersReduced = useReducedMotion()
  const u = urgency
  const isGood = u === 'green' || u === 'neutral'
  const hasKpi = kpi !== null && kpi !== undefined && kpi !== 0 && kpi !== ''

  const displayKpi = typeof kpi === 'string'
    ? kpi
    : typeof kpi === 'number'
      ? kpi.toLocaleString()
      : ''

  const isUSD = subtitle?.includes('USD')

  return (
    <motion.div
      className={`cc-card${u === 'red' ? ' urgency-pulse-red' : u === 'amber' ? ' urgency-pulse-amber' : ''}`}
      whileHover={prefersReduced ? undefined : { scale: 1.005, boxShadow: `0 4px 20px ${U_SHADOW[u]}` }}
      whileTap={prefersReduced ? undefined : { scale: 0.97 }}
      onTapStart={() => haptic.micro()}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        padding: 16,
        borderRadius: 14,
        background: 'var(--bg-elevated, #222222)',
        border: `1px solid ${U_BORDER[u]}`,
        borderTop: `3px solid ${U_TOP[u]}`,
        boxShadow: `0 2px 12px ${U_SHADOW[u]}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: children ? undefined : 180,
        animation: `ccCountUp 300ms ease both`,
        animationDelay: `${delay}ms`,
        position: 'relative',
        opacity: isGood && !hasKpi && !children ? 0.85 : 1,
      }}
    >
      {/* Green check badge — top right */}
      {isGood && (
        <div className="cc-check-badge" style={{ width: 18, height: 18 }}>
          <CheckCircle2 size={12} style={{ color: '#FFFFFF' }} />
        </div>
      )}

      {/* Header: Icon + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: children ? 12 : 12 }}>
        {Icon && <Icon size={20} strokeWidth={1.5} style={{ color: U_ICON[u] }} />}
        <span style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>{title}</span>
      </div>

      {/* KPI + Subtitle */}
      {(hasKpi || subtitle) && !children && (
        <div style={{ marginBottom: 16, minHeight: 40 }}>
          {hasKpi ? (
            <>
              <span style={{
                fontSize: isUSD ? 24 : 28,
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: '#FFFFFF',
                lineHeight: 1.1,
                textShadow: '0 0 16px rgba(192,197,206,0.2)',
                display: 'inline-block',
              }}>
                {displayKpi}
              </span>
              {subtitle && (
                <span style={{
                  fontSize: 12, fontWeight: 500,
                  color: 'rgba(255,255,255,0.5)', marginLeft: 8,
                }}>
                  {isUSD ? subtitle.replace('USD ', '') : subtitle}
                </span>
              )}
            </>
          ) : subtitle ? (
            <span style={{
              fontSize: 13,
              color: isGood ? 'rgba(22,163,74,0.7)' : 'rgba(255,255,255,0.4)',
              fontWeight: 600,
            }}>
              {subtitle}
            </span>
          ) : null}
        </div>
      )}

      {/* Children slot (tables, charts, custom content) */}
      {children && (
        <div style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>
      )}

      {/* Action buttons */}
      {actions && actions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 12 }}>
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
                  background: 'var(--gold, #E8EAED)',
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
      )}
    </motion.div>
  )
}
