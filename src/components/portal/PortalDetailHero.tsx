'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { PortalBadge } from './PortalBadge'
import { PortalButton } from './PortalButton'

export interface DetailHeroStage {
  id: string
  /** Display label (e.g. "Creación"). */
  label: string
  /** 'done' (dimmed emerald) · 'active' (emerald + pulse) · 'upcoming' (line-2). */
  status: 'done' | 'active' | 'upcoming'
}

export interface DetailHeroStat {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
}

export interface DetailHeroBadge {
  tone?: 'live' | 'info' | 'warn' | 'alert' | 'neutral'
  label: string
}

export interface PortalDetailHeroProps {
  /** Small uppercase eyebrow above the number. */
  eyebrow?: string
  /** First half of the pedimento number (renders fg-1). */
  numberPrefix: string
  /** Emerald second half (the SAT consecutive). */
  numberSuffix: string
  /** 5 stages of pedimento workflow with current-state pulse. */
  stages: DetailHeroStage[]
  /** Inline badges below the stage spine. */
  badges?: DetailHeroBadge[]
  /** 4-cell grid on the right side (VALOR · IMPUESTOS · PESO · FRACCIONES). */
  stats: DetailHeroStat[]
  /** Breadcrumb nodes for the sticky topbar. */
  breadcrumb?: string[]
  /** Optional right-aligned action cluster in the topbar. */
  topbarActions?: ReactNode
  /** Back href for the Volver button. */
  backHref?: string
  /** Fire-and-forget theater launcher (opens the 5-act overlay). */
  onOpenTheater?: () => void
}

const STAGE_COLOR = {
  done:     'var(--portal-green-2)',
  active:   'var(--portal-green-2)',
  upcoming: 'var(--portal-ink-3)',
}
const STAGE_LABEL = {
  done:     'var(--portal-fg-3)',
  active:   'var(--portal-green-2)',
  upcoming: 'var(--portal-fg-5)',
}

/**
 * Reference-faithful detail page hero — port of
 * `.planning/design-handoff/cruz-portal/project/src/screen-detail-system.jsx:11-106`.
 *
 * Composition (top → bottom):
 *   · 2px emerald accent line (sticky, z-21)
 *   · 56px sticky breadcrumb topbar (z-20, ink-0/85 + blur(12px))
 *   · Hero grid 1.2fr / 1fr:
 *       Left  — eyebrow + giant Geist Mono pedimento number
 *               (fg-1 prefix + emerald suffix, 64px, -0.02em)
 *               + 5-stage progress spine with pulse on 'active'
 *               + inline badges row
 *       Right — 2×2 grid of stat cards separated by 1px hairlines
 */
