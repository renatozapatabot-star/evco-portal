'use client'

import { useEffect, useState } from 'react'

export interface CrucesMapBridge {
  id: string
  name: string
  x: number
  y: number
  wait: number
  st: 'ok' | 'warn' | 'alert'
  count: number
}

export interface CrucesMapShipment {
  from: [number, number]
  to: [number, number]
  bridge: string
}

export interface PortalCrucesMapProps {
  bridges?: CrucesMapBridge[]
  shipments?: CrucesMapShipment[]
  /** Selected time window button. */
  selectedPeriod?: 'Hoy' | '7d' | '30d'
  onPeriodChange?: (p: 'Hoy' | '7d' | '30d') => void
}

const DEFAULT_BRIDGES: CrucesMapBridge[] = [
  { id: 'nl2', name: 'Nuevo Laredo II',     x: 540, y: 320, wait: 8,  st: 'ok',   count: 4 },
  { id: 'col', name: 'Colombia',            x: 495, y: 295, wait: 12, st: 'ok',   count: 2 },
  { id: 'wtb', name: 'World Trade',         x: 555, y: 328, wait: 34, st: 'warn', count: 1 },
  { id: 'phr', name: 'Pharr–Reynosa',       x: 660, y: 370, wait: 22, st: 'ok',   count: 3 },
  { id: 'juz', name: 'Cd. Juárez–Zaragoza', x: 310, y: 205, wait: 18, st: 'ok',   count: 2 },
  { id: 'ots', name: 'Otay Mesa',           x: 90,  y: 220, wait: 26, st: 'ok',   count: 1 },
]

const DEFAULT_SHIPMENTS: CrucesMapShipment[] = [
  { from: [560, 150], to: [540, 320], bridge: 'nl2' },
  { from: [720, 300], to: [660, 370], bridge: 'phr' },
  { from: [140, 120], to: [90, 220],  bridge: 'ots' },
]

/**
 * Stylized US↔MX border map with 6 bridges + 3 animated shipment paths.
 * 16:7 aspect SVG viewBox 800×420. Bridge markers pulse with a 2.4s
 * SVG animation. Shipment dots trail along dashed paths every ~4s.
 *
 * Port of .planning/design-handoff/cruz-portal/project/src/screen-dashboard-extras.jsx:8-178.
 */
