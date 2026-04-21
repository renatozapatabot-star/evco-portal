'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { GlassCard } from '@/components/aguila'

export interface PortalGreetingProps {
  /** Identity name (first name or company). Rendered in silver, never green —
   *  green (--portal-green-*) is reserved for cruzado/healthy status. */
  name: string
  /** One-line summary below the greeting. Mix numbers (portal-num) + prose. */
  summary?: ReactNode
  /** Override the calculated saludo. Useful for SSR. */
  saludo?: string
  /** Override the formatted date. Useful for SSR. */
  fecha?: string
}

function computeSaludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function computeFecha(): string {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Chicago',
  })
}

/**
 * V1 hero greeting — weight 600 Geist display, name highlighted in
 * --portal-fg-1 (silver-bright), date meta on the right, one-line
 * summary below. Wrapped in <GlassCard tier="hero"> per V1 design
 * system. Green is reserved for status (cruzado/healthy); identity
 * highlight uses luminance (fg-1 vs fg-2) not hue.
 */
export function PortalGreeting({
  name,
  summary,
  saludo: saludoProp,
  fecha: fechaProp,
}: PortalGreetingProps) {
  // Hydrate date client-side so SSR output doesn't drift from the
  // user's actual timezone after mount.
  const [saludo, setSaludo] = useState(saludoProp ?? 'Hola')
  const [fecha, setFecha] = useState(fechaProp ?? '')

  useEffect(() => {
    setSaludo(saludoProp ?? computeSaludo())
    setFecha(fechaProp ?? computeFecha())
  }, [saludoProp, fechaProp])

  return (
    <section style={{ paddingTop: 'var(--portal-s-8)', paddingBottom: 'var(--portal-s-6)' }}>
      <GlassCard tier="hero" padding="clamp(24px, 4vw, 40px)">
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--portal-font-display)',
              fontWeight: 600,
              fontSize: 'clamp(40px, 6vw, 56px)',
              letterSpacing: 'var(--aguila-ls-tight)',
              lineHeight: 1.05,
              color: 'var(--portal-fg-2)',
            }}
          >
            {saludo}, <span style={{ color: 'var(--portal-fg-1)' }}>{name}</span>.
          </h1>
          {fecha && (
            <span
              className="portal-meta"
              style={{ color: 'var(--portal-fg-4)', textTransform: 'capitalize' }}
            >
              {fecha}
            </span>
          )}
        </div>
        {summary && (
          <p
            style={{
              margin: '12px 0 0',
              fontFamily: 'var(--portal-font-sans)',
              fontSize: 'var(--portal-fs-sm)',
              lineHeight: 1.5,
              color: 'var(--portal-fg-4)',
              maxWidth: 620,
            }}
          >
            {summary}
          </p>
        )}
      </GlassCard>
    </section>
  )
}
