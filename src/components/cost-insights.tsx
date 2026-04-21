'use client'

import { useEffect, useState } from 'react'
import { TrendingDown, TrendingUp, DollarSign } from 'lucide-react'
import { getCompanyIdCookie, getClientClaveCookie } from '@/lib/client-config'
import { fmtUSDCompact } from '@/lib/format-utils'
import Link from 'next/link'

interface CostInsight {
  type: 'saving' | 'anomaly' | 'trend'
  title: string
  detail: string
  href?: string
}

/**
 * Cost insights widget — surfaces savings opportunities and anomalies.
 * "T-MEC saved you $X this quarter" / "Shipment X cost 15% above average"
 */
export function CostInsights() {
  const [insights, setInsights] = useState<CostInsight[]>([])

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    const clave = getClientClaveCookie()
    if (!companyId) return

    Promise.all([
      fetch(`/api/data?table=traficos&company_id=${companyId}&limit=5000&gte_field=fecha_llegada&gte_value=2024-01-01`).then(r => r.json()),
      fetch(`/api/data?table=globalpc_facturas&cve_cliente=${clave}&limit=5000`).then(r => r.json()),
    ]).then(([trafData, factData]) => {
      const traficos = trafData.data ?? []
      const facturas = factData.data ?? []
      const items: CostInsight[] = []

      // T-MEC savings calculation
      const tmecOps = traficos.filter((t: { regimen: string | null }) => {
        const r = (t.regimen || '').toUpperCase()
        return r === 'ITE' || r === 'ITR' || r === 'IMD'
      })

      if (tmecOps.length > 0) {
        // Estimate savings: 5% of valor on T-MEC operations (IGI avoided)
        const tmecValor = tmecOps.reduce((s: number, t: { importe_total: number | null }) =>
          s + (Number(t.importe_total) || 0), 0)
        const estimatedSavings = Math.round(tmecValor * 0.05)

        if (estimatedSavings > 1000) {
          items.push({
            type: 'saving',
            title: `T-MEC: ~${fmtUSDCompact(estimatedSavings)} ahorrados`,
            detail: `${tmecOps.length} operaciones con tasa preferencial`,
            href: '/financiero',
          })
        }
      }

      // Average cost per operation
      if (facturas.length > 10) {
        const values = facturas
          .map((f: { valor_usd: number | null }) => Number(f.valor_usd) || 0)
          .filter((v: number) => v > 0)

        if (values.length > 10) {
          const avg = values.reduce((s: number, v: number) => s + v, 0) / values.length
          const recent = values.slice(0, 5)
          const recentAvg = recent.reduce((s: number, v: number) => s + v, 0) / recent.length

          const pctChange = Math.round(((recentAvg - avg) / avg) * 100)

          if (Math.abs(pctChange) >= 10) {
            items.push({
              type: pctChange > 0 ? 'anomaly' : 'trend',
              title: pctChange > 0
                ? `Valor promedio subió ${pctChange}% vs histórico`
                : `Valor promedio bajó ${Math.abs(pctChange)}% vs histórico`,
              detail: `Promedio reciente: ${fmtUSDCompact(recentAvg)} vs ${fmtUSDCompact(avg)} histórico`,
              href: '/financiero',
            })
          }
        }
      }

      // Total imported value YTD
      const ytdStart = `${new Date().getFullYear()}-01-01`
      const ytdTrafs = traficos.filter((t: { fecha_llegada: string | null }) =>
        t.fecha_llegada && t.fecha_llegada >= ytdStart)
      const ytdValue = ytdTrafs.reduce((s: number, t: { importe_total: number | null }) =>
        s + (Number(t.importe_total) || 0), 0)

      if (ytdValue > 0) {
        items.push({
          type: 'trend',
          title: `${fmtUSDCompact(ytdValue)} USD importados en ${new Date().getFullYear()}`,
          detail: `${ytdTrafs.length} operaciones este año`,
          href: '/financiero',
        })
      }

      setInsights(items.slice(0, 3))
    }).catch((err) => console.error('[cost-insights] fetch failed:', err.message))
  }, [])

  if (insights.length === 0) return null

  const iconMap = {
    saving: <TrendingDown size={14} style={{ color: 'var(--success)' }} />,
    anomaly: <TrendingUp size={14} style={{ color: 'var(--danger-500)' }} />,
    trend: <DollarSign size={14} style={{ color: 'var(--gold)' }} />,
  }

  return (
    <div className="card card-enter" style={{ padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <DollarSign size={16} style={{ color: 'var(--gold)' }} />
        <span style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          Inteligencia Financiera
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {insights.map((insight, i) => {
          const content = (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '8px 12px', borderRadius: 8,
              transition: 'background 150ms',
              cursor: insight.href ? 'pointer' : undefined,
            }}
            className={insight.href ? 'card-clickable' : undefined}
            >
              {iconMap[insight.type]}
              <div>
                <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {insight.title}
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', marginTop: 1 }}>
                  {insight.detail}
                </div>
              </div>
            </div>
          )
          return insight.href ? (
            <Link key={i} href={insight.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              {content}
            </Link>
          ) : content
        })}
      </div>
    </div>
  )
}
