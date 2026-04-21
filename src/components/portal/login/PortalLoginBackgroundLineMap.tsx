'use client'

import { useEffect, useRef, useState } from 'react'

interface Ping {
  id: number
  x: number
  y: number
  born: number
}

/**
 * Animated line-art map of the US↔MX border for the login screen.
 * Hatched MX/TX territories, 4 bridges each carrying 3 trucks (MX→US
 * emerald, US→MX amber) on continuous loops. Ephemeral emerald rings
 * ("pedimento cleared" pings) spawn every 2.4s at one of the bridges
 * and fade over 4s.
 *
 * Ported verbatim from
 * .planning/design-handoff/cruz-portal/project/src/login-backgrounds.jsx:131-208
 * (`--cruz-*` → `--portal-*`).
 *
 * Respects `prefers-reduced-motion` via the global CSS gate — animations
 * collapse to a static snapshot when motion is off.
 */
export function PortalLoginBackgroundLineMap() {
  const [phase, setPhase] = useState(0)
  const [pings, setPings] = useState<Ping[]>([])
  const pingIdRef = useRef(0)

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      setPhase((t - t0) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const pts = [
      { x: 48, y: 34 },
      { x: 50, y: 46 },
      { x: 52, y: 60 },
      { x: 51, y: 72 },
    ]
    const spawn = () => {
      const p = pts[Math.floor(Math.random() * pts.length)]
      const id = ++pingIdRef.current
      setPings((prev) => [...prev, { id, x: p.x, y: p.y, born: performance.now() }])
      setTimeout(() => setPings((prev) => prev.filter((x) => x.id !== id)), 4000)
    }
    const interval = setInterval(spawn, 2400)
    spawn()
    return () => clearInterval(interval)
  }, [])

  const bridges = [
    { y: 34, s: 22 },
    { y: 46, s: 18 },
    { y: 60, s: 26 },
    { y: 72, s: 30 },
  ]

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        overflow: 'hidden',
        background: 'var(--portal-ink-0)',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          opacity: 0.45,
        }}
      >
        <defs>
          <pattern
            id="portal-bg-ha-us"
            patternUnits="userSpaceOnUse"
            width="2"
            height="2"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="2" stroke="var(--portal-line-2)" strokeWidth="0.1" />
          </pattern>
          <pattern
            id="portal-bg-ha-mx"
            patternUnits="userSpaceOnUse"
            width="2"
            height="2"
            patternTransform="rotate(-45)"
          >
            <line x1="0" y1="0" x2="0" y2="2" stroke="var(--portal-line-2)" strokeWidth="0.1" />
          </pattern>
          <radialGradient id="portal-bg-ping">
            <stop offset="0%" stopColor="var(--portal-green-2)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--portal-green-2)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Hatched landmasses */}
        <path
          d="M 0 0 L 100 0 L 100 50 Q 82 43, 66 50 Q 50 58, 34 50 Q 18 42, 0 50 Z"
          fill="url(#portal-bg-ha-us)"
        />
        <path
          d="M 0 52 Q 18 44, 34 52 Q 50 60, 66 52 Q 84 45, 100 54 L 100 100 L 0 100 Z"
          fill="url(#portal-bg-ha-mx)"
        />
        {/* River */}
        <path
          d="M 0 51 Q 18 43, 34 51 Q 50 59, 66 51 Q 84 44, 100 53"
          fill="none"
          stroke="var(--portal-ice-2)"
          strokeWidth="0.4"
          opacity="0.8"
        />
        {/* Country labels */}
        <text
          x="50"
          y="18"
          fill="var(--portal-fg-3)"
          fontSize="5"
          letterSpacing="0.4"
          fontFamily="var(--portal-font-serif)"
          fontStyle="italic"
          textAnchor="middle"
          opacity="0.5"
        >
          Texas
        </text>
        <text
          x="50"
          y="92"
          fill="var(--portal-fg-3)"
          fontSize="5"
          letterSpacing="0.4"
          fontFamily="var(--portal-font-serif)"
          fontStyle="italic"
          textAnchor="middle"
          opacity="0.5"
        >
          Tamaulipas
        </text>
        {/* Bridges with trucks */}
        {bridges.map((b, i) => (
          <g key={i}>
            <path
              d={`M 35 ${b.y} Q 50 ${b.y + (i % 2 ? 0.8 : -0.8)}, 65 ${b.y}`}
              fill="none"
              stroke="var(--portal-fg-3)"
              strokeWidth="0.2"
              opacity="0.7"
            />
            {[0, 1, 2].map((l) => {
              const t = ((phase + l * (b.s / 3)) / b.s) % 1
              return (
                <g key={l}>
                  <rect
                    x={35 + t * 30 - 0.4}
                    y={b.y - 0.5}
                    width="0.8"
                    height="0.4"
                    fill="var(--portal-green-2)"
                    opacity="0.8"
                  />
                  <rect
                    x={65 - t * 30 - 0.4}
                    y={b.y + 0.1}
                    width="0.8"
                    height="0.4"
                    fill="var(--portal-amber)"
                    opacity="0.7"
                  />
                </g>
              )
            })}
          </g>
        ))}
        {pings.map((p) => {
          const age = (performance.now() - p.born) / 4000
          return (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={0.5 + age * 6}
              fill="none"
              stroke="var(--portal-green-2)"
              strokeWidth="0.12"
              opacity={Math.max(0, 1 - age)}
            />
          )
        })}
      </svg>
    </div>
  )
}
