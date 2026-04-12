'use client'

import { fmtUSDFull, fmtDateTime } from '@/lib/format-utils'
import { ACCENT_CYAN, GOLD, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'
import type { InicioData } from './types'

const cardStyle: React.CSSProperties = {
  padding: 24,
  borderRadius: 20,
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow:
    '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(0,229,255,0.12)',
}

export function PortfolioPulse({ pulse }: { pulse: InicioData['pulse'] }) {
  const maxEvents = Math.max(1, ...pulse.sparkline.map(p => p.events + p.decisions))
  const width = 600
  const height = 80
  const step = width / Math.max(1, pulse.sparkline.length - 1)

  const points = pulse.sparkline.map((p, i) => {
    const v = p.events + p.decisions
    const x = i * step
    const y = height - (v / maxEvents) * (height - 8) - 4
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `0,${height} ${points} ${width},${height}`

  return (
    <section id="portfolio-pulse" style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div>
          <h2
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: TEXT_MUTED,
              margin: 0,
            }}
          >
            Actividad de hoy
          </h2>
          <p style={{ fontSize: 20, color: TEXT_PRIMARY, fontWeight: 700, margin: '4px 0 0 0' }}>
            Pulso de la correduría
          </p>
        </div>
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>
          Últimos 7 días
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Stat label="Eventos (24h)" value={String(pulse.last24h_events)} color={ACCENT_CYAN} />
        <Stat label="Decisiones (24h)" value={String(pulse.last24h_decisions)} color={ACCENT_CYAN} />
        <Stat label="Costo IA (24h)" value={fmtUSDFull(pulse.last24h_cost_usd)} color={GOLD} />
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 80, display: 'block' }}
        aria-label="Sparkline 7 días"
      >
        <defs>
          <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT_CYAN} stopOpacity="0.35" />
            <stop offset="100%" stopColor={ACCENT_CYAN} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#pulseFill)" />
        <polyline points={points} fill="none" stroke={ACCENT_CYAN} strokeWidth="2" strokeLinejoin="round" />
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: TEXT_MUTED }}>
        {pulse.sparkline.map(p => (
          <span key={p.day} style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
            {p.day.slice(8, 10)}
          </span>
        ))}
      </div>

      <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 12, marginBottom: 0 }}>
        Actualizado: {fmtDateTime(new Date())}
      </p>
    </section>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: TEXT_MUTED,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
          fontSize: 28,
          fontWeight: 800,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  )
}
