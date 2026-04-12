'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Users2, DollarSign, TrendingDown, Shield, ChevronDown, ChevronUp } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtUSDCompact } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'

interface Alternative {
  name: string
  reliability_score: number | null
  compliance_rate: number | null
}

interface Brief {
  id: string
  supplier: string
  total_operations: number
  total_value_usd: number
  relationship_months: number
  doc_turnaround_days: number | null
  compliance_rate_pct: number | null
  tmec_qualification_pct: number | null
  late_delivery_pct: number | null
  supplier_avg_price_usd: number
  network_avg_price_usd: number
  price_vs_market_pct: number
  alternative_suppliers: Alternative[] | null
  negotiation_angle: string
  potential_savings_usd: number
  risk_assessment: string
  suggested_message: string
  status: string
}

interface NegData {
  briefs: Brief[]
  summary: { total_suppliers: number; total_potential_savings: number; above_market: number }
}

export default function NegociacionPage() {
  const isMobile = useIsMobile()
  const [data, setData] = useState<NegData | null>(null)
  const [loading, setLoading] = useState(true)

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin' || role === 'broker'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    fetch('/api/negotiation')
      .then(r => r.json())
      .then(d => setData(d.data || null))
      .catch((err) => console.error('[negociacion] fetch failed:', err.message))
      .finally(() => setLoading(false))
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <Users2 size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Acceso restringido</div>
      </div>
    )
  }

  return (
    <div className="page-shell" style={{ padding: isMobile ? '16px' : undefined }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, fontSize: isMobile ? 20 : undefined }}>
        <Users2 size={24} style={{ color: 'var(--gold)' }} />
        Negociación con Proveedores
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Briefs de negociación con datos de mercado, alternativas, y mensajes sugeridos
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 120, borderRadius: 8 }} />)}
        </div>
      ) : !data || data.briefs.length === 0 ? (
        <EmptyState icon="🤝" title="Sin briefs" description="Los briefs de negociación se generan semanalmente. Se necesitan 5+ operaciones por proveedor." />
      ) : (
        <>
          {/* KPIs */}
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: 12, marginBottom: 24,
          }}>
            <KPI label="Proveedores" value={data.summary.total_suppliers} color="var(--text-primary)" />
            <KPI label="Ahorro potencial/mes" value={`${fmtUSDCompact(data.summary.total_potential_savings)} USD`} color="var(--gold-dark)" />
            <KPI label="Arriba del mercado" value={data.summary.above_market} color={data.summary.above_market > 0 ? '#D97706' : '#16A34A'} />
          </div>

          {/* Briefs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.briefs.map(b => <BriefCard key={b.id} brief={b} isMobile={isMobile} />)}
          </div>
        </>
      )}
    </div>
  )
}

function KPI({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{value}</div>
    </div>
  )
}

function BriefCard({ brief: b, isMobile }: { brief: Brief; isMobile: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const aboveMarket = b.price_vs_market_pct > 10
  const borderColor = aboveMarket ? '#D97706' : 'var(--gold)'

  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden',
      background: 'var(--bg-card)', border: `1px solid var(--border)`,
      borderLeft: `3px solid ${borderColor}`,
    }}>
      <div style={{ padding: '14px 18px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{b.supplier}</span>
              {aboveMarket && (
                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(192,197,206,0.08)', color: '#92400E', fontWeight: 600 }}>
                  +{b.price_vs_market_pct}% vs mercado
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{b.negotiation_angle}</div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 80 }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--gold-dark)' }}>
              {fmtUSDCompact(b.potential_savings_usd)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>USD/mes</div>
            {expanded ? <ChevronUp size={14} style={{ marginTop: 4, color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ marginTop: 4, color: 'var(--text-muted)' }} />}
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: isMobile ? 8 : 16, marginTop: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span>{b.total_operations} ops</span>
          <span>{fmtUSDCompact(b.total_value_usd)} total</span>
          <span>{b.relationship_months} meses</span>
          {b.tmec_qualification_pct != null && <span>T-MEC: {b.tmec_qualification_pct}%</span>}
          {b.compliance_rate_pct != null && <span>Cumplimiento: {b.compliance_rate_pct}%</span>}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--border)' }}>
          {/* Leverage + Performance */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12,
            padding: '10px 12px', borderRadius: 6, background: 'var(--bg-main)', fontSize: 11,
          }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>SU LEVERAGE</div>
              <div>{b.total_operations} operaciones · {fmtUSDCompact(b.total_value_usd)} USD</div>
              <div>{b.relationship_months} meses de relación</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>PERFORMANCE</div>
              {b.doc_turnaround_days && <div>Docs: {b.doc_turnaround_days}d turnaround</div>}
              {b.late_delivery_pct != null && <div>Entregas tardías: {b.late_delivery_pct}%</div>}
            </div>
          </div>

          {/* Pricing context */}
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'var(--bg-main)', fontSize: 11 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>CONTEXTO DE MERCADO</div>
            <div style={{ fontFamily: 'var(--font-mono)' }}>
              Proveedor: {fmtUSDCompact(b.supplier_avg_price_usd)} USD/op ·
              Red: {fmtUSDCompact(b.network_avg_price_usd)} USD/op ·
              Diferencia: {b.price_vs_market_pct > 0 ? '+' : ''}{b.price_vs_market_pct}%
            </div>
          </div>

          {/* Alternatives */}
          {b.alternative_suppliers && b.alternative_suppliers.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>ALTERNATIVAS</div>
              {b.alternative_suppliers.map((alt, i) => (
                <div key={i} style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {alt.name} · score: {alt.reliability_score || '—'}
                </div>
              ))}
            </div>
          )}

          {/* Risk */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <Shield size={12} style={{ color: '#16A34A' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Riesgo: {b.risk_assessment}</span>
          </div>

          {/* Suggested message */}
          {b.suggested_message && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
              fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gold-dark)', marginBottom: 6 }}>MENSAJE SUGERIDO</div>
              {b.suggested_message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
