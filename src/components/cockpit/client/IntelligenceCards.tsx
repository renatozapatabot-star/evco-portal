'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Package, DollarSign, Users } from 'lucide-react'

interface IntelRow {
  // Generic shape for intelligence table rows
  [key: string]: unknown
  company_id?: string
  created_at?: string
}

function useIntelligence(product: string) {
  const [data, setData] = useState<IntelRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/intelligence/${product}`)
      .then(r => r.json())
      .then(res => setData(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [product])

  return { data, loading }
}

function CardShell({ title, icon: Icon, children, loading }: {
  title: string
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>
  children: React.ReactNode
  loading: boolean
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      padding: '16px 20px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'rgba(0,229,255,0.08)',
          border: '1px solid rgba(0,229,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color="#00E5FF" strokeWidth={1.8} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3' }}>{title}</span>
      </div>
      {loading ? (
        <div className="skeleton-shimmer" style={{ height: 40, borderRadius: 8 }} />
      ) : children}
    </div>
  )
}

export function DemandForecastCard() {
  const { data, loading } = useIntelligence('demand')

  const forecasts = data.slice(0, 3)
  const hasData = forecasts.length > 0

  return (
    <CardShell title="Pronóstico de Demanda" icon={TrendingUp} loading={loading}>
      {hasData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {forecasts.map((f, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 13, color: '#94a3b8',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                {String(f.description || f.supplier || f.product || `Pronóstico ${i + 1}`)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#E6EDF3', fontWeight: 600 }}>
                {f.predicted_qty ? `${Number(f.predicted_qty).toLocaleString('es-MX')} uds` :
                 f.predicted_value ? `$${Number(f.predicted_value).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          Los pronósticos se generan con datos históricos de embarques.
        </p>
      )}
    </CardShell>
  )
}

export function InventoryEstimateCard() {
  const { data, loading } = useIntelligence('inventory')

  const estimates = data.slice(0, 3)
  const hasData = estimates.length > 0

  return (
    <CardShell title="Inventario Estimado" icon={Package} loading={loading}>
      {hasData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {estimates.map((e, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 13, color: '#94a3b8',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                {String(e.product || e.fraccion || e.location || `Estimado ${i + 1}`)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#E6EDF3', fontWeight: 600 }}>
                {e.estimated_qty ? `${Number(e.estimated_qty).toLocaleString('es-MX')} uds` :
                 e.aging_days ? `${e.aging_days} días` : '—'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          Los estimados de inventario se calculan con datos de entradas y salidas.
        </p>
      )}
    </CardShell>
  )
}

export function CostInsightsCard() {
  const { data, loading } = useIntelligence('cost-insights')

  const insights = data.slice(0, 3)
  const hasData = insights.length > 0

  return (
    <CardShell title="Ahorro Acumulado" icon={DollarSign} loading={loading}>
      {hasData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {insights.map((c, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 13, color: '#94a3b8',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                {String(c.insight_type || c.category || c.description || `Insight ${i + 1}`)}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: Number(c.savings_usd || c.impact_usd || 0) > 0 ? '#22C55E' : '#E6EDF3',
              }}>
                {c.savings_usd ? `+$${Number(c.savings_usd).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD` :
                 c.impact_usd ? `$${Number(c.impact_usd).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD` : '—'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          ADUANA monitorea oportunidades de ahorro en cada operación.
        </p>
      )}
    </CardShell>
  )
}

export function SupplierScoresCard() {
  const { data, loading } = useIntelligence('suppliers')

  const suppliers = data.slice(0, 4)
  const hasData = suppliers.length > 0

  function reliabilityLabel(score: number): { text: string; color: string } {
    if (score >= 80) return { text: 'Alta', color: '#22C55E' }
    if (score >= 50) return { text: 'Media', color: '#FBBF24' }
    return { text: 'Baja', color: '#EF4444' }
  }

  return (
    <CardShell title="Mis Proveedores" icon={Users} loading={loading}>
      {hasData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {suppliers.map((s, i) => {
            const score = Number(s.reliability_score || s.score || s.overall_score || 0)
            const { text, color } = reliabilityLabel(score)
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 13, color: '#94a3b8',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                  {String(s.supplier_name || s.nombre || s.cve_proveedor || `Proveedor ${i + 1}`)}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                  background: `${color}15`, color,
                }}>
                  {text}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          Las calificaciones de proveedores se construyen con historial de operaciones.
        </p>
      )}
    </CardShell>
  )
}
