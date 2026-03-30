'use client'
import { useState } from 'react'
import { ChevronDown, Truck, DollarSign, Clock, AlertTriangle } from 'lucide-react'
import { daysUntilMVE } from '@/lib/compliance-dates'

interface BriefingData {
  traficosYesterday: number
  weeklyAvg: number
  valueCrossed: number
  enProcesoCount: number
  mvePending: number
}

export function MorningBriefing({ data }: { data: BriefingData }) {
  const hour = new Date().getHours()
  const isAM = hour >= 6 && hour < 12
  const [expanded, setExpanded] = useState(isAM)
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const mveDays = daysUntilMVE()

  const trend = data.traficosYesterday > data.weeklyAvg ? 'arriba' : data.traficosYesterday < data.weeklyAvg ? 'abajo' : 'normal'

  return (
    <div className="briefing">
      <button className="briefing-header" onClick={() => setExpanded(!expanded)}>
        <div className="briefing-left">
          <span className="briefing-greeting">{greeting}, Renato</span>
          {!expanded && <span className="briefing-preview"> · {data.enProcesoCount} en proceso · MVE {mveDays}d</span>}
        </div>
        <ChevronDown size={16} style={{ color: 'var(--n-400)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease', flexShrink: 0 }} />
      </button>

      {expanded && (
        <div className="briefing-body">
          <div className="briefing-grid">
            <div className="briefing-item">
              <div className="briefing-item-icon"><Truck size={14} style={{ color: 'var(--gold-500)' }} /></div>
              <div>
                <div className="briefing-item-value">{data.traficosYesterday} tráficos ayer</div>
                <div className="briefing-item-context">{trend === 'arriba' ? '↑' : trend === 'abajo' ? '↓' : '→'} vs promedio semanal ({data.weeklyAvg})</div>
              </div>
            </div>
            <div className="briefing-item">
              <div className="briefing-item-icon"><DollarSign size={14} style={{ color: 'var(--success)' }} /></div>
              <div>
                <div className="briefing-item-value">${(data.valueCrossed / 1e6).toFixed(1)}M cruzado</div>
                <div className="briefing-item-context">Valor importado acumulado</div>
              </div>
            </div>
            <div className="briefing-item">
              <div className="briefing-item-icon"><Clock size={14} style={{ color: 'var(--warning)' }} /></div>
              <div>
                <div className="briefing-item-value">{data.enProcesoCount} en proceso</div>
                <div className="briefing-item-context">Pendientes de cruce</div>
              </div>
            </div>
            <div className="briefing-item">
              <div className="briefing-item-icon"><AlertTriangle size={14} style={{ color: mveDays <= 7 ? 'var(--danger)' : 'var(--warning)' }} /></div>
              <div>
                <div className="briefing-item-value">MVE: {mveDays}d restantes</div>
                <div className="briefing-item-context">{data.mvePending} tráficos sin folio</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
