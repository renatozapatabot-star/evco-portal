/**
 * PortalTicker — horizontal scrolling data strip.
 *
 * Mirrors the `<Ticker>` reference from
 * `/tmp/portal_design/cruz-portal/project/src/screen-dashboard.jsx`.
 * Uses the `.portal-ticker` class from `portal-components.css`; every
 * visual token routes through `--portal-*` vars.
 *
 * Respects `prefers-reduced-motion: reduce` and `[data-motion="off"]`
 * on `<html>` — the CSS handles both gates.
 *
 * Items are doubled internally so the scroll animation appears seamless
 * (the second set is aria-hidden for screen readers).
 */

import type { ReactNode } from 'react'

export type PortalTickerItem = {
  label: string
  value: ReactNode
  tone?: 'neutral' | 'live' | 'warn' | 'alert'
}

export interface PortalTickerProps {
  items: PortalTickerItem[]
  ariaLabel?: string
}

const TONE_COLOR: Record<NonNullable<PortalTickerItem['tone']>, string> = {
  neutral: 'var(--portal-fg-2)',
  live: 'var(--portal-green-2)',
  warn: 'var(--portal-amber)',
  alert: 'var(--portal-red)',
}

export function PortalTicker({ items, ariaLabel = 'Datos en vivo' }: PortalTickerProps) {
  if (items.length === 0) return null

  const renderItem = (item: PortalTickerItem, i: number, hidden: boolean) => (
    <span
      key={`${hidden ? 'h' : 'v'}-${i}`}
      className="portal-ticker__item"
      aria-hidden={hidden ? 'true' : undefined}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
    >
      <span className="portal-eyebrow" style={{ color: 'var(--portal-fg-4)' }}>
        {item.label}
      </span>
      <span
        className="portal-num"
        style={{ color: TONE_COLOR[item.tone ?? 'neutral'], fontWeight: 500 }}
      >
        {item.value}
      </span>
    </span>
  )

  return (
    <div className="portal-ticker" role="marquee" aria-label={ariaLabel}>
      <div className="portal-ticker__track">
        {items.map((item, i) => renderItem(item, i, false))}
        {items.map((item, i) => renderItem(item, i, true))}
      </div>
    </div>
  )
}