export function PortalCrucesMap({
  bridges = DEFAULT_BRIDGES,
  shipments = DEFAULT_SHIPMENTS,
  selectedPeriod = 'Hoy',
  onPeriodChange,
}: PortalCrucesMapProps) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    let raf = 0
    const tick = (t: number) => {
      setPhase((t / 4000) % 1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const periods: Array<'Hoy' | '7d' | '30d'> = ['Hoy', '7d', '30d']
  const clockLabel = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  })

  return (
    <div className="portal-card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--portal-line-1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="portal-eyebrow">MAPA DE CRUCES · EN VIVO</span>
          <span className="portal-pulse" aria-hidden />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {periods.map((p) => {
            const active = p === selectedPeriod
            return (
              <button
                key={p}
                onClick={() => onPeriodChange?.(p)}
                style={{
                  padding: '4px 10px',
                  fontSize: 'var(--portal-fs-xs)',
                  borderRadius: 'var(--portal-r-1)',
                  background: active ? 'var(--portal-ink-3)' : 'transparent',
                  color: active ? 'var(--portal-fg-1)' : 'var(--portal-fg-4)',
                  border: active ? '1px solid var(--portal-line-2)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            )
          })}
        </div>
      </div>

      {/* Map SVG */}
      <div style={{ position: 'relative', background: 'var(--portal-ink-0)', aspectRatio: '16/7' }}>
        <svg viewBox="0 0 800 420" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden>
          <defs>
            <linearGradient id="portal-map-grid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--portal-ink-0)" />
              <stop offset="1" stopColor="var(--portal-ink-1)" />
            </linearGradient>
            <radialGradient id="portal-map-glow-us" cx="0.5" cy="0.3" r="0.7">
              <stop offset="0" stopColor="rgba(255,255,255,0.04)" />
              <stop offset="1" stopColor="transparent" />
            </radialGradient>
          </defs>
          <rect width="800" height="420" fill="url(#portal-map-grid)" />

          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`h-${i}`} x1="0" x2="800" y1={i * 60} y2={i * 60} stroke="rgba(255,255,255,0.04)" />
          ))}
          {Array.from({ length: 14 }).map((_, i) => (
            <line key={`v-${i}`} y1="0" y2="420" x1={i * 60} x2={i * 60} stroke="rgba(255,255,255,0.04)" />
          ))}

          <path
            d="M 20 80 L 100 70 L 180 60 L 260 55 L 360 60 L 460 70 L 560 80 L 640 95 L 720 115 L 780 140 L 780 250 L 720 270 L 660 280 L 600 285 L 560 300 L 540 320 L 520 315 L 495 295 L 460 290 L 410 285 L 360 280 L 310 270 L 280 260 L 240 240 L 200 225 L 160 215 L 120 210 L 90 220 L 60 215 L 30 200 L 20 160 Z"
            fill="rgba(255,255,255,0.025)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
          />
          <path
            d="M 90 220 L 120 210 L 160 215 L 200 225 L 240 240 L 280 260 L 310 270 L 360 280 L 410 285 L 460 290 L 495 295 L 540 320 L 560 328 L 580 335 L 620 350 L 660 370 L 680 390 L 660 410 L 600 410 L 520 395 L 440 380 L 360 365 L 300 350 L 240 335 L 200 325 L 160 310 L 130 290 L 100 265 Z"
            fill="rgba(80,200,150,0.04)"
            stroke="rgba(80,200,150,0.22)"
            strokeWidth="1"
          />
          <rect width="800" height="420" fill="url(#portal-map-glow-us)" />
          <path
            d="M 90 220 L 160 215 L 240 240 L 310 270 L 410 285 L 495 295 L 540 320 L 560 328 L 620 350 L 660 370"
            fill="none"
            stroke="var(--portal-green-3)"
            strokeWidth="1"
            strokeDasharray="2 4"
            opacity="0.5"
          />
          <text x="360" y="110" fill="rgba(255,255,255,0.25)" fontFamily="var(--portal-font-mono)" fontSize="9" letterSpacing="3">
            ESTADOS UNIDOS
          </text>
          <text x="360" y="385" fill="rgba(80,200,150,0.5)" fontFamily="var(--portal-font-mono)" fontSize="9" letterSpacing="3">
            MÉXICO
          </text>

          {shipments.map((s, i) => {
            const t = (phase + i * 0.33) % 1
            const px = s.from[0] + (s.to[0] - s.from[0]) * t
            const py = s.from[1] + (s.to[1] - s.from[1]) * t
            return (
              <g key={`${s.bridge}-${i}`}>
                <line
                  x1={s.from[0]}
                  y1={s.from[1]}
                  x2={s.to[0]}
                  y2={s.to[1]}
                  stroke="var(--portal-green-2)"
                  strokeWidth="0.8"
                  opacity="0.35"
                  strokeDasharray="3 4"
                />
                <circle cx={px} cy={py} r="3" fill="var(--portal-green-2)" />
                <circle cx={px} cy={py} r="7" fill="var(--portal-green-2)" opacity="0.2" />
              </g>
            )
          })}

          {bridges.map((b) => {
            const color = b.st === 'warn' ? 'var(--portal-amber)' : 'var(--portal-green-2)'
            return (
              <g key={b.id}>
                <circle cx={b.x} cy={b.y} r="14" fill={color} opacity="0.08">
                  <animate attributeName="r" values="10;16;10" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.2;0;0.2" dur="2.4s" repeatCount="indefinite" />
                </circle>
                <circle cx={b.x} cy={b.y} r="5" fill={color} />
                <circle cx={b.x} cy={b.y} r="5" fill="none" stroke={color} strokeWidth="1" opacity="0.8" />
                <text x={b.x + 10} y={b.y - 8} fill="var(--portal-fg-1)" fontFamily="var(--portal-font-sans)" fontSize="10.5" fontWeight="500">
                  {b.name}
                </text>
                <text x={b.x + 10} y={b.y + 6} fill="var(--portal-fg-4)" fontFamily="var(--portal-font-mono)" fontSize="8.5" letterSpacing="1">
                  {b.wait}m · {b.count} {b.count === 1 ? 'cruce' : 'cruces'}
                </text>
              </g>
            )
          })}

          <g transform="translate(28, 28)" fontFamily="var(--portal-font-mono)" fontSize="8" fill="rgba(255,255,255,0.35)" letterSpacing="1.5">
            <text>27.5060°N</text>
            <text y="10">99.5075°W</text>
            <text y="24">ZONA · TX / NL</text>
          </g>
          <g transform="translate(760, 404)" fontFamily="var(--portal-font-mono)" fontSize="8" fill="rgba(255,255,255,0.3)" textAnchor="end" letterSpacing="1.5">
            <text>DATOS CBP · SAT · PORTAL · {clockLabel}</text>
          </g>
        </svg>

        {/* Legend */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 16,
            display: 'flex',
            gap: 18,
            fontFamily: 'var(--portal-font-mono)',
            fontSize: 'var(--portal-fs-micro)',
            letterSpacing: '0.15em',
            color: 'var(--portal-fg-4)',
          }}
        >
          <span>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--portal-green-2)', marginRight: 6, verticalAlign: 'middle' }} />
            FLUIDO
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--portal-amber)', marginRight: 6, verticalAlign: 'middle' }} />
            MODERADO
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--portal-red)', marginRight: 6, verticalAlign: 'middle' }} />
            CONGESTIONADO
          </span>
        </div>
      </div>

      {/* Bridge strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderTop: '1px solid var(--portal-line-1)' }}>
        {bridges.map((b, i) => (
          <div
            key={b.id}
            style={{
              padding: '12px 14px',
              borderLeft: i === 0 ? 'none' : '1px solid var(--portal-line-1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 'var(--portal-fs-xs)', color: 'var(--portal-fg-2)' }}>{b.name}</span>
              <span
                className="portal-num"
                style={{
                  fontFamily: 'var(--portal-font-mono)',
                  fontSize: 'var(--portal-fs-sm)',
                  fontWeight: 500,
                  color: b.st === 'warn' ? 'var(--portal-amber)' : 'var(--portal-green-2)',
                }}
              >
                {b.wait}
                <span style={{ color: 'var(--portal-fg-5)', fontSize: 'var(--portal-fs-micro)' }}>m</span>
              </span>
            </div>
            <div className="portal-meta" style={{ marginTop: 4 }}>
              {b.count} cruce{b.count !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
