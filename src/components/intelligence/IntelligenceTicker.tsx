'use client'

/**
 * IntelligenceTicker — thin monochrome ticker strip above main content.
 *
 * Role-personalized feed: each user sees the live intelligence that matters
 * most for their job. Fetches from /api/intelligence/feed on mount, refetches
 * every 60 seconds. Silent on failure — hides if empty.
 *
 * Respects prefers-reduced-motion: pauses the CSS scroll animation.
 */

import { useEffect, useState } from 'react'

type TickerTrend = 'up' | 'down' | 'flat'
export interface TickerItem {
  id: string
  icon?: string
  label: string
  value: string
  trend?: TickerTrend
  href?: string
}

function TrendGlyph({ trend }: { trend?: TickerTrend }) {
  if (!trend || trend === 'flat') return null
  const isUp = trend === 'up'
  return (
    <span
      aria-hidden
      style={{
        marginLeft: 4,
        fontSize: 'var(--aguila-fs-label)',
        color: isUp ? 'var(--portal-fg-1)' : 'var(--portal-status-amber-fg)',
        fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
      }}
    >
      {isUp ? '\u2191' : '\u2193'}
    </span>
  )
}

function TickerRow({ items }: { items: TickerItem[] }) {
  return (
    <>
      {items.map((it, i) => {
        const Wrapper: 'a' | 'span' = it.href ? 'a' : 'span'
        const wrapperProps = it.href ? { href: it.href } : {}
        return (
          <Wrapper
            key={`${it.id}-${i}`}
            {...wrapperProps}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              paddingInline: 18,
              whiteSpace: 'nowrap',
              color: 'var(--portal-fg-1)',
              textDecoration: 'none',
              cursor: it.href ? 'pointer' : 'default',
            }}
          >
            {it.icon ? <span style={{ opacity: 0.7 }}>{it.icon}</span> : null}
            <span style={{ color: 'var(--portal-fg-5)', fontSize: 'inherit' }}>{it.label}</span>
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                color: 'var(--portal-fg-1)',
              }}
            >
              {it.value}
            </span>
            <TrendGlyph trend={it.trend} />
            <span aria-hidden style={{ color: 'rgba(192,197,206,0.28)', marginLeft: 10 }}>
              &middot;
            </span>
          </Wrapper>
        )
      })}
    </>
  )
}

export default function IntelligenceTicker() {
  const [items, setItems] = useState<TickerItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/intelligence/feed', { credentials: 'same-origin' })
        if (!res.ok) return
        const json = (await res.json()) as { data?: { items?: TickerItem[] } | null }
        if (cancelled) return
        const next = json?.data?.items ?? []
        const unique = Array.from(
          new Map(next.map((i) => [i.id ?? i.label, i])).values(),
        )
        setItems(unique.length > 0 ? unique : null)
      } catch {
        // Silent — no toast, ticker just hides.
      }
    }
    load()
    const t = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  // Dev-mode regression guard — warn if something ever mounts this
  // ticker twice (layout + page, hydration duplicate, etc). Ships
  // stripped in production builds.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const count = document.querySelectorAll('[data-ticker-root]').length
    if (count > 1) {
      // eslint-disable-next-line no-console
      console.warn(`[CRUZ] Duplicate IntelligenceTicker detected: ${count} mounted`)
    }
  }, [])

  if (!items || items.length === 0) return null

  // Static mode: when there are fewer items than the marquee needs to
  // fill the viewport, the "seamless loop" renders BOTH copies visible
  // on screen at once (Renato's 2026-04-16 screenshot showed
  // "Puente líder · USD/MXN · Puente líder · USD/MXN"). Render the row
  // once and skip the animation instead.
  const sparseContent = items.length <= 2

  return (
    <div
      data-ticker-root
      aria-label="Inteligencia en vivo"
      className="aguila-ticker-root"
      style={{
        position: 'relative',
        height: 32,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.045)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(192,197,206,0.18)',
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
        fontSize: 'var(--aguila-fs-compact)',
        lineHeight: '32px',
      }}
    >
      <div
        className={sparseContent ? 'aguila-ticker-static' : 'aguila-ticker-track'}
        style={{
          display: 'inline-flex',
          whiteSpace: 'nowrap',
          willChange: sparseContent ? undefined : 'transform',
        }}
      >
        <TickerRow items={items} />
        {!sparseContent && <TickerRow items={items} />}
      </div>
      <style jsx>{`
        @keyframes aguila-ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .aguila-ticker-track {
          animation: aguila-ticker-scroll 60s linear infinite;
        }
        @media (max-width: 480px) {
          /* Client cockpit stays calm on mobile — ticker is hidden
             rather than scrolled. "Nice to have, not mission critical
             for clients" (Block 1.2 design note). Reappears at ≥ 481px. */
          :global(.aguila-ticker-root) {
            display: none !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .aguila-ticker-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
