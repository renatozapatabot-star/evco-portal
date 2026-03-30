'use client'
import { Check } from 'lucide-react'
import { fmtDate } from '@/lib/format-utils'

interface Step { label: string; date?: string | null; status: 'complete' | 'current' | 'pending' }

export function buildTimelineSteps(trafico: any): Step[] {
  const isCruzado = (trafico.estatus || '').toLowerCase().includes('cruz')
  const hasPedimento = !!trafico.pedimento
  const hasPago = !!trafico.fecha_pago

  const steps: Step[] = [
    { label: 'Recibido', date: trafico.fecha_llegada, status: trafico.fecha_llegada ? 'complete' : 'current' },
    { label: 'Pedimento', date: hasPedimento ? trafico.fecha_llegada : null, status: hasPedimento ? 'complete' : (!trafico.fecha_llegada ? 'pending' : 'current') },
    { label: 'Pago', date: trafico.fecha_pago, status: hasPago ? 'complete' : (hasPedimento ? 'current' : 'pending') },
    { label: 'Cruzado', date: trafico.fecha_cruce, status: isCruzado ? 'complete' : (hasPago ? 'current' : 'pending') },
  ]

  // Ensure only one "current" — pick the first non-complete step
  let foundCurrent = false
  return steps.map(s => {
    if (s.status === 'current' && !foundCurrent) { foundCurrent = true; return s }
    if (s.status === 'current' && foundCurrent) return { ...s, status: 'pending' }
    return s
  })
}

export function StatusTimeline({ trafico }: { trafico: any }) {
  const steps = buildTimelineSteps(trafico)

  return (
    <div className="timeline">
      {steps.map((step, i) => (
        <div key={step.label} className={`timeline-step timeline-${step.status}`}>
          {i > 0 && (
            <div className={`timeline-line ${step.status === 'complete' ? 'timeline-line--filled' : ''}`} />
          )}
          <div className="timeline-dot">
            {step.status === 'complete' && <Check size={10} strokeWidth={3} style={{ color: 'white' }} />}
            {step.status === 'current' && <div className="timeline-pulse" />}
          </div>
          <div className="timeline-label">{step.label}</div>
          {step.date && <div className="timeline-date">{fmtDate(step.date)}</div>}
        </div>
      ))}
    </div>
  )
}
