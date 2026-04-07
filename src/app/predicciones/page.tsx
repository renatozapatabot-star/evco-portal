'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Package, TrendingUp } from 'lucide-react'
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

export default function PrediccionesPage() {
  const isMobile = useIsMobile()
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin' || role === 'broker'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    fetch('/api/data?table=demand_forecasts&limit=50&order_by=forecast_date&order_dir=asc')
      .then(r => r.json())
      .then(d => setPredictions(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
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

  return (
    <div className="page-shell" style={{ padding: isMobile ? '16px' : undefined }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, fontSize: isMobile ? 20 : undefined }}>
        <TrendingUp size={24} style={{ color: 'var(--gold)' }} />
        Predicciones de Demanda
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        {predictions.length} predicciones · {upcoming.length} próximas
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 8 }} />)}
        </div>
      ) : predictions.length === 0 ? (
        <EmptyState icon="📦" title="Sin predicciones" description="Las predicciones se generan semanalmente con datos de envío históricos." />
      ) : (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold-dark)', marginBottom: 12 }}>
                Próximos envíos esperados
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                {upcoming.map(p => <PredictionCard key={p.id} prediction={p} />)}
              </div>
            </>
          )}

          {/* Past (for accuracy tracking) */}
          {past.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
                Predicciones pasadas
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {past.slice(0, 10).map(p => <PredictionCard key={p.id} prediction={p} past />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function PredictionCard({ prediction: p, past }: { prediction: Prediction; past?: boolean }) {
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
