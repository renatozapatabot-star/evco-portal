'use client'

import { useEffect, useState } from 'react'

/**
 * PORTAL login — Bg_PuenteII (cable-stayed Puente Solidaridad in side
 * silhouette). Direct port of `Bg_PuenteII` from the Claude Design
 * bundle (`cruz-portal/project/src/login-backgrounds.jsx:1536-1687`).
 *
 * Selected as the canonical login background per Tito's call on
 * 2026-05-01 — the broker-recognition cue is the single MX-side
 * pylon + suspension cables + the deck of trucks crossing both
 * directions. The top-down corridor map (PortalLoginBackgroundLineMap)
 * stays in the registry but is no longer the default.
 *
 * Renders against a soft warm-radial canvas (oklch verbatim from the
 * design — these are not in the token system because they're
 * scene-specific atmosphere). The bridge SVG drifts ~0.5px/sec, the
 * trucks animate via setT(now/1000) RAF loop.
 *
 * Includes the NASA-console-style time stamp top-left
 * (04:18 · CST · PUENTE II SOLIDARIDAD · 27.5152°N 99.5077°W).
 *
 * Respects `prefers-reduced-motion` — RAF halts, leaving a static
 * snapshot.
 */
export function PortalLoginBackgroundPuente() {
  const [t, setT] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      setT((now - t0) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // 0.5 px/sec drift, looping every ~480s
  const drift = ((t * 0.5) % 240) - 120

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background:
          'radial-gradient(ellipse at 50% 80%, oklch(0.18 0.012 70) 0%, oklch(0.13 0.006 80) 60%, oklch(0.11 0.004 80) 100%)',
      }}
    >
      {/* Distant water hairline (Río Bravo) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '70%',
          height: 1,
          background:
            'linear-gradient(to right, transparent, oklch(0.42 0.04 220 / 0.35) 30%, oklch(0.42 0.04 220 / 0.35) 70%, transparent)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '70.5%',
          height: 1,
          background:
            'linear-gradient(to right, transparent, oklch(0.32 0.03 220 / 0.25) 40%, oklch(0.32 0.03 220 / 0.25) 60%, transparent)',
        }}
      />

      {/* Mexico bank label, far left */}
      <div
        style={{
          position: 'absolute',
          left: 28,
          top: '74%',
          fontFamily: 'var(--portal-font-mono)',
          fontSize: 9, // WHY: handoff verbatim (login-backgrounds.jsx:1565)
          letterSpacing: '0.28em',
          color: 'oklch(0.45 0.01 80)',
          textTransform: 'uppercase',
        }}
      >
        ← Nuevo Laredo · MX
      </div>
      <div
        style={{
          position: 'absolute',
          right: 28,
          top: '74%',
          fontFamily: 'var(--portal-font-mono)',
          fontSize: 9, // WHY: handoff verbatim (login-backgrounds.jsx:1571)
          letterSpacing: '0.28em',
          color: 'oklch(0.45 0.01 80)',
          textTransform: 'uppercase',
        }}
      >
        Laredo, TX · US →
      </div>

      {/* The bridge silhouette — drifts very slowly */}
      <svg
        viewBox="0 0 1600 600"
        preserveAspectRatio="xMidYEnd meet"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '85%',
          transform: `translateX(${drift}px)`,
          opacity: 0.85,
        }}
      >
        {/* Distant land (Texas side) — softer */}
        <path
          d="M 0 470 L 200 465 L 350 470 L 520 462 L 700 468 L 900 460 L 1100 465 L 1300 458 L 1600 470 L 1600 600 L 0 600 Z"
          fill="oklch(0.16 0.008 80)"
          opacity="0.9"
        />
        {/* MX bank — slightly closer */}
        <path
          d="M 0 480 L 180 475 L 380 482 L 560 472 L 760 484 L 980 476 L 1200 482 L 1400 474 L 1600 482 L 1600 600 L 0 600 Z"
          fill="oklch(0.18 0.008 80)"
          opacity="0.95"
        />

        {/* Puente II — central span. Cable-stayed pylon + suspension
            cables + deck. Real Puente Solidaridad is a continuous
            box-girder, but the iconic broker recognition cue is the
            truss with vertical hangers. */}
        <g stroke="oklch(0.55 0.04 80)" strokeWidth="1.2" fill="none" opacity="0.85">
          {/* Bridge deck — straight line across Río Bravo */}
          <line x1="200" y1="430" x2="1400" y2="430" />
          <line x1="200" y1="436" x2="1400" y2="436" />
          {/* Lower truss — slight arch */}
          <path d="M 200 436 Q 800 470 1400 436" />
          {/* Vertical hangers between deck and truss */}
          {Array.from({ length: 24 }).map((_, i) => {
            const x = 220 + i * 50
            // sag depth varies parabolically
            const u = (x - 800) / 600
            const sagY = 436 + (1 - u * u) * 32
            return <line key={i} x1={x} y1="436" x2={x} y2={sagY} />
          })}
          {/* Pylon (single tower, MX side) — Puente II has a distinctive column */}
          <line x1="380" y1="280" x2="380" y2="430" />
          <line x1="386" y1="280" x2="386" y2="430" />
          <path d="M 376 280 Q 383 270 390 280" />
          {/* Stays radiating from pylon top */}
          {[230, 260, 290, 320, 350, 410, 450, 510, 580, 670].map((x, i) => (
            <line key={i} x1="383" y1="278" x2={x} y2="430" opacity={0.55} />
          ))}
        </g>

        {/* Tiny customs booth/light cluster on US side */}
        <g opacity="0.8">
          <rect
            x="1380"
            y="408"
            width="14"
            height="22"
            fill="oklch(0.20 0.008 80)"
            stroke="oklch(0.5 0.04 80)"
            strokeWidth="0.6"
          />
          <circle cx="1387" cy="406" r="0.8" fill="oklch(0.78 0.08 50)" />
        </g>

        {/* Ambient bridge traffic — multiple trucks crossing both
            directions. Reads as real port-of-entry flow; never
            identical, looped seamlessly. */}
        {/* MX→US lane (top of deck, y=427) — outbound */}
        {[
          { speed: 22, offset: 0, color: 'oklch(0.62 0.06 158)', size: 14 },
          { speed: 17, offset: 380, color: 'oklch(0.58 0.05 30)', size: 12 },
          { speed: 26, offset: 720, color: 'oklch(0.55 0.04 80)', size: 16 },
          { speed: 19, offset: 1050, color: 'oklch(0.50 0.03 80)', size: 13 },
        ].map((tr, i) => {
          const pos = ((t * tr.speed + tr.offset) % 1400) + 180
          const nearEnd = pos > 1300
          return (
            <g
              key={`mxus-${i}`}
              transform={`translate(${pos} 427)`}
              opacity={pos > 200 && pos < 1400 ? 0.9 : 0}
            >
              <rect x={-tr.size} y="-3" width={tr.size - 2} height="5.5" fill={tr.color} opacity="0.85" />
              <rect x="-2" y="-2.5" width="3" height="5" fill="oklch(0.45 0.03 80)" />
              <circle cx="1.5" cy="0" r="0.6" fill="oklch(0.85 0.10 60)" opacity={nearEnd ? 1 : 0.85} />
              <circle cx={-tr.size + 0.5} cy="0" r="0.4" fill="oklch(0.55 0.18 25)" opacity="0.6" />
            </g>
          )
        })}

        {/* US→MX lane (bottom of deck, y=434) — inbound, slower (waits) */}
        {[
          { speed: 14, offset: 200, color: 'oklch(0.50 0.03 80)', size: 13 },
          { speed: 11, offset: 540, color: 'oklch(0.48 0.04 220)', size: 14 },
          { speed: 16, offset: 880, color: 'oklch(0.55 0.04 80)', size: 12 },
        ].map((tr, i) => {
          const pos = 1400 - ((t * tr.speed + tr.offset) % 1400) - 180
          return (
            <g
              key={`usmx-${i}`}
              transform={`translate(${pos} 434) scale(-1 1)`}
              opacity={pos > 200 && pos < 1400 ? 0.78 : 0}
            >
              <rect x={-tr.size} y="-3" width={tr.size - 2} height="5" fill={tr.color} opacity="0.75" />
              <rect x="-2" y="-2" width="3" height="4" fill="oklch(0.40 0.03 80)" opacity="0.85" />
              <circle cx="1.5" cy="0" r="0.5" fill="oklch(0.78 0.08 50)" opacity="0.7" />
            </g>
          )
        })}
      </svg>

      {/* Top vignette — pulls focus down to the bridge horizon */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 0%, transparent 0%, oklch(0.13 0.006 80 / 0.4) 60%, oklch(0.13 0.006 80) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* NASA-console time stamp — top-left.
          Note: the design hardcodes "04:18 · CST · PUENTE II SOLIDARIDAD
          · 27.5152°N 99.5077°W" as a static atmosphere prop, not a live
          clock. Kept verbatim so it reads as a stage-set placard rather
          than another moving signal competing with the EN LÍNEA pill. */}
      <div
        style={{
          position: 'absolute',
          left: 32,
          top: 28,
          fontFamily: 'var(--portal-font-mono)',
          fontSize: 9, // WHY: handoff verbatim (login-backgrounds.jsx:1674)
          letterSpacing: '0.22em',
          color: 'oklch(0.55 0.04 80)',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            // WHY: --cruz-warm-2 verbatim from design tokens.css:43.
            // --portal-warm-* tokens don't exist; inlined to avoid
            // adding a one-use token.
            background: 'oklch(0.62 0.13 50)',
            boxShadow: '0 0 6px oklch(0.62 0.13 50 / 0.22)',
          }}
        />
        <span>04:18 · CST · PUENTE II SOLIDARIDAD · 27.5152°N 99.5077°W</span>
      </div>
    </div>
  )
}
