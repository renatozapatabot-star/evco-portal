'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Package, TrendingUp, Target, Zap, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtDate, fmtUSDCompact } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'

interface Prediction {
  id: number
  company_id: string
  forecast_date: string
  forecast_data: {
    supplier: string
    predicted_date: string
    confidence: number
    avg_frequency_days: number
    avg_value: number
    product: string
    sample_size: number
    preferred_dow: string
    last_shipment: string
  }
}

interface POPrediction {
  id: string
  company_id: string
  supplier: string
  predicted_date: string
  predicted_date_low: string | null
  predicted_date_high: string | null
  avg_frequency_days: number
  std_deviation_days: number
  predicted_value_usd: number | null
  value_low_usd: number | null
  value_high_usd: number | null
  predicted_products: { description: string; fraccion?: string }[] | null
  predicted_weight_kg: number | null
  estimated_duties: {
    valor_aduana_mxn: number
    dta: number
    igi: number
    iva: number
    total_mxn: number
    exchange_rate: number
  } | null
  optimal_crossing: {
    dow: number
    dow_name: string
    window: string
    estimated_hours: number
  } | null
  confidence: number
  sample_size: number
  last_shipment_date: string | null
  status: 'active' | 'matched' | 'expired' | 'missed'
  match_score: number | null
  matched_trafico: string | null
  timing_error_days: number | null
}

interface StagedTrafico {
  id: string
  supplier: string
  descripcion_mercancia: string
  importe_total: number | null
  peso_bruto: number | null
  estimated_duties: POPrediction['estimated_duties']
  recommended_crossing: POPrediction['optimal_crossing']
}

interface POData {
  predictions: POPrediction[]
  staged: StagedTrafico[]
  accuracy: { avg_score: number | null; total_matched: number; avg_timing_error: number | null }
}

