import type { ReactNode } from 'react'

export type PortalBadgeTone = 'neutral' | 'live' | 'info' | 'warn' | 'alert'

export interface PortalBadgeProps {
  children: ReactNode
  tone?: PortalBadgeTone
  /** When true, renders a small pulsing dot before children (live-state signal). */
  pulse?: boolean
  className?: string
  ariaLabel?: string
}

const TONE_CLASS: Record<PortalBadgeTone, string> = {
  neutral: '',
  live: 'portal-badge--live',
  info: 'portal-badge--info',
  warn: 'portal-badge--warn',
  alert: 'portal-badge--alert',
}

export function PortalBadge({
  children,
  tone = 'neutral',
  pulse = false,
  className,
  ariaLabel,
}: PortalBadgeProps) {
  const cls = ['portal-badge', TONE_CLASS[tone], className].filter(Boolean).join(' ')
  return (
    <span className={cls} aria-label={ariaLabel}>
      {pulse ? <span className="portal-pulse" aria-hidden /> : null}
      {children}
    </span>
  )
}
