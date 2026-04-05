'use client'

import { useEffect, useState } from 'react'

/**
 * Live activity pulse — subtle breathing dot that shows the system is alive.
 * Changes color based on system health: green = healthy, amber = attention, red = issue.
 */
export function ActivityPulse({ status = 'healthy' }: { status?: 'healthy' | 'attention' | 'issue' }) {
  const [beat, setBeat] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setBeat(true)
      setTimeout(() => setBeat(false), 1000)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const colors = {
    healthy: '#16A34A',
    attention: '#D4952A',
    issue: '#DC2626',
  }

  const color = colors[status]

  return (
    <span
      title={status === 'healthy' ? 'Sistema activo' : status === 'attention' ? 'Atención requerida' : 'Problema detectado'}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: beat ? `0 0 0 4px ${color}30, 0 0 8px ${color}20` : `0 0 0 0 ${color}00`,
        transition: 'box-shadow 600ms cubic-bezier(0.4, 0, 0.2, 1)',
        verticalAlign: 'middle',
      }}
      aria-label={`Sistema: ${status}`}
    />
  )
}
