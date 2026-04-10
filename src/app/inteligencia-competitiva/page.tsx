'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Eye, Zap, Shield, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtDate } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'

interface IntelItem {
  id: string
  intel_type: string
  title: string
  summary: string
  source: string | null
  relevance_score: number | null
  actionable: boolean
  suggested_action: string | null
  status: string
  detected_at: string
  effective_date: string | null
}

interface IntelData {
  intel: IntelItem[]
  summary: { total: number; new: number; actionable: number; by_type: Record<string, number> }
}

const TYPE_CONFIG: Record<string, { icon: typeof Eye; label: string; color: string }> = {
  competitor_move: { icon: Eye, label: 'Competencia', color: '#6366F1' },
  regulatory_change: { icon: Shield, label: 'Regulatorio', color: '#7E22CE' },
  market_opportunity: { icon: Zap, label: 'Oportunidad', color: '#16A34A' },
  industry_trend: { icon: TrendingUp, label: 'Tendencia', color: '#0D9488' },
  tariff_change: { icon: DollarSign, label: 'Arancelario', color: '#D97706' },
}

export default function IntelCompetitivaPage() {
  const isMobile = useIsMobile()
  const [data, setData] = useState<IntelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin' || role === 'broker'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    fetch('/api/competitive-intel')
      .then(r => r.json())
      .then(d => setData(d.data || null))
      .catch((err) => console.error('[inteligencia-competitiva] fetch failed:', err.message))
      .finally(() => setLoading(false))
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <Eye size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Acceso restringido</div>
      </div>
    )
  }

  const filtered = data?.intel.filter(i =>
    filter === 'all' ? true : filter === 'actionable' ? i.actionable : i.intel_type === filter
  ) || []

  return (
    <div className="page-shell" style={{ padding: isMobile ? '16px' : undefined }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, fontSize: isMobile ? 20 : undefined }}>
        <Eye size={24} style={{ color: 'var(--gold)' }} />
        Inteligencia Competitiva
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Cambios regulatorios, tendencias de mercado, y oportunidades detectadas por ADUANA
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 8 }} />)}
        </div>
      ) : !data || data.intel.length === 0 ? (
        <EmptyState icon="🔭" title="Sin inteligencia" description="El scanner analiza datos diariamente. Los insights aparecerán cuando se detecten cambios." />
      ) : (
        <>
          {/* KPIs */}
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: 12, marginBottom: 20,
          }}>
            <KPI label="Total" value={data.summary.total} color="var(--text-primary)" />
            <KPI label="Nuevos" value={data.summary.new} color={data.summary.new > 0 ? '#D97706' : '#6B7280'} />
            <KPI label="Accionables" value={data.summary.actionable} color={data.summary.actionable > 0 ? '#16A34A' : '#6B7280'} />
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <Pill active={filter === 'all'} onClick={() => setFilter('all')} label={`Todos (${data.intel.length})`} />
            <Pill active={filter === 'actionable'} onClick={() => setFilter('actionable')} label={`Accionables (${data.summary.actionable})`} />
            {Object.keys(data.summary.by_type).map(t => (
              <Pill key={t} active={filter === t} onClick={() => setFilter(t)}
                label={`${TYPE_CONFIG[t]?.label || t} (${data.summary.by_type[t]})`} />
            ))}
          </div>

          {/* Intel cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(item => {
              const config = TYPE_CONFIG[item.intel_type] || { icon: Eye, label: item.intel_type, color: '#6B7280' }
              const Icon = config.icon
              return (
                <div key={item.id} style={{
                  padding: '14px 18px', borderRadius: 10,
                  background: item.actionable ? '#F0FDF4' : 'var(--bg-card)',
                  border: `1px solid ${item.actionable ? '#BBF7D0' : 'var(--border)'}`,
                  borderLeft: `3px solid ${config.color}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Icon size={14} style={{ color: config.color }} />
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: config.color, color: '#FFF', fontWeight: 600 }}>
                          {config.label.toUpperCase()}
                        </span>
                        {item.actionable && (
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#DCFCE7', color: '#15803D', fontWeight: 600 }}>
                            ACCIONABLE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {item.summary}
                      </div>
                      {item.suggested_action && (
                        <div style={{
                          marginTop: 8, padding: '6px 10px', borderRadius: 6,
                          background: 'rgba(255,255,255,0.6)', fontSize: 11, color: '#15803D',
                        }}>
                          <AlertTriangle size={10} style={{ display: 'inline', marginRight: 4 }} />
                          {item.suggested_action}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 60 }}>
                      {item.relevance_score && (
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: config.color }}>
                          {item.relevance_score}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {fmtDate(item.detected_at)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function KPI({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{value}</div>
    </div>
  )
}

function Pill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer', minHeight: 32,
      border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
      background: active ? 'var(--gold)' : 'var(--bg-card)',
      color: active ? '#FFF' : 'var(--text-secondary)',
    }}>
      {label}
    </button>
  )
}
