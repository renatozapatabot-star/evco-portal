'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { DollarSign, TrendingDown, Zap, Truck, Clock, Users2, Award } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtDate, fmtUSDCompact } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'

interface CostInsight {
  id: string
  insight_type: string
  trafico: string | null
  supplier: string | null
  estimated_savings_usd: number
  estimated_savings_mxn: number | null
  savings_basis: string
  confidence: number
  current_value: string | null
  optimized_value: string | null
  status: 'new' | 'reviewed' | 'accepted' | 'rejected' | 'implemented'
  created_at: string
}

interface MonthlySavings {
  month: string
  insights_generated: number
  estimated_savings_usd: number
  realized_savings_usd: number
  savings_by_type: Record<string, number> | null
}

interface CostData {
  insights: CostInsight[]
  monthly: MonthlySavings[]
  summary: {
    total_insights: number
    new_insights: number
    total_estimated_usd: number
    total_implemented_usd: number
  }
}

const TYPE_CONFIG: Record<string, { icon: typeof DollarSign; label: string; color: string }> = {
  bridge_optimization: { icon: Truck, label: 'Cruce', color: '#0D9488' },
  filing_timing: { icon: Clock, label: 'Timing', color: '#6366F1' },
  supplier_pricing: { icon: Users2, label: 'Proveedor', color: '#D97706' },
  consolidation: { icon: Zap, label: 'Consolidar', color: '#16A34A' },
  regime_optimization: { icon: Award, label: 'Régimen', color: '#7E22CE' },
  fraccion_review: { icon: DollarSign, label: 'Fracción', color: '#DC2626' },
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'NUEVO', color: '#D97706', bg: 'rgba(234,179,8,0.08)' },
  reviewed: { label: 'REVISADO', color: '#6B7280', bg: '#F9FAFB' },
  accepted: { label: 'ACEPTADO', color: '#16A34A', bg: 'rgba(34,197,94,0.1)' },
  implemented: { label: 'IMPLEMENTADO', color: '#16A34A', bg: '#DCFCE7' },
  rejected: { label: 'DESCARTADO', color: '#9CA3AF', bg: '#F3F4F6' },
}

export default function AhorroPage() {
  const isMobile = useIsMobile()
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/cost-insights')
      .then(r => r.json())
      .then(d => setData(d.data || null))
      .catch((err) => console.error('[ahorro] fetch failed:', err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-shell" style={{ padding: isMobile ? '16px' : undefined }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, fontSize: isMobile ? 20 : undefined }}>
        <TrendingDown size={24} style={{ color: 'var(--gold)' }} />
        Optimización de Costos
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Oportunidades de ahorro detectadas por AGUILA en cada operación
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 8 }} />)}
        </div>
      ) : !data || data.insights.length === 0 ? (
        <EmptyState
          icon="💰"
          title="Sin oportunidades"
          description="El optimizador analiza costos semanalmente. Se necesitan 10+ operaciones para generar insights."
        />
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: 12, marginBottom: 24,
          }}>
            <KPICard
              label="Ahorro potencial/mes"
              value={`${fmtUSDCompact(data.summary.total_estimated_usd)} USD`}
              color="var(--gold-dark)"
            />
            <KPICard
              label="Oportunidades"
              value={data.summary.total_insights}
              color="var(--text-primary)"
            />
            <KPICard
              label="Nuevas"
              value={data.summary.new_insights}
              color={data.summary.new_insights > 0 ? '#D97706' : '#16A34A'}
            />
            <KPICard
              label="Implementadas"
              value={`${fmtUSDCompact(data.summary.total_implemented_usd)} USD`}
              color="#16A34A"
            />
          </div>

          {/* Monthly bar chart */}
          {data.monthly.length > 1 && (
            <div style={{
              padding: '14px 18px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                Ahorro mensual estimado
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 50 }}>
                {data.monthly.slice(0, 6).reverse().map((m, i) => {
                  const maxVal = Math.max(...data.monthly.map(x => x.estimated_savings_usd || 1))
                  const pct = maxVal > 0 ? (m.estimated_savings_usd / maxVal) * 100 : 0
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{
                        width: '100%', borderRadius: 3,
                        background: 'var(--gold)',
                        height: `${Math.max(4, pct * 0.5)}px`,
                        opacity: 0.7,
                      }} />
                      <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {fmtUSDCompact(m.estimated_savings_usd)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Insights list */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold-dark)', marginBottom: 12 }}>
            Oportunidades de ahorro ({data.insights.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.insights.map(ins => (
              <InsightCard key={ins.id} insight={ins} isMobile={isMobile} />
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
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{value}</div>
    </div>
  )
}

function InsightCard({ insight: ins, isMobile }: { insight: CostInsight; isMobile: boolean }) {
  const typeConfig = TYPE_CONFIG[ins.insight_type] || { icon: DollarSign, label: ins.insight_type, color: '#6B7280' }
  const TypeIcon = typeConfig.icon
  const statusConfig = STATUS_LABELS[ins.status] || STATUS_LABELS.new

  return (
    <div style={{
      padding: '14px 18px', borderRadius: 10,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${typeConfig.color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <TypeIcon size={14} style={{ color: typeConfig.color }} />
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: typeConfig.color, color: '#FFF', fontWeight: 600 }}>
              {typeConfig.label.toUpperCase()}
            </span>
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 4,
              background: statusConfig.bg, color: statusConfig.color, fontWeight: 600,
            }}>
              {statusConfig.label}
            </span>
            {ins.supplier && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ins.supplier}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 6, fontWeight: 500 }}>
            {ins.savings_basis}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 80 }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--gold-dark)' }}>
            {fmtUSDCompact(ins.estimated_savings_usd)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>USD/mes</div>
        </div>
      </div>

      {/* Current vs Optimized */}
      {(ins.current_value || ins.optimized_value) && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10,
          padding: '8px 10px', borderRadius: 6, background: 'var(--bg-main)',
          fontSize: 11,
        }}>
          {ins.current_value && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>ACTUAL</div>
              <div style={{ color: 'var(--text-secondary)' }}>{ins.current_value}</div>
            </div>
          )}
          {ins.optimized_value && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, color: typeConfig.color, marginBottom: 2 }}>OPTIMIZADO</div>
              <div style={{ color: 'var(--text-secondary)' }}>{ins.optimized_value}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
        <span>{ins.confidence}% conf</span>
        {ins.estimated_savings_mxn && <span>~{fmtUSDCompact(ins.estimated_savings_mxn)} MXN</span>}
        <span>{fmtDate(ins.created_at)}</span>
      </div>
    </div>
  )
}
