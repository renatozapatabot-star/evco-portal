'use client'

import { useEffect, useState } from 'react'
import { Flame, Award, TrendingUp } from 'lucide-react'
import { getCompanyIdCookie } from '@/lib/client-config'

interface StreakData {
  daysNoIncident: number
  operationsThisMonth: number
  tmecRate: number
}

/**
 * Streak badge — shows achievements and streaks on the dashboard.
 * "5 días sin incidencias" / "23 operaciones este mes" / "T-MEC Champion"
 */
export function StreakBadge() {
  const [data, setData] = useState<StreakData | null>(null)

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    if (!companyId) return

    fetch(`/api/data?table=traficos&company_id=${companyId}&limit=5000&gte_field=fecha_llegada&gte_value=2024-01-01`)
      .then(r => r.json())
      .then(res => {
        const traficos = res.data ?? []
        const now = new Date()
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

        // Operations this month
        const opsThisMonth = traficos.filter((t: { fecha_llegada: string | null }) =>
          t.fecha_llegada && t.fecha_llegada.startsWith(thisMonth)
        ).length

        // T-MEC rate
        const tmecOps = traficos.filter((t: { regimen: string | null }) => {
          const r = (t.regimen || '').toUpperCase()
          return r === 'ITE' || r === 'ITR' || r === 'IMD'
        }).length
        const tmecRate = traficos.length > 0 ? Math.round((tmecOps / traficos.length) * 100) : 0

        // Days without incident (simplified — count consecutive days without "Detenido")
        const sorted = traficos
          .filter((t: { estatus: string | null; fecha_llegada: string | null }) => t.fecha_llegada)
          .sort((a: { fecha_llegada: string }, b: { fecha_llegada: string }) => b.fecha_llegada.localeCompare(a.fecha_llegada))
        let daysNoIncident = 0
        for (const t of sorted) {
          if ((t as { estatus: string | null }).estatus?.toLowerCase().includes('deten')) break
          daysNoIncident++
        }
        // Cap at 365
        daysNoIncident = Math.min(daysNoIncident, 365)

        setData({ daysNoIncident, operationsThisMonth: opsThisMonth, tmecRate })
      })
      .catch((err) => console.error('[streak-badge] fetch failed:', err.message))
  }, [])

  if (!data) return null

  const badges = []

  if (data.daysNoIncident >= 7) {
    badges.push({
      icon: <Flame size={14} style={{ color: '#F59E0B' }} />,
      text: `${data.daysNoIncident} operaciones sin incidencia`,
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.08)',
    })
  }

  if (data.operationsThisMonth > 0) {
    badges.push({
      icon: <TrendingUp size={14} style={{ color: 'var(--success)' }} />,
      text: `${data.operationsThisMonth} operación${data.operationsThisMonth !== 1 ? 'es' : ''} este mes`,
      color: 'var(--success)',
      bg: 'rgba(22, 163, 74, 0.08)',
    })
  }

  if (data.tmecRate >= 50) {
    badges.push({
      icon: <Award size={14} style={{ color: 'var(--gold)' }} />,
      text: `T-MEC: ${data.tmecRate}%`,
      color: 'var(--gold)',
      bg: 'var(--gold-bg)',
    })
  }

  if (badges.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {badges.map((b, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 9999,
          background: b.bg, fontSize: 12, fontWeight: 600,
          color: b.color, animation: 'countUp 300ms cubic-bezier(0.2, 0, 0, 1)',
        }}>
          {b.icon}
          {b.text}
        </div>
      ))}
    </div>
  )
}
