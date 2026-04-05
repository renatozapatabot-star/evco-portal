'use client'

import { useEffect, useState } from 'react'
import { Clock, X } from 'lucide-react'
import { getCompanyIdCookie } from '@/lib/client-config'
import { fmtDate } from '@/lib/format-utils'
import Link from 'next/link'

interface SmartAlert {
  trafico: string
  days: number
  avgDays: number
}

/**
 * Smart alerts — surfaces traficos that are taking longer than average.
 * Shows on the dashboard as a subtle banner.
 */
export function SmartAlerts() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    if (!companyId) return

    fetch(`/api/data?table=traficos&company_id=${companyId}&limit=5000&gte_field=fecha_llegada&gte_value=2024-01-01`)
      .then(r => r.json())
      .then(data => {
        const traficos = data.data ?? []

        // Calculate average crossing time for completed traficos
        const completed = traficos.filter((t: { estatus: string | null; fecha_llegada: string | null; fecha_cruce: string | null }) => {
          const s = (t.estatus || '').toLowerCase()
          return s.includes('cruz') && t.fecha_llegada && t.fecha_cruce
        })

        if (completed.length < 5) return // Not enough data

        const avgDays = Math.round(
          completed.reduce((sum: number, t: { fecha_llegada: string; fecha_cruce: string }) => {
            return sum + (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
          }, 0) / completed.length
        )

        // Find active traficos taking longer than 1.5x average
        const active = traficos.filter((t: { estatus: string | null; fecha_llegada: string | null }) => {
          const s = (t.estatus || '').toLowerCase()
          if (s.includes('cruz') || s.includes('entreg') || s.includes('complet')) return false
          if (!t.fecha_llegada) return false
          const days = Math.floor((Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000)
          return days > avgDays * 1.5
        })

        const smartAlerts: SmartAlert[] = active
          .map((t: { trafico: string; fecha_llegada: string }) => ({
            trafico: t.trafico,
            days: Math.floor((Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000),
            avgDays,
          }))
          .sort((a: SmartAlert, b: SmartAlert) => b.days - a.days)
          .slice(0, 3)

        setAlerts(smartAlerts)
      })
      .catch(() => {})
  }, [])

  const visible = alerts.filter(a => !dismissed.has(a.trafico))
  if (visible.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {visible.map(alert => (
        <Link
          key={alert.trafico}
          href={`/traficos/${encodeURIComponent(alert.trafico)}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderRadius: 12,
            background: 'rgba(196, 150, 60, 0.06)',
            border: '1px solid rgba(196, 150, 60, 0.15)',
            fontSize: 13, color: 'var(--text-primary)',
            transition: 'background 150ms',
            cursor: 'pointer',
          }}
          className="card-clickable"
          >
            <Clock size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{alert.trafico}</span>
              {' lleva '}
              <span style={{ fontWeight: 600, color: 'var(--gold-dark)' }}>{alert.days} días</span>
              {' — promedio similar: '}{alert.avgDays} días
            </span>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDismissed(prev => new Set([...prev, alert.trafico])) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}
              aria-label="Descartar"
            >
              <X size={14} />
            </button>
          </div>
        </Link>
      ))}
    </div>
  )
}
