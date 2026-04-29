'use client'

/**
 * PortalLiveBorder — La Frontera en Vivo.
 *
 * Wide cinematic panel above the cockpit module grid showing the
 * Laredo–Nuevo Laredo crossing in real time. MX side on the right,
 * US side on the left, bridge in the middle. Three trucks animate
 * across the bridge; when the lead crosses the midpoint, a global
 * "crossing event" fires (`window.__cruzCrossingBus.emit(...)`)
 * and the panel pulses.
 *
 * Ported from
 * .planning/design-handoff/cruz-portal/project/src/live-border.jsx
 * (419 lines, claude.ai/design CRUZ Portal handoff).
 *
 * 2026-04-28 founder-overrides entry restored this surface to operator
 * + owner cockpits per Renato IV directive ("the way it is on the
 * Claude Design handoff"). NOT placed on /inicio (client surface stays
 * calm per HARD invariant #11 + client-accounting-ethics §tone).
 *
 * Data plumbing: defaults are presentational (matches the handoff).
 * Callers may pass real telemetry via props once a tenant-scoped
 * traficos query is wired upstream — the component never reads
 * cross-tenant data on its own.
 */

import { useEffect, useRef, useState } from 'react'

/** Crossing event payload shared via `window.__cruzCrossingBus`. */
export interface CruzCrossingEvent {
  label: string
  ts: string
  id: number
}

interface CrossingBus {
  on: (fn: (evt: CruzCrossingEvent) => void) => () => boolean
  emit: (evt: CruzCrossingEvent) => void
}

declare global {
  interface Window {
    __cruzCrossingBus?: CrossingBus
    __portalOpenTheater?: (pedimento: string) => void
  }
}

/** Set up the global pub/sub once on first import (browser-only). */
function ensureCrossingBus(): CrossingBus | null {
  if (typeof window === 'undefined') return null
  if (window.__cruzCrossingBus) return window.__cruzCrossingBus
  const subs = new Set<(evt: CruzCrossingEvent) => void>()
  const bus: CrossingBus = {
    on: (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    emit: (evt) => {
      subs.forEach((fn) => {
        try {
          fn(evt)
        } catch {
          /* subscriber error is its own problem */
        }
      })
    },
  }
  window.__cruzCrossingBus = bus
  return bus
}

export interface PortalLiveBorderProps {
  /** Today's running crossing count. Default 38 (handoff baseline). */
  crossingsToday?: number
  /** Trucks currently on the bridge. Default 3. */
  trucksOnBridge?: number
  /** Average wait time displayed in the header chip. Default "14m". */
  averageWait?: string
  /** Active truck label rendered in the telemetry cell. Default "TX-4829". */
  activeTruckLabel?: string
  /** Pedimento number for the active truck. */
  pedimento?: string
  /** Active truck cargo description. */
  activeCargo?: string
  /** Local outdoor temperature display. */
  temperature?: string
  /** Weather description. */
  weather?: string
  /** Average crossing time for "Tiempo de cruce" cell. */
  averageCrossingTime?: string
  /** Comparison line (e.g. "promedio hoy · -4m vs ayer"). */
  averageCrossingComparison?: string
  /** Pedimento metadata shown in the CTA strip. */
  ctaMeta?: string
  /** Callback when "VER FLUJO COMPLETO" is clicked. Defaults to opening
   * `window.__portalOpenTheater(pedimento)` if defined. */
  onOpenTheater?: (pedimento: string) => void
  /** Disable all RAF-driven motion (still renders static SVG). */
  reducedMotion?: boolean
}

interface BridgeTruckProps {
  delay: number
  speed: number
  label: string
  active?: boolean
  reducedMotion: boolean
  onCross: (label: string) => void
}

/** Single truck on the bridge — animates left→right (the parent flips X). */
function BridgeTruck({
  delay,
  speed,
  label,
  active = false,
  reducedMotion,
  onCross,
}: BridgeTruckProps) {
  const [t, setT] = useState(0) // 0..1 position along bridge
  const crossedRef = useRef(false)

  useEffect(() => {
    if (reducedMotion) {
      // WHY: bounded one-shot state init for the static frame; not a render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setT(active ? 0.5 : 0.2 + Math.random() * 0.3)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const elapsed = (now - t0) / 1000 - delay
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick)
        return
      }
      const pos = (elapsed % speed) / speed
      if (pos < 0.1 && crossedRef.current) crossedRef.current = false
      if (pos >= 0.5 && !crossedRef.current) {
        crossedRef.current = true
        onCross(label)
      }
      setT(pos)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [delay, speed, label, active, reducedMotion, onCross])

  const x = 26 + t * 48
  const atBorder = t > 0.45 && t < 0.55

  return (
    <g style={{ transition: 'none' }}>
      <line
        x1={26}
        y1={50}
        x2={x}
        y2={50}
        stroke="var(--portal-green-2)"
        strokeWidth={active ? 0.6 : 0.3}
        opacity={active ? 0.5 : 0.2}
        strokeDasharray="1 1"
      />
      <g transform={`translate(${x} 50)`}>
        <rect
          x={-1.6}
          y={-0.9}
          width={2.6}
          height={1.8}
          rx={0.2}
          fill={active ? 'var(--portal-green-2)' : 'var(--portal-fg-4)'}
          opacity={atBorder ? 1 : 0.9}
        >
          {atBorder && !reducedMotion && (
            <animate
              attributeName="opacity"
              values="0.8;1;0.8"
              dur="0.5s"
              repeatCount="indefinite"
            />
          )}
        </rect>
        <rect
          x={1}
          y={-0.7}
          width={0.7}
          height={1.4}
          rx={0.1}
          fill={active ? 'var(--portal-green-3)' : 'var(--portal-fg-5)'}
        />
        {active && (
          <g transform="scale(-1 1)">
            <text
              x={0}
              y={-1.8}
              fontSize={1.6}
              fontFamily="var(--portal-font-mono)"
              fill="var(--portal-green-2)"
              textAnchor="middle"
              letterSpacing={0.3}
            >
              {label}
            </text>
          </g>
        )}
      </g>
    </g>
  )
}

interface StatProps {
  label: string
  value: string | number
  live?: boolean
  accent?: boolean
}

function Stat({ label, value, live, accent }: StatProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 2,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--portal-font-mono)',
          fontSize: 9, // WHY: handoff verbatim — design uses sub-token sizes
          letterSpacing: '0.22em',
          color: 'var(--portal-fg-5)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: live
            ? 'var(--portal-font-mono)'
            : 'var(--portal-font-display)',
          fontSize: live ? 16 : 18,
          fontWeight: live ? 500 : 400,
          color: accent ? 'var(--portal-green-2)' : 'var(--portal-fg-1)',
          letterSpacing: live ? '0.04em' : '0.02em',
          fontVariantNumeric: 'tabular-nums',
          textShadow: accent ? '0 0 12px var(--portal-green-glow)' : 'none',
        }}
      >
        {value}
      </span>
    </div>
  )
}

