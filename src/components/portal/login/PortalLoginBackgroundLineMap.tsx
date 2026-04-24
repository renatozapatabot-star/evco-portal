'use client'

import { useEffect, useRef, useState } from 'react'

interface Ping {
  id: number
  x: number
  y: number
  born: number
}

const BRIDGES = [
  { y: 34, speed: 22, offset: 0 },
  { y: 46, speed: 18, offset: 5 },
  { y: 60, speed: 26, offset: 2 },
  { y: 72, speed: 30, offset: 8 },
] as const

const BRIDGE_POINTS = [
  { x: 48, y: 34 },
  { x: 50, y: 46 },
  { x: 52, y: 60 },
  { x: 51, y: 72 },
]

/**
 * PORTAL login — ambient cartographic background.
 *
 * Direct port of `LivingBackground` from the Claude Design bundle
 * (`cruz-portal/project/src/screen-login.jsx:11-182`). A slow, quiet
 * top-down portrait of the Laredo corridor — topo-dot texture, a
 * hand-drawn Rio Grande with flowing current dashes, four bridge arcs
 * with sparse truck flows (emerald N-bound, amber S-bound), occasional
 * pedimento-cleared pings blooming at inspection points, a small
 * compass glyph at the top-right, and corner country labels. Two
 * drifting radial clouds + a painterly edge-vignette wash compose the
 * breathing atmosphere.
 *
 * Export name kept as `PortalLoginBackgroundLineMap` for import
 * stability (`/login`, `/admin/design`). The component now matches the
 * quieter PORTAL.html reference, not the earlier louder line-map.
 *
 * Respects `prefers-reduced-motion` — RAF phase and ping spawns halt,
 * leaving a static snapshot.
 */
