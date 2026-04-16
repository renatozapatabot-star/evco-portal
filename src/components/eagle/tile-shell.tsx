'use client'

/**
 * CRUZ · V1.5 F6 — Eagle tile shell.
 *
 * Composes from the unified <GlassCard> primitive. Title/subtitle row uses
 * the centralized typography scale.
 */

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'
import { GlassCard, type SeverityTone } from '@/components/aguila'

export const MONO = 'var(--font-mono)'

export interface TileShellProps {
  title: string
  subtitle?: string
  href?: string
  span?: 1 | 2
  fixedHeight?: number
  severity?: SeverityTone
  children: ReactNode
}

export function TileShell({ title, subtitle, href, span = 1, fixedHeight, severity, children }: TileShellProps) {
  const gridStyle: CSSProperties = {
    gridColumn: span === 2 ? 'span 2' : 'span 1',
    height: fixedHeight ?? '100%',
    minHeight: 220,
  }
  const card = (
    <GlassCard
      severity={severity}
      hover={Boolean(href)}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--aguila-gap-stack, 12px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{
          fontSize: 'var(--aguila-fs-section, 14px)',
          fontWeight: 600,
          color: TEXT_PRIMARY,
          margin: 0,
          letterSpacing: '0.02em',
        }}>
          {title}
        </h2>
        {subtitle ? (
          <span style={{
            fontSize: 'var(--aguila-fs-meta, 11px)',
            color: TEXT_MUTED,
            fontFamily: MONO,
          }}>
            {subtitle}
          </span>
        ) : null}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
        {children}
      </div>
    </GlassCard>
  )
  if (!href) {
    return <div style={gridStyle}>{card}</div>
  }
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block', ...gridStyle }}>
      {card}
    </Link>
  )
}
