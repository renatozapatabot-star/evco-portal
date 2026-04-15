/**
 * FallbackLink — escape hatch to the legacy GlobalPC system.
 *
 * Every AGUILA feature card that maps to a GlobalPC workflow carries one of
 * these. Operators keep trust in AGUILA precisely because they always know
 * where to go when the new system is missing data.
 *
 * Two visual modes, one component:
 *   · default     → small gray text link at the bottom of a card
 *   · prominent   → full-width amber glass card with icon + CTA
 *
 * The parent passes `isIncomplete` (usually derived from a query state like
 * `!data?.length || isError`). When true, the component auto-promotes to
 * the prominent layout so the operator doesn't have to hunt for the fallback
 * during a live shipment.
 */

import Link from 'next/link'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'

export interface FallbackLinkProps {
  href: string
  label: string
  /** Promote to the amber "data missing" card when true. */
  isIncomplete?: boolean
  /** Short line shown above the CTA when prominent. */
  message?: string
  /** Override the default "Ver en GlobalPC" CTA text. */
  cta?: string
  /** Inline style hook for containers that need a specific margin/padding. */
  className?: string
}

export function FallbackLink({
  href,
  label,
  isIncomplete = false,
  message,
  cta,
  className,
}: FallbackLinkProps) {
  if (isIncomplete) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          marginTop: 12,
          borderRadius: 16,
          background: 'rgba(251, 191, 36, 0.06)',
          border: '1px solid rgba(251, 191, 36, 0.24)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <AlertTriangle size={18} color="#FBBF24" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--aguila-fs-body, 13px)',
              color: '#FDE68A',
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {message ?? `Datos incompletos en AGUILA — consulta ${label} para detalles.`}
          </div>
        </div>
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            borderRadius: 10,
            background: 'rgba(251, 191, 36, 0.16)',
            color: '#FDE68A',
            fontSize: 'var(--aguila-fs-meta, 11px)',
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {cta ?? 'Ver en GlobalPC'}
          <ArrowUpRight size={12} />
        </Link>
      </div>
    )
  }

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        fontSize: 'var(--aguila-fs-meta, 11px)',
        color: 'rgba(148, 163, 184, 0.7)',
        textDecoration: 'none',
        transition: 'color 120ms ease',
      }}
    >
      {cta ?? `Ver ${label} en GlobalPC`}
      <ArrowUpRight size={11} />
    </Link>
  )
}
