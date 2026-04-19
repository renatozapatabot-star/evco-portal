'use client'

import type { ReactNode } from 'react'
import { PortalBadge } from './PortalBadge'
import type { PortalBadgeTone } from './PortalBadge'

export interface ModuleBadge {
  tone?: PortalBadgeTone
  label: string
}

export interface PortalModuleCardProps {
  /** Icon slot (pass any ReactNode). Typically a small SVG 15px. */
  icon: ReactNode
  title: ReactNode
  desc: ReactNode
  /** Big mono footer number. */
  metric: ReactNode
  /** Eyebrow beneath metric (mono micro uppercase). */
  metricLabel: ReactNode
  /** Bespoke viz — VizPulse / VizPedimentoLedger / VizDocs / etc. */
  viz?: ReactNode
  /** Optional badge rendered top-right. */
  badge?: ModuleBadge
  /** When true, applies the emerald radial halo + rail — signals accent card. */
  accent?: boolean
  onClick?: () => void
  /** When set, card renders as a link/button navigating to href. */
  href?: string
  ariaLabel?: string
}

/**
 * Module card — the 6 dashboard cards share this shape. Header row
 * (icon box + display title + optional badge) + description + viz slot +
 * footer row (mono label + big metric). Accent mode adds emerald radial
 * halo + left rail.
 *
 * Ported from screen-dashboard.jsx:439-488.
 */
export function PortalModuleCard({
  icon,
  title,
  desc,
  metric,
  metricLabel,
  viz,
  badge,
  accent = false,
  onClick,
  href,
  ariaLabel,
}: PortalModuleCardProps) {
  const inner = (
    <>
      {accent && <div className="portal-card__rail" style={{ opacity: 1 }} aria-hidden />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--portal-r-2)',
            background: 'var(--portal-ink-3)',
            border: '1px solid var(--portal-line-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--portal-fg-2)',
          }}
        >
          {icon}
        </div>
        <div
          style={{
            fontFamily: 'var(--portal-font-display)',
            fontWeight: 400,
            fontSize: 20,
            color: 'var(--portal-fg-1)',
            letterSpacing: '-0.01em',
            flex: 1,
          }}
        >
          {title}
        </div>
        {badge && <PortalBadge tone={badge.tone}>{badge.label}</PortalBadge>}
      </div>

      <div
        style={{
          fontSize: 'var(--portal-fs-sm)',
          color: 'var(--portal-fg-3)',
          lineHeight: 1.45,
        }}
      >
        {desc}
      </div>

      {viz != null && <div style={{ marginTop: 'auto' }}>{viz}</div>}

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingTop: 10,
          borderTop: '1px solid var(--portal-line-1)',
        }}
      >
        <span className="portal-meta" style={{ color: 'var(--portal-fg-5)' }}>
          {metricLabel}
        </span>
        <span
          className="portal-num"
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: 'var(--portal-fg-1)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
          }}
        >
          {metric}
        </span>
      </div>
    </>
  )

  const containerStyle = {
    padding: 'var(--portal-s-6)',
    textAlign: 'left' as const,
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    minHeight: 200,
    // Background intentionally omitted for the non-accent case so the
    // .portal-card class chemistry (rgba(0,0,0,0.25) + backdrop-blur +
    // top-lit inset) takes effect. Inline styles override CSS class —
    // setting background here matted the cards on /inicio. Audit
    // 2026-04-19 caught this regression.
    ...(accent
      ? {
          background:
            'radial-gradient(ellipse at 0% 0%, color-mix(in oklch, var(--portal-green-2) 8%, var(--portal-ink-1)), var(--portal-ink-1) 55%)',
        }
      : {}),
    border: '1px solid var(--portal-line-1)',
    borderRadius: 'var(--portal-r-4)',
    color: 'inherit',
    textDecoration: 'none',
    cursor: onClick || href ? 'pointer' : 'default',
    width: '100%',
  }

  // data-accent flag lets the accent variant's inline radial-gradient
  // win over the .portal-card !important glass background. Audit
  // 2026-04-19 fix: glass chemistry needed !important to defeat
  // Next.js bundler ordering quirk; accent variant escapes via attr.
  const accentAttr = accent ? { 'data-accent': 'true' as const } : {}

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="portal-card portal-card--interactive"
        style={containerStyle}
        {...accentAttr}
      >
        {inner}
      </button>
    )
  }
  if (href) {
    return (
      <a
        href={href}
        aria-label={ariaLabel}
        className="portal-card portal-card--interactive"
        style={containerStyle}
        {...accentAttr}
      >
        {inner}
      </a>
    )
  }
  return (
    <div className="portal-card" style={containerStyle} aria-label={ariaLabel} {...accentAttr}>
      {inner}
    </div>
  )
}