export function PortalDetailHero({
  eyebrow = 'PEDIMENTO · A1 IMPORTACIÓN DEFINITIVA',
  numberPrefix,
  numberSuffix,
  stages,
  badges = [],
  stats,
  breadcrumb = ['DASHBOARD', 'EMBARQUES', 'PEDIMENTO'],
  topbarActions,
  backHref = '/embarques',
  onOpenTheater,
}: PortalDetailHeroProps) {
  return (
    <>
      {/* 2px emerald accent line — sits ABOVE the sticky topbar */}
      <div
        aria-hidden
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 21,
          height: 2,
          background:
            'linear-gradient(to right, transparent 0%, var(--portal-green-2) 20%, var(--portal-green-2) 80%, transparent 100%)',
          boxShadow: '0 0 12px var(--portal-green-glow)',
          opacity: 0.85,
        }}
      />

      {/* Sticky breadcrumb topbar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          height: 'var(--portal-topbar-h, 56px)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: '1px solid var(--portal-line-1)',
          background: 'color-mix(in oklch, var(--portal-ink-0) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <Link
          href={backHref}
          className="portal-btn portal-btn--ghost portal-btn--sm"
          style={{ textDecoration: 'none', display: 'inline-flex' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m11 19-7-7 7-7" />
          </svg>
          Volver
        </Link>
        <span className="portal-eyebrow" style={{ letterSpacing: '0.18em' }}>
          {breadcrumb.join(' / ')}
        </span>
        <div style={{ flex: 1 }} />
        <PortalBadge tone="live" pulse>
          EN VIVO
        </PortalBadge>
        {topbarActions}
      </header>

      {/* Hero grid */}
      <div
        className="portal-detail-hero-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 32,
          alignItems: 'flex-end',
          marginTop: 40,
          marginBottom: 40,
        }}
      >
        {/* Left column */}
        <div>
          <div className="portal-eyebrow" style={{ marginBottom: 12, letterSpacing: '0.22em' }}>
            {eyebrow}
          </div>
          <h1
            style={{
              fontFamily: 'var(--portal-font-mono)',
              fontWeight: 400,
              // Audit Cluster F (2026-05-05): hero pedimento was 64px fixed
              // and overflowed the viewport at 640px (horizontal scroll).
              // clamp lets it shrink to ~32px on phones; wrap settings let
              // long pedimentos break instead of pushing the page sideways.
              fontSize: 'clamp(32px, 8vw, 64px)', // WHY: hero pedimento responsive scale
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: 'var(--portal-fg-1)',
              margin: 0,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {numberPrefix}
            <span style={{ color: 'var(--portal-green-2)' }}>{numberSuffix}</span>
          </h1>

          {/* 5-stage progress spine */}
          <div
            style={{
              marginTop: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              maxWidth: 560,
            }}
          >
            {stages.map((s, i, arr) => (
              <span
                key={s.id}
                style={{ display: 'flex', alignItems: 'center', flex: i === arr.length - 1 ? 0 : 1 }}
              >
                <span
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      background: STAGE_COLOR[s.status],
                      border: `1px solid ${s.status === 'upcoming' ? 'var(--portal-line-3)' : 'var(--portal-green-2)'}`,
                      boxShadow: s.status === 'active' ? '0 0 0 4px var(--portal-green-glow)' : 'none',
                      animation: s.status === 'active' ? 'portalDotPulse 2s ease-in-out infinite' : undefined,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--portal-font-mono)',
                      fontSize: 8,
                      letterSpacing: '0.2em',
                      color: STAGE_LABEL[s.status],
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </span>
                </span>
                {i < arr.length - 1 && (
                  <span
                    aria-hidden
                    style={{
                      flex: 1,
                      height: 1,
                      margin: '0 6px',
                      background:
                        s.status === 'done' || arr[i + 1].status !== 'upcoming'
                          ? 'var(--portal-green-3)'
                          : 'var(--portal-line-2)',
                      opacity: 0.6,
                      marginBottom: 18,
                    }}
                  />
                )}
              </span>
            ))}
          </div>

          {/* Badges row */}
          {badges.length > 0 && (
            <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {badges.map((b, i) => (
                <PortalBadge key={i} tone={b.tone} pulse={b.tone === 'live'}>
                  {b.label}
                </PortalBadge>
              ))}
            </div>
          )}

          {/* Theater launcher (optional) */}
          {onOpenTheater && (
            <div style={{ marginTop: 20 }}>
              <PortalButton variant="ghost" size="sm" onClick={onOpenTheater}>
                Ver flujo completo →
              </PortalButton>
            </div>
          )}
        </div>

        {/* Right column — 2×2 stats grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1,
            background: 'var(--portal-line-1)',
            border: '1px solid var(--portal-line-1)',
            borderRadius: 'var(--portal-r-3)',
            overflow: 'hidden',
          }}
        >
          {stats.map((s, i) => (
            <div
              key={i}
              style={{
                background: 'var(--portal-ink-1)',
                padding: '16px 20px',
              }}
            >
              <div className="portal-eyebrow" style={{ letterSpacing: '0.22em' }}>
                {s.label}
              </div>
              <div
                className="portal-num"
                style={{
                  fontSize: 20,
                  color: 'var(--portal-fg-1)',
                  marginTop: 6,
                  fontFamily: 'var(--portal-font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.value}
              </div>
              {s.sub != null && (
                <div className="portal-meta" style={{ marginTop: 2 }}>
                  {s.sub}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 960px) {
          :global(.portal-detail-hero-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  )
}
