'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { DollarSign, TrendingUp, TrendingDown, Users2, Minus } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtDate, fmtUSDCompact } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'

interface ClientProfit {
  company_id: string
  month: string
  total_revenue_usd: number
  total_cost_usd: number
  net_profit_usd: number
  margin_pct: number
  operations_count: number
  staff_time_hours: number
  staff_cost_usd: number
  ai_cost_usd: number
  platform_overhead_usd: number
  automation_pct: number
  revenue_per_operation: number
  cost_per_operation: number
  insights: {
    tier: string
    growth_signal: string
    churn_risk: string
    recommendation: string
  } | null
}

interface ProfitData {
  clients: ClientProfit[]
  summary: {
    total_clients: number
    profitable: number
    unprofitable: number
    total_revenue_usd: number
    total_profit_usd: number
    total_operations: number
    avg_margin_pct: number
  }
}

const TIER_COLORS: Record<string, { color: string; bg: string }> = {
  platinum: { color: '#6366F1', bg: '#EEF2FF' },
  gold: { color: 'var(--portal-status-amber-fg)', bg: 'rgba(192,197,206,0.08)' },
  silver: { color: 'var(--portal-fg-5)', bg: 'var(--portal-fg-1)' },
  bronze: { color: 'var(--portal-status-amber-fg)', bg: 'var(--portal-status-amber-bg)' },
}

