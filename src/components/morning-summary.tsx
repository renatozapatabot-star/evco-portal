'use client'

import { useEffect, useState } from 'react'
import { Sunrise, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { getCompanyIdCookie } from '@/lib/client-config'
import { fmtDate } from '@/lib/format-utils'
import Link from 'next/link'

interface SummaryItem {
  icon: 'check' | 'alert' | 'trend'
  text: string
  href?: string
}

/**
 * Morning summary card — "3 cosas que saber hoy"
 * Shows proactive intelligence on the client dashboard.
 */
export function MorningSummary() {
  const [items, setItems] = useState<SummaryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    if (!companyId) { setLoading(false); return }

    Promise.all([
      fetch(`/api/data?table=traficos&company_id=${companyId}&limit=5000&gte_field=fecha_llegada&gte_value=2024-01-01`).then(r => r.json()),
      fetch(`/api/data?table=entradas&company_id=${companyId}&limit=1000&order_by=fecha_llegada_mercancia&order_dir=desc`).then(r => r.json()),
    ]).then(([trafData, entData]) => {
      const traficos = trafData.data ?? []
      const entradas = entData.data ?? []
      const summaryItems: SummaryItem[] = []

      // Count active traficos
      const active = traficos.filter((t: { estatus: string | null }) => {
        const s = (t.estatus || '').toLowerCase()
        return !s.includes('cruz') && !s.includes('entreg') && !s.includes('complet')
      })

      if (active.length === 0) {
        summaryItems.push({
          icon: 'check',
          text: 'Sin embarques pendientes — todas las operaciones están al día',
        })
      } else {
        summaryItems.push({
          icon: 'alert',
          text: `${active.length} embarque${active.length !== 1 ? 's' : ''} en proceso`,
          href: '/embarques?estatus=En Proceso',
        })
      }

      // Check for recently crossed
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const recentlyCrossed = traficos.filter((t: { estatus: string | null; fecha_cruce: string | null }) => {
        const s = (t.estatus || '').toLowerCase()
        return s.includes('cruz') && t.fecha_cruce && t.fecha_cruce >= yesterday
      })

      if (recentlyCrossed.length > 0) {
        summaryItems.push({
          icon: 'check',
          text: `${recentlyCrossed.length} embarque${recentlyCrossed.length !== 1 ? 's' : ''} cruzado${recentlyCrossed.length !== 1 ? 's' : ''} recientemente`,
          href: '/embarques?estatus=Cruzado',
        })
      }

      // T-MEC savings info
      const tmecOps = traficos.filter((t: { regimen: string | null }) => {
        const r = (t.regimen || '').toUpperCase()
        return r === 'ITE' || r === 'ITR' || r === 'IMD'
      })
      if (tmecOps.length > 0) {
        const pct = Math.round((tmecOps.length / traficos.length) * 100)
        summaryItems.push({
          icon: 'trend',
          text: `${pct}% de operaciones con T-MEC — ${tmecOps.length} de ${traficos.length}`,
          href: '/financiero',
        })
      }

      // New entradas today
      const entradasHoy = entradas.filter((e: { fecha_llegada_mercancia: string | null }) =>
        e.fecha_llegada_mercancia && e.fecha_llegada_mercancia.startsWith(today)
      )
      if (entradasHoy.length > 0) {
        summaryItems.push({
          icon: 'alert',
          text: `${entradasHoy.length} entrada${entradasHoy.length !== 1 ? 's' : ''} nueva${entradasHoy.length !== 1 ? 's' : ''} hoy`,
          href: '/entradas',
        })
      }

      setItems(summaryItems.slice(0, 3)) // Max 3 items
    }).catch((err) => console.error('[morning-summary] fetch failed:', err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading || items.length === 0) return null

  const iconMap = {
    check: <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />,
    alert: <AlertTriangle size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />,
    trend: <TrendingUp size={16} style={{ color: 'var(--info)', flexShrink: 0 }} />,
  }

  return (
    <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Sunrise size={16} style={{ color: 'var(--gold)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          Resumen · {fmtDate(new Date())}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) => {
          const content = (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5,
                padding: item.href ? '8px 12px' : undefined,
                borderRadius: item.href ? 8 : undefined,
                transition: item.href ? 'background 150ms' : undefined,
                cursor: item.href ? 'pointer' : undefined,
              }}
              className={item.href ? 'card-clickable' : undefined}
            >
              {iconMap[item.icon]}
              <span>{item.text}</span>
            </div>
          )
          return item.href ? (
            <Link key={i} href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              {content}
            </Link>
          ) : content
        })}
      </div>
    </div>
  )
}
