'use client'

import { useEffect, useState } from 'react'
import { Clock, TrendingUp } from 'lucide-react'
import { fmtDate } from '@/lib/format-utils'

interface ETAPrediction {
  estimated_days: number
  estimated_date: string
  days_elapsed: number
  days_remaining: number
  range: { optimistic: number; expected: number; conservative: number }
  confidence: string
}

interface Props {
  traficoId: string
  isCruzado?: boolean
}

/**
 * ETA prediction widget — shows estimated crossing date based on ML model.
 */
export function ETAPrediction({ traficoId, isCruzado }: Props) {
  const [prediction, setPrediction] = useState<ETAPrediction | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (isCruzado) return // Don't predict for already-crossed
    fetch('/api/predict-eta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trafico_id: traficoId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.prediction) setPrediction(data.prediction)
        if (data.message) setMessage(data.message)
      })
      .catch(() => {})
  }, [traficoId, isCruzado])

  if (isCruzado || !prediction) return null

  const progress = prediction.days_elapsed / prediction.estimated_days
  const progressPct = Math.min(100, Math.round(progress * 100))
  const isOverdue = prediction.days_remaining === 0 && prediction.days_elapsed > prediction.estimated_days

  return (
    <div className="card card-enter" style={{ padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Clock size={16} style={{ color: isOverdue ? 'var(--danger-500)' : 'var(--gold)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          Estimación de Cruce
        </span>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 9999,
          background: prediction.confidence === 'high' ? 'rgba(22,163,74,0.1)' : 'rgba(196,150,60,0.1)',
          color: prediction.confidence === 'high' ? 'var(--success)' : 'var(--gold)',
          fontWeight: 600,
        }}>
          {prediction.confidence === 'high' ? 'Alta confianza' : 'Confianza media'}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ position: 'relative', height: 8, background: 'var(--slate-100)', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${progressPct}%`,
          background: isOverdue
            ? 'var(--danger-500)'
            : progressPct > 75
              ? 'var(--gold)'
              : 'var(--success)',
          transition: 'width 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }} />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: isOverdue ? 'var(--danger-500)' : 'var(--text-primary)' }}>
            {prediction.days_remaining > 0 ? `${prediction.days_remaining} día${prediction.days_remaining !== 1 ? 's' : ''}` : 'Pronto'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {message}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {fmtDate(prediction.estimated_date)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Rango: {prediction.range.optimistic}–{prediction.range.conservative} días
          </div>
        </div>
      </div>
    </div>
  )
}