export default function RentabilidadPage() {
  const isMobile = useIsMobile()
  const [data, setData] = useState<ProfitData | null>(null)
  const [loading, setLoading] = useState(true)

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    fetch('/api/profitability')
      .then(r => r.json())
      .then(d => setData(d.data || null))
      .catch((err) => console.error('[rentabilidad] fetch failed:', err.message))
      .finally(() => setLoading(false))
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <DollarSign size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
        <div style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>Solo Tito</div>
        <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-muted)', marginTop: 4 }}>Esta página es exclusiva para administración</div>
      </div>
    )
  }

  return (
    <div className="page-shell" style={{ padding: isMobile ? '16px' : undefined }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, fontSize: isMobile ? 20 : undefined }}>
        <DollarSign size={24} style={{ color: 'var(--gold)' }} />
        Rentabilidad por Cliente
      </h1>
      <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-muted)', marginBottom: 24 }}>
        Análisis de ganancia real por cliente — ingresos, costos, margen
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 8 }} />)}
        </div>
      ) : !data || data.clients.length === 0 ? (
        <EmptyState icon="💎" title="Sin datos" description="El análisis de rentabilidad se genera mensualmente." />
      ) : (
        <>
          {/* KPIs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: 12, marginBottom: 24,
          }}>
            <KPICard label="Ganancia total" value={`${fmtUSDCompact(data.summary.total_profit_usd)} USD`} color={data.summary.total_profit_usd >= 0 ? 'var(--portal-status-green-fg)' : 'var(--portal-status-red-fg)'} />
            <KPICard label="Ingresos" value={`${fmtUSDCompact(data.summary.total_revenue_usd)} USD`} color="var(--gold-dark)" />
            <KPICard label="Margen promedio" value={`${data.summary.avg_margin_pct}%`} color="var(--text-primary)" />
            <KPICard label="Operaciones" value={data.summary.total_operations} color="var(--text-primary)" />
          </div>

          {/* Profitable / Unprofitable summary */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 24,
            padding: '12px 16px', borderRadius: 8,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            fontSize: 'var(--aguila-fs-body)', fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ color: 'var(--portal-status-green-fg)' }}>
              {data.summary.profitable} rentable{data.summary.profitable !== 1 ? 's' : ''}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: data.summary.unprofitable > 0 ? 'var(--portal-status-red-fg)' : 'var(--text-muted)' }}>
              {data.summary.unprofitable} no rentable{data.summary.unprofitable !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Client cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.clients.map(c => (
              <ClientCard key={c.company_id} client={c} isMobile={isMobile} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function KPICard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{value}</div>
    </div>
  )
}

function ClientCard({ client: c, isMobile }: { client: ClientProfit; isMobile: boolean }) {
  const isProfitable = c.net_profit_usd >= 0
  const tier = TIER_COLORS[c.insights?.tier || 'bronze'] || TIER_COLORS.bronze
  const growthSignal = c.insights?.growth_signal || 'stable'
  const GrowthIcon = growthSignal === 'growing' ? TrendingUp : growthSignal === 'declining' ? TrendingDown : Minus
  const growthColor = growthSignal === 'growing' ? 'var(--portal-status-green-fg)' : growthSignal === 'declining' ? 'var(--portal-status-red-fg)' : 'var(--portal-fg-5)'

  return (
    <div style={{
      padding: '16px 20px', borderRadius: 10,
      background: isProfitable ? 'var(--portal-status-green-bg)' : 'var(--portal-status-red-bg)',
      border: `1px solid ${isProfitable ? 'rgba(34,197,94,0.2)' : '#FECACA'}`,
      borderLeft: `4px solid ${isProfitable ? 'var(--portal-status-green-fg)' : 'var(--portal-status-red-fg)'}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              {c.company_id}
            </span>
            <span style={{
              fontSize: 9, padding: '1px 8px', borderRadius: 4,
              background: tier.bg, color: tier.color, fontWeight: 700, textTransform: 'uppercase',
            }}>
              {c.insights?.tier || 'bronze'}
            </span>
            <GrowthIcon size={14} style={{ color: growthColor }} />
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', marginTop: 2 }}>
            {c.operations_count} operaciones · {fmtDate(c.month)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 'var(--aguila-fs-title)', fontWeight: 800, fontFamily: 'var(--font-mono)',
            color: isProfitable ? 'var(--portal-status-green-fg)' : 'var(--portal-status-red-fg)',
          }}>
            {fmtUSDCompact(c.net_profit_usd)}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {c.margin_pct}% margen
          </div>
        </div>
      </div>

      {/* Revenue / Cost breakdown */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 6,
        background: 'rgba(255,255,255,0.6)', fontSize: 'var(--aguila-fs-meta)', fontFamily: 'var(--font-mono)',
      }}>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: 9, fontWeight: 600 }}>INGRESO</div>
          <div style={{ color: 'var(--portal-status-green-fg)', fontWeight: 600 }}>{fmtUSDCompact(c.total_revenue_usd)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: 9, fontWeight: 600 }}>COSTO</div>
          <div style={{ color: 'var(--portal-status-red-fg)', fontWeight: 600 }}>{fmtUSDCompact(c.total_cost_usd)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: 9, fontWeight: 600 }}>$/OP</div>
          <div style={{ color: 'var(--text-primary)' }}>{fmtUSDCompact(c.revenue_per_operation)} / {fmtUSDCompact(c.cost_per_operation)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: 9, fontWeight: 600 }}>AUTOMATIZACIÓN</div>
          <div style={{ color: 'var(--text-primary)' }}>{c.automation_pct}%</div>
        </div>
      </div>

      {/* Cost detail */}
      <div style={{
        display: 'flex', gap: isMobile ? 8 : 16, marginTop: 8,
        fontSize: 'var(--aguila-fs-label)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
      }}>
        <span>Staff: {c.staff_time_hours}h ({fmtUSDCompact(c.staff_cost_usd)})</span>
        <span>AI: {fmtUSDCompact(c.ai_cost_usd)}</span>
        <span>Plataforma: {fmtUSDCompact(c.platform_overhead_usd)}</span>
      </div>

      {/* Recommendation */}
      {c.insights?.recommendation && (
        <div style={{
          marginTop: 10, padding: '6px 10px', borderRadius: 6,
          background: 'rgba(255,255,255,0.5)', fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-secondary)',
          borderLeft: `2px solid ${tier.color}`,
        }}>
          {c.insights.recommendation}
        </div>
      )}
    </div>
  )
}
