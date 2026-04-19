'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Package, FileText, BarChart3, Feather } from 'lucide-react'

/**
 * CalmEmptyState — canonical empty-state card for client surfaces.
 *
 * Invariant #24: the client cockpit shows certainty, not anxiety. Any
 * list page that renders nothing must render THIS component instead
 * of a bare heading or a raw table header. The absence of data is a
 * calm signal, not a broken page.
 *
 * Every prop has a default so callers can drop this in with zero
 * configuration ("<CalmEmptyState />") and get a reasonable Spanish
 * default. Override `title`/`message`/`icon`/`action` when the page
 * has a more specific state to communicate.
 */

export interface CalmEmptyStateProps {
  title?: string
  message?: string
  icon?: 'eagle' | 'document' | 'package' | 'report'
  action?: {
    label: string
    /** Absolute or relative URL. Renders as a <Link>. */
    href?: string
    /** Button-style handler if href isn't a route — opens a drawer etc. */
    onClick?: () => void
  }
  /** Optional rendered children below the main copy — for extra context
   *  lines or a secondary "Contacta a tu agente" CTA. */
  children?: ReactNode
}

const ICON_MAP = {
  eagle:    Feather,   // placeholder — Feather is similar silhouette;
                       // replace with a real eagle SVG later if desired
  document: FileText,
  package:  Package,
  report:   BarChart3,
} as const

export function CalmEmptyState({
  title = 'Tu operación está en calma',
  message = 'No hay actividad en este período.',
  icon = 'eagle',
  action,
  children,
}: CalmEmptyStateProps) {
  const Icon = ICON_MAP[icon]

  return (
    <section
      role="status"
      aria-live="polite"
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
        background: 'linear-gradient(180deg, rgba(15,23,42,0.5) 0%, rgba(15,23,42,0) 100%)',
        border: '1px solid rgba(30,41,59,1)',
        borderRadius: 20,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 64,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: 'rgba(201,168,76,0.08)',
          border: '1px solid rgba(201,168,76,0.16)',
          color: 'rgba(201,168,76,0.7)',
        }}
      >
        <Icon size={28} strokeWidth={1.5} />
      </div>

      <h2 style={{
        fontSize: 'var(--aguila-fs-section, 16px)',
        fontWeight: 600,
        color: 'var(--portal-fg-1)',
        margin: 0,
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h2>

      <p style={{
        fontSize: 'var(--aguila-fs-body, 13px)',
        color: 'rgba(148,163,184,0.85)',
        margin: 0,
        lineHeight: 1.5,
        maxWidth: 320,
      }}>
        {message}
      </p>

      {children}

      {action && (action.href
        ? (
          <Link
            href={action.href}
            style={{
              marginTop: 8,
              minHeight: 60,
              minWidth: 120,
              padding: '0 20px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(201,168,76,0.12)',
              border: '1px solid rgba(201,168,76,0.3)',
              borderRadius: 12,
              color: 'var(--portal-fg-1)',
              fontSize: 'var(--aguila-fs-body, 13px)',
              fontWeight: 600,
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            {action.label}
          </Link>
        )
        : (
          <button
            type="button"
            onClick={action.onClick}
            style={{
              marginTop: 8,
              minHeight: 60,
              minWidth: 120,
              padding: '0 20px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(201,168,76,0.12)',
              border: '1px solid rgba(201,168,76,0.3)',
              borderRadius: 12,
              color: 'var(--portal-fg-1)',
              fontSize: 'var(--aguila-fs-body, 13px)',
              fontWeight: 600,
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            {action.label}
          </button>
        ))}
    </section>
  )
}
