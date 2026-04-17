'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export interface PortalGreetingProps {
  /** First name rendered in emerald. */
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
 * Warm greeting section above the modules grid. Display serif, hairline
 * weight, first-name in emerald, date on the right in mono meta, one-line
 * summary below mixing numbers (tabular) with fg-3 copy.
 *
 * Port of .planning/design-handoff/cruz-portal/project/src/screen-dashboard.jsx:83-116.
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
            fontWeight: 300,
            fontSize: 'clamp(32px, 4.2vw, 52px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            color: 'var(--portal-fg-1)',
          }}
        >
          {saludo}, <span style={{ color: 'var(--portal-green-2)' }}>{name}</span>.
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
            margin: '10px 0 0',
            fontSize: 'var(--portal-fs-md)',
            color: 'var(--portal-fg-3)',
            maxWidth: 620,
          }}
        >
          {summary}
        </p>
      )}
    </section>
  )
}