export function PortalLoginBackgroundLineMap() {
  const [phase, setPhase] = useState(0)
  const [pings, setPings] = useState<Ping[]>([])
  const pingIdRef = useRef(0)
  const phaseRef = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const seconds = (t - t0) / 1000
      phaseRef.current = seconds
      setPhase(seconds)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const spawn = () => {
      const p = BRIDGE_POINTS[Math.floor(Math.random() * BRIDGE_POINTS.length)]
      const id = ++pingIdRef.current
      setPings((prev) => [
        ...prev,
        {
          id,
          x: p.x + (Math.random() - 0.5) * 2,
          y: p.y + (Math.random() - 0.5) * 1.2,
          born: phaseRef.current,
        },
      ])
      setTimeout(() => setPings((prev) => prev.filter((q) => q.id !== id)), 4000)
    }
    const interval = setInterval(spawn, 2400)
    spawn()
    return () => clearInterval(interval)
  }, [])

  const truckOf = (bridge: (typeof BRIDGES)[number], dir: 'N' | 'S', lane: number) => {
    const period = bridge.speed
    const start = (phase + bridge.offset + lane * (period / 3)) / period
    const t = start % 1
    const x = dir === 'N' ? 35 + t * 30 : 65 - t * 30
    return { x, y: bridge.y + (dir === 'N' ? -0.35 : 0.35) }
  }

  // Slow drifting cloud offsets (parallax layers).
  const c1x = -50 + ((phase / 180) % 1) * 200
  const c2x = -80 + ((phase / 240 + 0.4) % 1) * 220

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Drifting atmospheric clouds — two blurred radial parallax layers. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 60% 40% at ${c1x}% 30%, color-mix(in oklch, var(--portal-green-2) 6%, transparent) 0%, transparent 60%),
            radial-gradient(ellipse 50% 35% at ${c2x}% 70%, color-mix(in oklch, var(--portal-ice-2) 4%, transparent) 0%, transparent 60%)
          `,
          filter: 'blur(20px)',
        }}
      />

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          opacity: 0.42,
        }}
      >
        <defs>
          <radialGradient id="portal-bg-ping" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--portal-green-2)" stopOpacity="1" />
            <stop offset="70%" stopColor="var(--portal-green-2)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--portal-green-2)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="portal-bg-river" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--portal-ice-2)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--portal-ice-2)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--portal-ice-2)" stopOpacity="0" />
          </linearGradient>
          <pattern id="portal-bg-topo" x="0" y="0" width="3.5" height="3.5" patternUnits="userSpaceOnUse">
            <circle cx="1.75" cy="1.75" r="0.22" fill="var(--portal-line-2)" opacity="0.35" />
          </pattern>
        </defs>

        {/* Dot-topography landmass */}
        <rect width="100" height="100" fill="url(#portal-bg-topo)" />

        {/* Delicate country labels — editorial mono, corner-tucked */}
        <g opacity="0.55">
          <text
            x="8"
            y="14"
            fill="var(--portal-fg-4)"
            fontSize="2.2"
            letterSpacing="0.4"
            fontFamily="var(--portal-font-mono)"
          >
            TEXAS
          </text>
          <text
            x="8"
            y="17"
            fill="var(--portal-fg-5)"
            fontSize="1.2"
            letterSpacing="0.3"
            fontFamily="var(--portal-font-mono)"
          >
            UNITED STATES · CBP LAREDO
          </text>
          <text
            x="80"
            y="93"
            fill="var(--portal-fg-4)"
            fontSize="2.2"
            letterSpacing="0.4"
            fontFamily="var(--portal-font-mono)"
            textAnchor="end"
          >
            TAMAULIPAS
          </text>
          <text
            x="80"
            y="96"
            fill="var(--portal-fg-5)"
            fontSize="1.2"
            letterSpacing="0.3"
            fontFamily="var(--portal-font-mono)"
            textAnchor="end"
          >
            MÉXICO · ADUANA 240
          </text>
        </g>

        {/* Rio Grande — flowing 4-layer stack */}
        <path
          d="M 0 52 Q 18 44, 34 52 Q 50 60, 66 52 Q 84 45, 100 54"
          fill="none"
          stroke="url(#portal-bg-river)"
          strokeWidth="1.6"
        />
        <path
          d="M 0 52 Q 18 44, 34 52 Q 50 60, 66 52 Q 84 45, 100 54"
          fill="none"
          stroke="var(--portal-ice-2)"
          strokeWidth="0.18"
          opacity="0.5"
        />
        <path
          d="M 0 52 Q 18 44, 34 52 Q 50 60, 66 52 Q 84 45, 100 54"
          fill="none"
          stroke="var(--portal-ice-2)"
          strokeWidth="0.28"
          strokeDasharray="1.5 6"
          opacity="0.6"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-7.5" dur="4s" repeatCount="indefinite" />
        </path>
        <path
          d="M 0 52 Q 18 44, 34 52 Q 50 60, 66 52 Q 84 45, 100 54"
          fill="none"
          stroke="var(--portal-green-5)"
          strokeWidth="0.15"
          strokeDasharray="0.5 0.5"
          opacity="0.55"
        />

        {/* Bridge arcs + sparse truck flows */}
        {BRIDGES.map((b, i) => (
          <g key={i}>
            <path
              d={`M 35 ${b.y} Q 50 ${b.y + (i % 2 === 0 ? -0.8 : 0.8)}, 65 ${b.y}`}
              fill="none"
              stroke="var(--portal-fg-4)"
              strokeWidth="0.28"
              opacity="0.55"
            />
            {[0, 1, 2].map((lane) => {
              const tN = truckOf(b, 'N', lane)
              const tS = truckOf(b, 'S', lane)
              return (
                <g key={lane}>
                  <rect
                    x={tN.x - 0.4}
                    y={tN.y - 0.22}
                    width="0.9"
                    height="0.44"
                    fill="var(--portal-green-2)"
                    opacity="0.85"
                    rx="0.08"
                  />
                  <rect
                    x={tS.x - 0.4}
                    y={tS.y - 0.22}
                    width="0.9"
                    height="0.44"
                    fill="var(--portal-amber)"
                    opacity="0.7"
                    rx="0.08"
                  />
                </g>
              )
            })}
          </g>
        ))}

        {/* Highway corridor — soft dashed spine */}
        <path
          d="M 50 0 L 50 34 L 49 46 L 50 60 L 50 72 L 51 85 L 50 100"
          fill="none"
          stroke="var(--portal-line-2)"
          strokeDasharray="0.4 1.2"
          strokeWidth="0.18"
          opacity="0.5"
        />

        {/* Pedimento-cleared pings — age derived from phase (4s lifetime) */}
        {pings.map((p) => {
          const age = Math.min(1, Math.max(0, (phase - p.born) / 4))
          return (
            <g key={p.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={0.4 + age * 7}
                fill="none"
                stroke="var(--portal-green-2)"
                strokeWidth="0.12"
                opacity={Math.max(0, 1 - age)}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={0.5 + age * 3}
                fill="none"
                stroke="var(--portal-green-2)"
                strokeWidth="0.08"
                opacity={Math.max(0, 1 - age) * 0.7}
              />
              <circle cx={p.x} cy={p.y} r="0.9" fill="url(#portal-bg-ping)" opacity={Math.max(0, 1 - age * 0.6)} />
            </g>
          )
        })}

        {/* Compass — top-right, quiet */}
        <g transform="translate(94 8)" opacity="0.4">
          <circle cx="0" cy="0" r="2.2" fill="none" stroke="var(--portal-fg-5)" strokeWidth="0.12" />
          <line x1="0" y1="-2.2" x2="0" y2="-0.6" stroke="var(--portal-green-2)" strokeWidth="0.25" />
          <text
            x="0"
            y="-2.7"
            textAnchor="middle"
            fill="var(--portal-fg-3)"
            fontSize="1"
            fontFamily="var(--portal-font-mono)"
          >
            N
          </text>
        </g>
      </svg>

      {/* Painterly wash — center breath + top/bottom edge vignettes */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 45% 35% at 50% 50%, color-mix(in oklch, var(--portal-green-2) 4%, transparent) 0%, transparent 70%),
            radial-gradient(ellipse 70% 100% at 50% 0%, color-mix(in oklch, var(--portal-ink-0) 40%, transparent) 0%, transparent 45%),
            radial-gradient(ellipse 70% 100% at 50% 100%, color-mix(in oklch, var(--portal-ink-0) 40%, transparent) 0%, transparent 45%)
          `,
        }}
      />
    </div>
  )
}
