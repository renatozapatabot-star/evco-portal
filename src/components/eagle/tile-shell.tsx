'use client'

/**
 * AGUILA · V1.5 F6 — Eagle tile shell.
 *
 * Silver glass card, 20px radius, hairline border. Every tile is an action:
 * the whole surface is clickable via Link. Mono reserved for numerics inside.
 */

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import {
  BORDER_HAIRLINE,
  GLASS_SHADOW,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'

export const MONO = 'var(--font-mono)'

export interface TileShellProps {
  title: string
  subtitle?: string
  href?: string
  span?: 1 | 2
  fixedHeight?: number
  children: ReactNode
}

export function TileShell({ title, subtitle, href, span = 1, fixedHeight, children }: TileShellProps) {
  const gridStyle: CSSProperties = {
    gridColumn: span === 2 ? 'span 2' : 'span 1',
    height: fixedHeight ?? '100%',
    minHeight: 220,
  }
  const body = (
    <div
      style={{
        background: 'rgba(9,9,11,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${BORDER_HAIRLINE}`,
        borderRadius: 20,
        padding: 20,
        boxShadow: GLASS_SHADOW,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: href ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, margin: 0, letterSpacing: '0.02em' }}>
          {title}
        </h2>
        {subtitle ? (
          <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: MONO }}>{subtitle}</span>
        ) : null}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
  if (!href) {
    return <div style={gridStyle}>{body}</div>
  }
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block', ...gridStyle }}>
      {body}
    </Link>
  )
}
