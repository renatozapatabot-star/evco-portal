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
        fontSize: 10,
        color: isUp ? '#E8EAED' : '#D4952A',
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
              color: '#E8EAED',
              textDecoration: 'none',
              cursor: it.href ? 'pointer' : 'default',
            }}
          >
            {it.icon ? <span style={{ opacity: 0.7 }}>{it.icon}</span> : null}
            <span style={{ color: '#7A7E86', fontSize: 'inherit' }}>{it.label}</span>
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                color: '#E8EAED',
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

  if (!items || items.length === 0) return null

  return (
    <div
      aria-label="Inteligencia en vivo"
      style={{
        position: 'relative',
        height: 32,
        overflow: 'hidden',
        background: 'rgba(9,9,11,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(192,197,206,0.18)',
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
        fontSize: 12,
        lineHeight: '32px',
      }}
    >
      <div
        className="aguila-ticker-track"
        style={{
          display: 'inline-flex',
          whiteSpace: 'nowrap',
          willChange: 'transform',
        }}
      >
        <TickerRow items={items} />
        <TickerRow items={items} />
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
          .aguila-ticker-track {
            animation-duration: 90s;
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
