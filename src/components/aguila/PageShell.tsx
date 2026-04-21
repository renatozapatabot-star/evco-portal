'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  COCKPIT_CANVAS, GREEN, AMBER, RED,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from '@/lib/design-system'
import { AguilaFooter } from './AguilaFooter'

type SystemStatus = 'healthy' | 'warning' | 'critical'

function statusColor(s: SystemStatus): string {
  if (s === 'critical') return RED
  if (s === 'warning') return AMBER
  return GREEN
}

function LiveTimestamp() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    // Tick every 30s — fast enough that the clock never drifts visibly
    // on a parked tab, slow enough to stay imperceptible as CPU.
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (!now) return null
  const dateStr = now.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Chicago',
  })
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Chicago',
  })
  return (
    <span style={{
      fontFamily: 'var(--font-jetbrains-mono), monospace',
      fontSize: 'var(--aguila-fs-meta, 11px)',
      color: TEXT_MUTED,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <span>{dateStr} · {timeStr}</span>
      {/* "Datos en vivo" pill — glass chip with a pulsing green dot.
          The dot breath is the signal Ursula wants: the dashboard
          feels alive, not static. Same .aguila-dot-pulse utility the
          timeline's "Etapa actual" node uses, so motion reads as a
          consistent brand signature. */}
      <span
        aria-label="Datos en vivo"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 9px',
          borderRadius: 999,
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.22)',
          color: 'rgba(134,239,172,0.9)',
          fontSize: 'var(--aguila-fs-meta, 11px)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        <span
          aria-hidden
          className="aguila-dot-pulse"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#22C55E',
            boxShadow: '0 0 10px rgba(34,197,94,0.45)',
          }}
        />
        Datos en vivo
      </span>
    </span>
  )
}

export interface PageShellProps {
  title: string
  subtitle?: string
  systemStatus?: SystemStatus
  /** When explicitly false, the status dot stays solid (no pulse). Defaults to pulse. */
  pulseSignal?: boolean
  liveTimestamp?: boolean
  badges?: ReactNode
  children: ReactNode
  /** Optional brand trio slot (logo + operator name etc) rendered above greeting. */
  brandHeader?: ReactNode
  /** Maximum content width. */
  maxWidth?: number
}

/**
 * Unified page shell — dark cockpit canvas, consistent greeting rhythm,
 * optional live timestamp + status dot. Every authenticated cockpit
 * composes from this per CRUZ v6.
 */
export function PageShell({
  title, subtitle, systemStatus, pulseSignal, liveTimestamp, badges, children, brandHeader,
  maxWidth = 1400,
}: PageShellProps) {
  const dotColor = systemStatus ? statusColor(systemStatus) : null
  const shouldPulse = pulseSignal ?? true
  return (
    <div
      className="aguila-dark aguila-canvas"
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: COCKPIT_CANVAS,
        color: TEXT_PRIMARY,
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
      }}
    >
      {/* V1 atmospheric layer — drifting aura mirrors login's 12s breath.
          Topo hairline + central halo come from .aguila-canvas pseudo-elements
          defined in globals.css so every authenticated surface inherits the
          same depth without per-page wiring. */}
      <div className="aguila-aura" aria-hidden="true" />
      {/* Cockpit atmospheric glow — instrument-grade silver, not gold.
          Gold is reserved for ceremony surfaces (login hero, approval
          celebration, onboarding welcome). Cockpits stay chrome so the
          card hairlines + KPI sparklines + this halo read as one material. */}
      <div className="p-4 md:px-7 md:py-6" style={{ position: 'relative', zIndex: 1, maxWidth, margin: '0 auto' }}>
        {brandHeader}
        <header style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 'var(--aguila-gap-section, 32px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {dotColor ? (
              <span
                aria-hidden
                className={shouldPulse ? 'aguila-dot-pulse' : undefined}
                style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: dotColor, boxShadow: `0 0 10px ${dotColor}`, flexShrink: 0,
                }}
              />
            ) : null}
            <div style={{ minWidth: 0 }}>
              <h1 style={{
                fontSize: 'var(--aguila-fs-title, 24px)',
                fontWeight: 800,
                color: TEXT_PRIMARY,
                margin: 0,
                letterSpacing: 'var(--aguila-ls-tight, -0.03em)',
              }}>
                {title}
              </h1>
              {subtitle ? (
                <p style={{
                  fontSize: 'var(--aguila-fs-body, 13px)',
                  color: TEXT_SECONDARY,
                  marginTop: 2, marginBottom: 0, fontWeight: 500,
                }}>
                  {subtitle}
                </p>
              ) : null}
              {liveTimestamp ? <div style={{ marginTop: 4 }}><LiveTimestamp /></div> : null}
            </div>
          </div>
          {badges ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {badges}
            </div>
          ) : null}
        </header>
        {children}
        <AguilaFooter />
      </div>
    </div>
  )
}