interface TelemetryCellProps {
  label: string
  value: string
  sub: string
  accent?: boolean
}

function TelemetryCell({ label, value, sub, accent }: TelemetryCellProps) {
  return (
    <div
      style={{
        padding: '14px 20px',
        borderRight: '1px solid var(--portal-line-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--portal-font-mono)',
          fontSize: 9, // WHY: handoff verbatim — design uses sub-token sizes
          letterSpacing: '0.22em',
          color: 'var(--portal-fg-5)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--portal-font-display)',
          fontSize: 18, // WHY: handoff verbatim — design uses sub-token sizes
          fontWeight: 400,
          color: accent ? 'var(--portal-green-2)' : 'var(--portal-fg-1)',
          letterSpacing: '0.01em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--portal-font-sans)',
          fontSize: 11, // WHY: handoff verbatim — design uses sub-token sizes
          color: 'var(--portal-fg-4)',
          lineHeight: 1.3,
        }}
      >
        {sub}
      </div>
    </div>
  )
}

export function PortalLiveBorder({
  crossingsToday: initialCrossings = 38,
  trucksOnBridge = 3,
  averageWait = '14m',
  activeTruckLabel = 'TX-4829',
  pedimento = '240-2601-6002104',
  activeCargo = '28,450 kg · autopartes · Monterrey → Laredo TX',
  temperature = '24°C',
  weather = 'cielo despejado · viento 12 km/h NE',
  averageCrossingTime = '8 min',
  averageCrossingComparison = 'promedio hoy · -4m vs ayer',
  ctaMeta,
  onOpenTheater,
  reducedMotion: reducedMotionProp,
}: PortalLiveBorderProps) {
  const [crossings, setCrossings] = useState(initialCrossings)
  const [lastEvent, setLastEvent] = useState<CruzCrossingEvent | null>(null)
  const [flash, setFlash] = useState(false)
  const [clock, setClock] = useState(() =>
    new Date().toTimeString().slice(0, 8),
  )
  const [systemReducedMotion, setSystemReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    // WHY: matchMedia is the canonical external-system subscribe pattern;
    // initial sync + change-listener is the documented React idiom for it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSystemReducedMotion(m.matches)
    const listener = (e: MediaQueryListEvent) => setSystemReducedMotion(e.matches)
    m.addEventListener('change', listener)
    return () => m.removeEventListener('change', listener)
  }, [])

  const reducedMotion = reducedMotionProp ?? systemReducedMotion

  useEffect(() => {
    if (reducedMotion) return
    const h = setInterval(() => {
      setClock(new Date().toTimeString().slice(0, 8))
    }, 1000)
    return () => clearInterval(h)
  }, [reducedMotion])

  const handleCrossing = (truckLabel: string) => {
    setCrossings((c) => c + 1)
    setFlash(true)
    const ts = new Date().toTimeString().slice(0, 8)
    const evt: CruzCrossingEvent = { label: truckLabel, ts, id: Date.now() }
    setLastEvent(evt)
    setTimeout(() => setFlash(false), 1200)
    const bus = ensureCrossingBus()
    bus?.emit(evt)
  }

  const handleOpenTheater = () => {
    if (onOpenTheater) {
      onOpenTheater(pedimento)
      return
    }
    if (typeof window !== 'undefined' && window.__portalOpenTheater) {
      window.__portalOpenTheater(pedimento)
    }
  }

  const ctaSubtitle =
    ctaMeta ?? `· ${pedimento} · 5 ETAPAS · 00:04:18`

  return (
    <section
      className="portal-card"
      style={{
        position: 'relative',
        padding: 0,
        marginBottom: 'var(--portal-s-8)',
        borderColor: flash ? 'var(--portal-green-2)' : 'var(--portal-line-2)',
        boxShadow: flash
          ? '0 0 0 1px var(--portal-green-2), 0 0 60px -10px var(--portal-green-glow), var(--portal-shadow-2)'
          : 'var(--portal-shadow-2)',
        transition: 'all 700ms var(--portal-ease-out)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px 14px',
          borderBottom: '1px solid var(--portal-line-1)',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              position: 'relative',
              width: 8,
              height: 8,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 999,
                background: 'var(--portal-green-2)',
                boxShadow: '0 0 10px var(--portal-green-glow)',
                animation: reducedMotion
                  ? undefined
                  : 'portalDotPulse 2.4s ease-in-out infinite',
              }}
            />
            <span
              style={{
                position: 'absolute',
                inset: -4,
                borderRadius: 999,
                border: '1px solid var(--portal-green-2)',
                opacity: 0.5,
                animation: reducedMotion
                  ? undefined
                  : 'portalPing 2.4s ease-out infinite',
              }}
            />
          </span>
          <span
            style={{
              fontFamily: 'var(--portal-font-display)',
              fontSize: 14, // WHY: handoff verbatim — design uses sub-token sizes
              fontWeight: 500,
              letterSpacing: '0.24em',
              color: 'var(--portal-fg-1)',
            }}
          >
            LA FRONTERA EN VIVO
          </span>
          <span
            style={{
              fontFamily: 'var(--portal-font-mono)',
              fontSize: 10, // WHY: handoff verbatim — design uses sub-token sizes
              letterSpacing: '0.18em',
              color: 'var(--portal-fg-5)',
              textTransform: 'uppercase',
            }}
          >
            · Laredo II · {clock}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Stat label="CRUCES HOY" value={crossings} live />
          <Stat label="EN PUENTE" value={String(trucksOnBridge)} />
          <Stat label="ESPERA" value={averageWait} />
          <Stat label="CBP" value="OK" accent />
        </div>
      </div>

      <div
        style={{ position: 'relative', background: 'var(--portal-ink-0)' }}
      >
        <svg
          viewBox="0 0 100 60"
          width="100%"
          height="auto"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', aspectRatio: '100/60' }}
          aria-hidden
        >
          <defs>
            <linearGradient id="rioGrande" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--portal-green-2)" stopOpacity={0.08} />
              <stop offset="0.5" stopColor="var(--portal-green-2)" stopOpacity={0.14} />
              <stop offset="1" stopColor="var(--portal-green-2)" stopOpacity={0.08} />
            </linearGradient>
            <linearGradient id="mxLand" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="var(--portal-ink-2)" stopOpacity={0} />
              <stop offset="1" stopColor="var(--portal-ink-2)" stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id="usLand" x1="1" x2="0" y1="0" y2="0">
              <stop offset="0" stopColor="var(--portal-ink-2)" stopOpacity={0} />
              <stop offset="1" stopColor="var(--portal-ink-2)" stopOpacity={0.6} />
            </linearGradient>
            <pattern id="liveBorderGridDots" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
              <circle cx={2} cy={2} r={0.15} fill="var(--portal-line-2)" />
            </pattern>
          </defs>

          <rect x={0} y={0} width={100} height={60} fill="url(#liveBorderGridDots)" />

          {/* Mexico land (right) */}
          <path
            d="M 56 0 L 100 0 L 100 60 L 56 60 Q 54 45, 55 30 Q 56 15, 56 0 Z"
            fill="url(#mxLand)"
          />
          {/* US land (left) */}
          <path
            d="M 0 0 L 44 0 Q 45 15, 46 30 Q 47 45, 45 60 L 0 60 Z"
            fill="url(#usLand)"
          />

          {/* Rio Grande */}
          <path
            d="M 56 0 Q 54 15, 55 30 Q 56 45, 54 60 L 46 60 Q 47 45, 46 30 Q 45 15, 44 0 Z"
            fill="url(#rioGrande)"
          />
          <path
            d="M 50 0 Q 48 15, 49.5 30 Q 50.5 45, 49 60"
            fill="none"
            stroke="var(--portal-green-3)"
            strokeWidth={0.25}
            opacity={0.5}
          />

          {/* Border line */}
          <line
            x1={50}
            y1={2}
            x2={50}
            y2={58}
            stroke="var(--portal-green-2)"
            strokeWidth={0.15}
            strokeDasharray="0.6 1.2"
            opacity={0.65}
          />

          {/* Bridge */}
          <rect
            x={26}
            y={48.5}
            width={48}
            height={3}
            rx={0.3}
            fill="var(--portal-ink-3)"
            stroke="var(--portal-line-1)"
            strokeWidth={0.1}
          />
          <line
            x1={26}
            y1={50}
            x2={74}
            y2={50}
            stroke="var(--portal-line-2)"
            strokeWidth={0.12}
            strokeDasharray="0.8 0.4"
          />
          {[32, 44, 56, 68].map((x) => (
            <rect
              key={x}
              x={x - 0.3}
              y={51.2}
              width={0.6}
              height={2}
              fill="var(--portal-line-2)"
              opacity={0.4}
            />
          ))}

          {/* Checkpoints */}
          <g transform="translate(76 47)">
            <rect
              x={-2}
              y={0}
              width={4}
              height={4}
              rx={0.3}
              fill="var(--portal-ink-3)"
              stroke="var(--portal-green-3)"
              strokeWidth={0.12}
            />
            <text
              x={0}
              y={-0.6}
              fontSize={1.6}
              fontFamily="var(--portal-font-mono)"
              fill="var(--portal-fg-4)"
              textAnchor="middle"
              letterSpacing={0.2}
            >
              SAT
            </text>
          </g>
          <g transform="translate(24 47)">
            <rect
              x={-2}
              y={0}
              width={4}
              height={4}
              rx={0.3}
              fill="var(--portal-ink-3)"
              stroke="var(--portal-green-3)"
              strokeWidth={0.12}
            />
            <text
              x={0}
              y={-0.6}
              fontSize={1.6}
              fontFamily="var(--portal-font-mono)"
              fill="var(--portal-fg-4)"
              textAnchor="middle"
              letterSpacing={0.2}
            >
              CBP
            </text>
          </g>

          {/* Labels */}
          <text
            x={86}
            y={15}
            fontSize={2.4}
            fontFamily="var(--portal-font-display)"
            fill="var(--portal-fg-3)"
            textAnchor="middle"
            letterSpacing={0.2}
          >
            NUEVO LAREDO
          </text>
          <text
            x={86}
            y={18}
            fontSize={1.4}
            fontFamily="var(--portal-font-mono)"
            fill="var(--portal-fg-5)"
            textAnchor="middle"
            letterSpacing={0.3}
          >
            TAMAULIPAS · MX
          </text>
          <text
            x={14}
            y={15}
            fontSize={2.4}
            fontFamily="var(--portal-font-display)"
            fill="var(--portal-fg-3)"
            textAnchor="middle"
            letterSpacing={0.2}
          >
            LAREDO
          </text>
          <text
            x={14}
            y={18}
            fontSize={1.4}
            fontFamily="var(--portal-font-mono)"
            fill="var(--portal-fg-5)"
            textAnchor="middle"
            letterSpacing={0.3}
          >
            TEXAS · US
          </text>

          <text
            x={50}
            y={6}
            fontSize={1.4}
            fontFamily="var(--portal-font-mono)"
            fill="var(--portal-fg-4)"
            textAnchor="middle"
            letterSpacing={0.4}
          >
            RÍO BRAVO / GRANDE
          </text>
          <text
            x={50}
            y={56.5}
            fontSize={1.3}
            fontFamily="var(--portal-font-mono)"
            fill="var(--portal-green-3)"
            textAnchor="middle"
            letterSpacing={0.4}
          >
            PUENTE INTERNACIONAL · LAREDO II
          </text>

          {/* Warehouse */}
          <g transform="translate(6 34)">
            <rect
              x={-3}
              y={-1.5}
              width={6}
              height={3}
              rx={0.2}
              fill="var(--portal-ink-3)"
              stroke="var(--portal-green-3)"
              strokeWidth={0.15}
              strokeOpacity={0.6}
            />
            <text
              x={0}
              y={0.6}
              fontSize={1.1}
              fontFamily="var(--portal-font-mono)"
              fill="var(--portal-fg-3)"
              textAnchor="middle"
              letterSpacing={0.2}
            >
              ALMACÉN
            </text>
          </g>

          {/* Trucks — flipped so MX(right)→US(left) */}
          <g transform="translate(100 0) scale(-1 1)">
            <BridgeTruck
              delay={0}
              speed={15}
              label={activeTruckLabel}
              active
              reducedMotion={reducedMotion}
              onCross={handleCrossing}
            />
            <BridgeTruck
              delay={5}
              speed={15}
              label="TX-4831"
              reducedMotion={reducedMotion}
              onCross={() => {
                /* secondary trucks fire no event */
              }}
            />
            <BridgeTruck
              delay={10}
              speed={15}
              label="TX-4832"
              reducedMotion={reducedMotion}
              onCross={() => {
                /* secondary trucks fire no event */
              }}
            />
          </g>

          {flash && !reducedMotion && (
            <rect
              x={0}
              y={0}
              width={100}
              height={60}
              fill="var(--portal-green-2)"
              opacity={0.04}
            >
              <animate
                attributeName="opacity"
                values="0.12;0;0"
                dur="1.2s"
                fill="freeze"
              />
            </rect>
          )}
        </svg>

        {lastEvent && flash && (
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--portal-ink-3)',
              border: '1px solid var(--portal-green-2)',
              borderRadius: 'var(--portal-r-pill)',
              padding: '8px 18px',
              fontFamily: 'var(--portal-font-mono)',
              fontSize: 11, // WHY: handoff verbatim — design uses sub-token sizes
              letterSpacing: '0.18em',
              color: 'var(--portal-green-2)',
              textTransform: 'uppercase',
              boxShadow:
                '0 0 20px var(--portal-green-glow), 0 8px 24px rgba(0,0,0,0.5)',
              animation: reducedMotion
                ? undefined
                : 'crossToastIn 400ms var(--portal-ease-out) both',
              whiteSpace: 'nowrap',
            }}
          >
            ✓ {lastEvent.label} · cruzó Laredo II · {lastEvent.ts}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          borderTop: '1px solid var(--portal-line-1)',
        }}
      >
        <TelemetryCell
          label="ACTIVO"
          value={activeTruckLabel}
          sub={activeCargo}
          accent
        />
        <TelemetryCell
          label="PEDIMENTO"
          value={pedimento}
          sub="A1 · firmado · Renato Z."
        />
        <TelemetryCell
          label="TEMPERATURA"
          value={temperature}
          sub={weather}
        />
        <TelemetryCell
          label="TIEMPO DE CRUCE"
          value={averageCrossingTime}
          sub={averageCrossingComparison}
        />
      </div>

      <button
        type="button"
        onClick={handleOpenTheater}
        style={{
          width: '100%',
          padding: '12px 24px',
          background: 'var(--portal-ink-0)',
          borderTop: '1px solid var(--portal-line-1)',
          borderLeft: 0,
          borderRight: 0,
          borderBottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'var(--portal-font-mono)',
          fontSize: 10, // WHY: handoff verbatim — design uses sub-token sizes
          letterSpacing: '0.22em',
          color: 'var(--portal-fg-3)',
          textTransform: 'uppercase',
          transition: 'background 300ms',
          minHeight: 60,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--portal-ink-1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--portal-ink-0)'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--portal-green-2)' }}>▸</span>
          VER FLUJO COMPLETO DEL PEDIMENTO
          <span style={{ color: 'var(--portal-fg-5)' }}>{ctaSubtitle}</span>
        </span>
        <span style={{ color: 'var(--portal-fg-4)' }}>REPRODUCIR →</span>
      </button>
    </section>
  )
}
