'use client'

import { useEffect, useState, useMemo } from 'react'
import { Calendar, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { getCompanyIdCookie } from '@/lib/client-config'
import { fmtDate } from '@/lib/format-utils'
import Link from 'next/link'

interface Deadline {
  id: string
  type: 'mve' | 'immex' | 'pedimento' | 'reporte' | 'general'
  title: string
  date: string
  severity: 'critical' | 'warning' | 'info'
  href?: string
  resolved?: boolean
}

const TYPE_LABELS: Record<string, string> = {
  mve: 'MVE',
  immex: 'IMMEX',
  pedimento: 'Pedimento',
  reporte: 'Reporte',
  general: 'General',
}

const SEVERITY_STYLES = {
  critical: { color: 'var(--danger-500)', bg: 'rgba(220,38,38,0.06)', border: 'var(--danger-500)' },
  warning: { color: 'var(--gold-dark)', bg: 'var(--gold-bg)', border: 'var(--gold)' },
  info: { color: 'var(--info)', bg: 'rgba(37,99,235,0.06)', border: 'var(--info)' },
}

/**
 * Compliance calendar widget — shows upcoming deadlines for the client.
 * MVE, IMMEX, annual reports, pending pedimentos.
 */
export function ComplianceCalendar() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    if (!companyId) { setLoading(false); return }

    fetch(`/api/data?table=traficos&company_id=${companyId}&limit=5000&gte_field=fecha_llegada&gte_value=2024-01-01`)
      .then(r => r.json())
      .then(data => {
        const traficos = data.data ?? []
        const items: Deadline[] = []
        const now = new Date()
        const today = now.toISOString().split('T')[0]

        // Check for traficos without pedimento > 5 days old
        const pendingPed = traficos.filter((t: { estatus: string | null; pedimento: string | null; fecha_llegada: string | null }) => {
          const s = (t.estatus || '').toLowerCase()
          if (s.includes('cruz') || s.includes('entreg')) return false
          if (t.pedimento) return false
          if (!t.fecha_llegada) return false
          const days = Math.floor((Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000)
          return days > 5
        })

        if (pendingPed.length > 0) {
          items.push({
            id: 'pending-ped',
            type: 'pedimento',
            title: `${pendingPed.length} tráfico${pendingPed.length !== 1 ? 's' : ''} sin pedimento (> 5 días)`,
            date: today,
            severity: pendingPed.length > 3 ? 'critical' : 'warning',
            href: '/traficos?estatus=En Proceso',
          })
        }

        // MVE annual deadline (March 31 each year)
        const mveDate = `${now.getFullYear()}-03-31`
        const mveNext = mveDate >= today ? mveDate : `${now.getFullYear() + 1}-03-31`
        const mveDaysLeft = Math.ceil((new Date(mveNext).getTime() - Date.now()) / 86400000)
        items.push({
          id: 'mve-annual',
          type: 'mve',
          title: `MVE Anual — ${mveDaysLeft} días restantes`,
          date: mveNext,
          severity: mveDaysLeft <= 30 ? 'critical' : mveDaysLeft <= 90 ? 'warning' : 'info',
        })

        // IMMEX report (quarterly)
        const quarter = Math.ceil((now.getMonth() + 1) / 3)
        const immexDate = `${now.getFullYear()}-${String(quarter * 3).padStart(2, '0')}-30`
        const immexNext = immexDate >= today ? immexDate : `${now.getFullYear()}-${String((quarter + 1) * 3).padStart(2, '0')}-30`
        const immexDays = Math.ceil((new Date(immexNext).getTime() - Date.now()) / 86400000)

        // Check if client has IMMEX operations
        const hasImmex = traficos.some((t: { regimen: string | null }) => {
          const r = (t.regimen || '').toUpperCase()
          return r === 'ITE' || r === 'ITR' || r === 'IMD'
        })
        if (hasImmex) {
          items.push({
            id: 'immex-quarterly',
            type: 'immex',
            title: `Reporte IMMEX trimestral — ${immexDays} días`,
            date: immexNext,
            severity: immexDays <= 15 ? 'critical' : immexDays <= 45 ? 'warning' : 'info',
          })
        }

        // Sort by severity then date
        const severityOrder = { critical: 0, warning: 1, info: 2 }
        items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.date.localeCompare(b.date))

        setDeadlines(items)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const upcoming = deadlines.filter(d => !d.resolved)

  if (loading || upcoming.length === 0) return null

  return (
    <div className="card card-enter" style={{ padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Calendar size={16} style={{ color: 'var(--gold)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          Calendario de Cumplimiento
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {upcoming.map(d => {
          const style = SEVERITY_STYLES[d.severity]
          const Icon = d.severity === 'critical' ? AlertTriangle : d.severity === 'warning' ? Clock : CheckCircle

          const content = (
            <div
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                background: style.bg,
                borderLeft: `3px solid ${style.border}`,
                cursor: d.href ? 'pointer' : undefined,
                transition: 'background 150ms',
              }}
              className={d.href ? 'card-clickable' : undefined}
            >
              <Icon size={16} style={{ color: style.color, flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {d.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {TYPE_LABELS[d.type]} · {fmtDate(d.date)}
                </div>
              </div>
            </div>
          )

          return d.href ? (
            <Link key={d.id} href={d.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              {content}
            </Link>
          ) : <div key={d.id}>{content}</div>
        })}
      </div>
    </div>
  )
}
