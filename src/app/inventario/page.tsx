'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Package, AlertTriangle, ShieldCheck, Eye, Clock } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtDate, fmtUSDCompact } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'

interface InventoryEstimate {
  id: string
  company_id: string
  product_key: string
  product_description: string
  avg_monthly_kg: number | null
  avg_monthly_usd: number | null
  avg_shipment_kg: number | null
  shipment_frequency_days: number | null
  last_shipment_date: string | null
  last_shipment_kg: number | null
  estimated_remaining_kg: number | null
  days_of_cover: number | null
  reorder_date: string | null
  depletion_date: string | null
  primary_supplier: string | null
  supplier_lead_time_days: number | null
  confidence: number
  sample_size: number
  risk_level: 'ok' | 'watch' | 'warning' | 'critical'
}

interface ReorderAlert {
  id: string
  product_description: string
  primary_supplier: string | null
  days_of_cover: number
  alert_message: string
  status: string
  created_at: string
}

interface InventoryData {
  estimates: InventoryEstimate[]
  alerts: ReorderAlert[]
  summary: {
    total_products: number
    critical: number
    warning: number
    avg_days_cover: number | null
  }
}

const RISK_CONFIG = {
  critical: { icon: AlertTriangle, color: 'var(--portal-status-red-fg)', bg: 'var(--portal-status-red-bg)', border: '#FECACA', label: 'CRÍTICO' },
  warning: { icon: AlertTriangle, color: 'var(--portal-status-amber-fg)', bg: 'rgba(192,197,206,0.08)', border: 'rgba(192,197,206,0.2)', label: 'ATENCIÓN' },
  watch: { icon: Eye, color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', label: 'MONITOREO' },
  ok: { icon: ShieldCheck, color: 'var(--portal-status-green-fg)', bg: 'var(--portal-status-green-bg)', border: 'rgba(34,197,94,0.2)', label: 'OK' },
} as const

function fmtKg(v: number | null): string {
  if (!v) return '—'
  return v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)} kg`
}

export default function InventarioPage() {
  const isMobile = useIsMobile()
  const [data, setData] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'watch'>('all')

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin' || role === 'broker'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    fetch('/api/inventory-oracle')
      .then(r => r.json())
      .then(d => setData(d.data || null))
      .catch((err) => console.error('[inventario] fetch failed:', err.message))
      .finally(() => setLoading(false))
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
        <div style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>Acceso restringido</div>
      </div>
    )
  }

  const filtered = data?.estimates.filter(e =>
    filter === 'all' ? true : e.risk_level === filter
  ) || []

  return (
    <div className="page-shell" style={{ padding: isMobile ? '16px' : undefined }}>
      {/* Header */}
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, fontSize: isMobile ? 20 : undefined }}>
        <Package size={24} style={{ color: 'var(--gold)' }} />
        Inventario Inteligente
      </h1>
      <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-muted)', marginBottom: 20 }}>
        Estimación de inventario por inferencia de importaciones — sin contar cajas
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 72, borderRadius: 8 }} />)}
        </div>
      ) : !data || data.estimates.length === 0 ? (
        <EmptyState
          icon="📦"
          title="Sin estimaciones"
          description="Las estimaciones se generan diariamente con datos de importación. Se necesitan 3+ envíos por producto."
        />
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 24,
          }}>
            <KPICard label="Productos" value={data.summary.total_products} icon={<Package size={16} />} />
            <KPICard
              label="Críticos"
              value={data.summary.critical}
              icon={<AlertTriangle size={16} />}
              color={data.summary.critical > 0 ? 'var(--portal-status-red-fg)' : 'var(--portal-status-green-fg)'}
            />
            <KPICard
              label="Atención"
              value={data.summary.warning}
              icon={<AlertTriangle size={16} />}
              color={data.summary.warning > 0 ? 'var(--portal-status-amber-fg)' : 'var(--portal-status-green-fg)'}
            />
            <KPICard
              label="Cobertura prom."
              value={data.summary.avg_days_cover != null ? `${data.summary.avg_days_cover}d` : '—'}
              icon={<Clock size={16} />}
            />
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['all', 'critical', 'warning', 'watch'] as const).map(f => {
              const count = f === 'all'
                ? data.estimates.length
                : data.estimates.filter(e => e.risk_level === f).length
              const labels = { all: 'Todos', critical: 'Críticos', warning: 'Atención', watch: 'Monitoreo' }
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1px solid ${filter === f ? 'var(--gold)' : 'var(--border)'}`,
                    background: filter === f ? 'var(--gold)' : 'var(--bg-card)',
                    color: filter === f ? '#FFFFFF' : 'var(--text-secondary)',
                    fontSize: 'var(--aguila-fs-compact)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    minHeight: 36,
                  }}
                >
                  {labels[f]} ({count})
                </button>
              )
            })}
          </div>

          {/* Pending alerts banner */}
          {data.alerts.length > 0 && (
            <div style={{
              padding: '12px 16px', borderRadius: 8, marginBottom: 16,
              background: 'rgba(192,197,206,0.08)', border: '1px solid #FDE68A',
            }}>
              <div style={{ fontSize: 'var(--aguila-fs-compact)', fontWeight: 700, color: '#92400E', marginBottom: 4 }}>
                {data.alerts.length} alerta(s) de reorden pendiente(s)
              </div>
              {data.alerts.slice(0, 2).map(a => (
                <div key={a.id} style={{ fontSize: 'var(--aguila-fs-meta)', color: '#78350F', marginTop: 4 }}>
                  {a.product_description.substring(0, 40)} — {a.days_of_cover} días cobertura
                </div>
              ))}
            </div>
          )}

          {/* Product estimates list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(est => (
              <InventoryCard key={est.id} estimate={est} isMobile={isMobile} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================================
// KPI Card
// ============================================================================

function KPICard({ label, value, icon, color }: {
  label: string
  value: string | number
  icon: React.ReactNode
  color?: string
}) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 8,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ color: color || 'var(--gold)' }}>{icon}</span>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        color: color || 'var(--text-primary)',
      }}>
        {value}
      </div>
    </div>
  )
}

// ============================================================================
// Inventory Estimate Card
// ============================================================================

function InventoryCard({ estimate: e, isMobile }: { estimate: InventoryEstimate; isMobile: boolean }) {
  const risk = RISK_CONFIG[e.risk_level]
  const RiskIcon = risk.icon

  // Coverage bar (max 90 days display)
  const coverPct = Math.min(100, ((e.days_of_cover || 0) / 90) * 100)
  const barColor = e.risk_level === 'critical' ? 'var(--portal-status-red-fg)'
    : e.risk_level === 'warning' ? 'var(--portal-status-amber-fg)'
    : e.risk_level === 'watch' ? '#6B7280'
    : 'var(--portal-status-green-fg)'

  return (
    <div style={{
      padding: '14px 18px', borderRadius: 10,
      background: risk.bg, border: `1px solid ${risk.border}`,
      borderLeft: `3px solid ${risk.color}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RiskIcon size={14} style={{ color: risk.color }} />
            <span style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {e.product_description}
            </span>
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 4,
              background: risk.color, color: '#FFFFFF', fontWeight: 700,
            }}>
              {risk.label}
            </span>
          </div>
          {e.primary_supplier && (
            <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-secondary)', marginTop: 2 }}>
              {e.primary_supplier} · lead time ~{e.supplier_lead_time_days}d
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: risk.color,
          }}>
            {e.days_of_cover ?? '?'}d
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-label)', color: 'var(--text-muted)' }}>cobertura</div>
        </div>
      </div>

      {/* Coverage bar */}
      <div style={{
        height: 6, borderRadius: 3,
        background: 'rgba(0,0,0,0.08)', marginTop: 10,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: barColor,
          width: `${coverPct}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Metrics */}
      <div style={{
        display: 'flex', gap: isMobile ? 10 : 20, marginTop: 10,
        fontSize: 'var(--aguila-fs-meta)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexWrap: 'wrap',
      }}>
        <span>Restante: ~{fmtKg(e.estimated_remaining_kg)}</span>
        <span>Consumo: ~{fmtKg(e.avg_monthly_kg)}/mes</span>
        <span>Envío: cada {e.shipment_frequency_days}d</span>
        <span>{e.sample_size} envíos</span>
        <span>{e.confidence}% conf</span>
      </div>

      {/* Dates row */}
      {(e.reorder_date || e.depletion_date) && (
        <div style={{
          display: 'flex', gap: isMobile ? 10 : 20, marginTop: 6,
          fontSize: 'var(--aguila-fs-meta)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
        }}>
          {e.last_shipment_date && (
            <span>Último envío: {fmtDate(e.last_shipment_date)}</span>
          )}
          {e.reorder_date && (
            <span style={{ color: e.risk_level === 'critical' ? 'var(--portal-status-red-fg)' : undefined }}>
              Reordenar: {fmtDate(e.reorder_date)}
            </span>
          )}
          {e.depletion_date && (
            <span style={{ color: e.risk_level === 'critical' ? 'var(--portal-status-red-fg)' : undefined }}>
              Agotamiento: {fmtDate(e.depletion_date)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