export default function PrediccionesPage() {
  const isMobile = useIsMobile()
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [poData, setPOData] = useState<POData | null>(null)
  const [loading, setLoading] = useState(true)

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin' || role === 'broker'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    Promise.all([
      fetch('/api/data?table=demand_forecasts&limit=50&order_by=forecast_date&order_dir=asc')
        .then(r => r.json()).then(d => setPredictions(d.data || [])).catch(() => {}),
      fetch('/api/po-predictions')
        .then(r => r.json()).then(d => setPOData(d.data || null)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Acceso restringido</div>
      </div>
    )
  }

  const upcoming = predictions.filter(p => {
    const d = p.forecast_data?.predicted_date || p.forecast_date
    return new Date(d) >= new Date()
  })
  const past = predictions.filter(p => {
    const d = p.forecast_data?.predicted_date || p.forecast_date
    return new Date(d) < new Date()
  })

  const activePO = (poData?.predictions || []).filter(p => p.status === 'active')
  const matchedPO = (poData?.predictions || []).filter(p => p.status === 'matched')

  return (
    <div className="page-shell" style={{ padding: isMobile ? '16px' : undefined }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, fontSize: isMobile ? 20 : undefined }}>
        <TrendingUp size={24} style={{ color: 'var(--gold)' }} />
        Predicciones de Demanda
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        {predictions.length} predicciones · {upcoming.length} próximas · {activePO.length} PO activas
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 8 }} />)}
        </div>
      ) : (
        <>
          {/* PO Predictions — the intelligence layer */}
          {activePO.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Target size={14} style={{ color: 'var(--gold)' }} />
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold-dark)' }}>
                  Predicciones de Orden de Compra ({activePO.length})
                </div>
              </div>

              {/* Accuracy KPI bar */}
              {poData?.accuracy?.total_matched != null && poData.accuracy.total_matched > 0 && (
                <div style={{
                  display: 'flex', gap: isMobile ? 12 : 24, marginBottom: 16, padding: '10px 16px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
                  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flexWrap: 'wrap',
                }}>
                  <span>Precisión: <strong style={{ color: 'var(--text-primary)' }}>{poData.accuracy.avg_score}%</strong></span>
                  <span>Confirmados: <strong style={{ color: 'var(--text-primary)' }}>{poData.accuracy.total_matched}</strong></span>
                  {poData.accuracy.avg_timing_error != null && (
                    <span>Error timing: <strong style={{ color: 'var(--text-primary)' }}>±{poData.accuracy.avg_timing_error}d</strong></span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                {activePO.map(p => <POPredictionCard key={p.id} prediction={p} />)}
              </div>
            </>
          )}

          {/* Matched PO Predictions */}
          {matchedPO.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#16A34A' }}>
                  PO Confirmados ({matchedPO.length})
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                {matchedPO.slice(0, 5).map(p => <POPredictionCard key={p.id} prediction={p} />)}
              </div>
            </>
          )}

          {/* Demand Forecasts (original) */}
          {predictions.length === 0 && activePO.length === 0 ? (
            <EmptyState icon="📦" title="Sin predicciones" description="Las predicciones se generan semanalmente con datos de envío históricos." />
          ) : (
            <>
              {upcoming.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold-dark)', marginBottom: 12 }}>
                    Próximos envíos esperados
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                    {upcoming.map(p => <DemandCard key={p.id} prediction={p} />)}
                  </div>
                </>
              )}
              {past.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Predicciones pasadas
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {past.slice(0, 10).map(p => <DemandCard key={p.id} prediction={p} past />)}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================================
// PO Prediction Card — the intelligence card
// ============================================================================

function POPredictionCard({ prediction: p }: { prediction: POPrediction }) {
  const isMatched = p.status === 'matched'
  const daysUntil = Math.round((new Date(p.predicted_date).getTime() - Date.now()) / 86400000)
  const topProduct = p.predicted_products?.[0]?.description || '—'

  const statusColor = isMatched ? '#16A34A' : p.confidence >= 85 ? 'var(--gold)' : 'var(--text-muted)'
  const StatusIcon = isMatched ? CheckCircle2 : p.confidence >= 85 ? Zap : Clock

  return (
    <div style={{
      padding: '14px 18px', borderRadius: 12,
      background: isMatched ? '#F0FDF4' : 'var(--bg-card)',
      border: `1px solid ${isMatched ? '#BBF7D0' : p.confidence >= 85 ? 'var(--gold)' : 'var(--border)'}`,
      borderLeft: `3px solid ${statusColor}`,
      opacity: isMatched ? 0.85 : 1,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusIcon size={14} style={{ color: statusColor }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {p.supplier}
            </span>
            {isMatched && (
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#DCFCE7', color: '#15803D', fontWeight: 600 }}>
                CONFIRMADO
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {topProduct}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: isMatched ? '#15803D' : 'var(--gold-dark)' }}>
            {fmtDate(p.predicted_date)}
          </div>
          {!isMatched && daysUntil >= 0 && (
            <div style={{ fontSize: 11, color: daysUntil <= 3 ? '#D97706' : 'var(--text-muted)' }}>
              {daysUntil === 0 ? 'Hoy' : daysUntil === 1 ? 'Mañana' : `en ${daysUntil} días`}
            </div>
          )}
          {isMatched && p.timing_error_days != null && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              error: ±{p.timing_error_days}d
            </div>
          )}
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span style={{ color: p.confidence >= 85 ? 'var(--gold-dark)' : undefined }}>
          {p.confidence}% conf
        </span>
        {p.predicted_value_usd && (
          <span>~{fmtUSDCompact(p.predicted_value_usd)}</span>
        )}
        {p.predicted_weight_kg && (
          <span>{p.predicted_weight_kg.toLocaleString('es-MX')} kg</span>
        )}
        <span>cada {p.avg_frequency_days}d ±{p.std_deviation_days}d</span>
        <span>{p.sample_size} muestras</span>
        {isMatched && p.match_score && (
          <span style={{ color: '#15803D' }}>match: {Math.round(p.match_score * 100)}%</span>
        )}
      </div>

      {/* Duty estimate + crossing window */}
      {(p.estimated_duties || p.optimal_crossing) && (
        <div style={{
          display: 'flex', gap: 16, marginTop: 8, padding: '6px 10px',
          background: 'var(--bg-main)', borderRadius: 6, fontSize: 11,
          fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flexWrap: 'wrap',
        }}>
          {p.estimated_duties && (
            <>
              <span>DTA: {fmtUSDCompact(p.estimated_duties.dta)} MXN</span>
              <span>IGI: {fmtUSDCompact(p.estimated_duties.igi)} MXN</span>
              <span>IVA: {fmtUSDCompact(p.estimated_duties.iva)} MXN</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Total: {fmtUSDCompact(p.estimated_duties.total_mxn)} MXN
              </span>
            </>
          )}
          {p.optimal_crossing && (
            <span>
              Cruce: {p.optimal_crossing.dow_name} {p.optimal_crossing.window} (~{p.optimal_crossing.estimated_hours}h)
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Demand Forecast Card (original)
// ============================================================================

function DemandCard({ prediction: p, past }: { prediction: Prediction; past?: boolean }) {
  const d = p.forecast_data || {} as Prediction['forecast_data']
  const date = d.predicted_date || p.forecast_date
  const daysUntil = Math.round((new Date(date).getTime() - Date.now()) / 86400000)

  return (
    <div style={{
      padding: '14px 18px', borderRadius: 12,
      background: past ? 'var(--bg-main)' : 'var(--bg-card)',
      border: `1px solid ${past ? 'var(--border)' : 'var(--gold)'}`,
      borderLeft: past ? undefined : '3px solid var(--gold)',
      opacity: past ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {p.company_id}/{d.supplier || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {d.product || '—'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: past ? 'var(--text-muted)' : 'var(--gold-dark)' }}>
            {fmtDate(date)}
          </div>
          {!past && (
            <div style={{ fontSize: 11, color: daysUntil <= 7 ? 'var(--warning-500, #D97706)' : 'var(--text-muted)' }}>
              {daysUntil === 0 ? 'Hoy' : daysUntil === 1 ? 'Mañana' : `en ${daysUntil} días`}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
        <span>{d.confidence || 0}% conf</span>
        <span>cada {d.avg_frequency_days || '?'}d</span>
        <span>~{fmtUSDCompact(d.avg_value || 0)}</span>
        <span>{d.sample_size || 0} muestras</span>
        <span>{d.preferred_dow || '—'}</span>
      </div>
    </div>
  )
}
