import type { ReactNode } from 'react'

export interface PortalSectionProps {
  /** Mono micro uppercase label on the right (e.g. count, timestamp). */
  eyebrow?: ReactNode
  /** Display title (Geist, weight 300, xl). */
  title: ReactNode
  /** Optional right-aligned action (e.g. "Ver todo →"). Replaces eyebrow when present. */
  action?: ReactNode
  children?: ReactNode
  className?: string
}

/**
 * Section header primitive — composes `.portal-section-title` from
 * portal-components.css. Title on the left, eyebrow/action on the right,
 * 1px bottom border hairline, consistent top/bottom padding.
 */
export function PortalSection({ eyebrow, title, action, children, className }: PortalSectionProps) {
  return (
    <section className={className}>
      <div className="portal-section-title">
        <h2>{title}</h2>
        {action ? <div>{action}</div> : eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      </div>
      {children}
    </section>
  )
}
