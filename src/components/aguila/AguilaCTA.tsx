'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export interface AguilaCTAAction {
  /** Link target. Omit to render as a disabled placeholder. */
  href?: string
  /** Optional onClick. When present, the button is a <button>; otherwise it's a <Link>. */
  onClick?: () => void
  /** Button copy. */
  label: ReactNode
  /** Optional trailing icon (→, ↗, etc). */
  icon?: ReactNode
  /** external: opens in a new tab with rel=noopener. */
  external?: boolean
  /** ARIA label for screen readers when label alone is ambiguous. */
  ariaLabel?: string
}

export interface AguilaCTAProps {
  /** Primary action — silver gradient, rendered first. */
  primary: AguilaCTAAction
  /** Secondary action — ghost outline, rendered next to primary. */
  secondary?: AguilaCTAAction
  /** Optional heading rendered above the button row (display serif). */
  title?: ReactNode
  /** Optional subtitle rendered between title and buttons. */
  subtitle?: ReactNode
  /** Stack direction — row on desktop, column below 520px. Default 'row'. */
  direction?: 'row' | 'column'
  /** Horizontal alignment — 'center' | 'start' | 'end'. Default 'center'. */
  align?: 'start' | 'center' | 'end'
}

function renderAction(
  action: AguilaCTAAction,
  variant: 'primary' | 'ghost',
): ReactNode {
  const className = `portal-btn portal-btn--${variant} portal-btn--lg`
  const children = (
    <>
      {action.label}
      {action.icon ? <span aria-hidden style={{ marginLeft: 8, display: 'inline-flex' }}>{action.icon}</span> : null}
    </>
  )

  if (action.onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={action.onClick}
        aria-label={action.ariaLabel}
      >
        {children}
      </button>
    )
  }

  if (!action.href) {
    return (
      <span
        aria-disabled="true"
        className={className}
        style={{ opacity: 0.5, pointerEvents: 'none' }}
      >
        {children}
      </span>
    )
  }

  if (action.external) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={action.ariaLabel}
        style={{ textDecoration: 'none' }}
      >
        {children}
      </a>
    )
  }

  return (
    <Link
      href={action.href}
      className={className}
      aria-label={action.ariaLabel}
      style={{ textDecoration: 'none' }}
    >
      {children}
    </Link>
  )
}

/**
 * AguilaCTA — paired primary + secondary action stack with optional
 * title + subtitle. The default marketing-page CTA primitive.
 *
 * Composes `.portal-btn--primary` and `.portal-btn--ghost` classes so
 * every CTA across /pitch, /demo, future landings reads as one system.
 *
 * Accepts external/internal links, buttons (onClick), and disabled
 * placeholders. ARIA label slot for ambiguous copy like "→".
 *
 * Direction 'column' pushes buttons full-width — use for mobile-first
 * cards where the primary action should dominate.
 */
export function AguilaCTA({
  primary,
  secondary,
  title,
  subtitle,
  direction = 'row',
  align = 'center',
}: AguilaCTAProps) {
  const justify =
    align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center'

  return (
    <div
      style={{
        textAlign: align,
        display: 'flex',
        flexDirection: 'column',
        alignItems:
          align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
        gap: title || subtitle ? 10 : 0,
      }}
    >
      {title ? (
        <div
          style={{
            fontFamily: 'var(--portal-font-display)',
            fontSize: 'var(--portal-fs-xl, 20px)',
            color: 'var(--portal-fg-1)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
      ) : null}
      {subtitle ? (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--portal-fs-sm)',
            color: 'var(--portal-fg-4)',
            maxWidth: 520,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      ) : null}
      <div
        style={{
          display: 'flex',
          flexDirection: direction,
          gap: 12,
          justifyContent: justify,
          marginTop: title || subtitle ? 16 : 0,
          width: direction === 'column' ? '100%' : undefined,
          flexWrap: 'wrap',
        }}
      >
        {renderAction(primary, 'primary')}
        {secondary ? renderAction(secondary, 'ghost') : null}
      </div>
    </div>
  )
}
