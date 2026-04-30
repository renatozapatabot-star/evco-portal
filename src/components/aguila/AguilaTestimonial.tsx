'use client'

import type { ReactNode } from 'react'
import { GlassCard } from './GlassCard'

export interface AguilaTestimonialProps {
  /** The quote body. Renders in serif display. */
  quote: ReactNode
  /** Attribution name (e.g. "Ursula Banda"). */
  attribution: string
  /** Role/title under the name (e.g. "Dir. de Operaciones, EVCO Plastics"). */
  role?: string
  /** Optional logo/avatar slot (rendered 40×40 on the left). */
  avatar?: ReactNode
  /** Card padding override. */
  padding?: number | string
}

/**
 * AguilaTestimonial — reusable quote + attribution tile for the pitch
 * landing, case studies, and sales decks. Quote body uses the portal
 * display serif (Instrument Serif via --portal-font-display) at
 * pull-quote scale; attribution stays sans-serif and small.
 *
 * Token-only chrome. Composes <GlassCard tier="hero">.
 */
export function AguilaTestimonial({
  quote,
  attribution,
  role,
  avatar,
  padding = 24,
}: AguilaTestimonialProps) {
  return (
    <GlassCard tier="hero" padding={padding}>
      <blockquote
        style={{
          margin: 0,
          padding: 0,
          fontFamily: 'var(--portal-font-display)',
          fontSize: 'var(--portal-fs-xl, 20px)',
          fontWeight: 400,
          lineHeight: 1.35,
          color: 'var(--portal-fg-1)',
          letterSpacing: '-0.01em',
          position: 'relative',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -10,
            left: -8,
            fontSize: '2.4em',
            color: 'var(--portal-fg-5)',
            opacity: 0.35,
            lineHeight: 1,
            fontFamily: 'var(--portal-font-display)',
          }}
        >
          &ldquo;
        </span>
        <span style={{ position: 'relative' }}>{quote}</span>
      </blockquote>
      <figcaption
        style={{
          marginTop: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {avatar ? (
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--portal-ink-2)',
              border: '1px solid var(--portal-line-2)',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {avatar}
          </span>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 'var(--portal-fs-sm)',
              fontWeight: 600,
              color: 'var(--portal-fg-2)',
              letterSpacing: '0.01em',
            }}
          >
            {attribution}
          </span>
          {role ? (
            <span
              style={{
                fontSize: 'var(--portal-fs-tiny)',
                color: 'var(--portal-fg-5)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {role}
            </span>
          ) : null}
        </div>
      </figcaption>
    </GlassCard>
  )
}
