'use client'

import { Shield, Clock, Brain } from 'lucide-react'

interface ValueSummaryProps {
  pedimentosThisMonth: number
  daysSinceRojo: number
  totalClassified: number
  totalTraficos: number
}

export function ValueSummary({ pedimentosThisMonth, daysSinceRojo, totalClassified, totalTraficos }: ValueSummaryProps) {
  const hoursSaved = Math.round(totalClassified * 3 / 60)

  return (
    <div className="cc-card" style={{
      padding: '14px 20px', borderRadius: 16, marginBottom: 12,
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Brain size={14} style={{ color: '#22D3EE', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>
          ADUANA trabaja para ti
        </span>
      </div>

      <div style={{ flex: 1, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
        {pedimentosThisMonth > 0 && (
          <span>
            <strong style={{ color: '#E6EDF3', fontFamily: 'var(--font-mono)' }}>{pedimentosThisMonth}</strong> pedimentos este mes
            <span style={{ margin: '0 8px', color: '#475569' }}>·</span>
          </span>
        )}
        {daysSinceRojo > 0 && (
          <span>
            <Shield size={12} style={{ display: 'inline', verticalAlign: 'middle', color: '#22D3EE', marginRight: 3 }} />
            <strong style={{ color: '#22D3EE', fontFamily: 'var(--font-mono)' }}>{daysSinceRojo}</strong> días sin inspección
            <span style={{ margin: '0 8px', color: '#475569' }}>·</span>
          </span>
        )}
        {hoursSaved > 0 && (
          <span>
            <Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', color: '#eab308', marginRight: 3 }} />
            Ahorro: <strong style={{ color: '#eab308', fontFamily: 'var(--font-mono)' }}>{hoursSaved}h</strong> de trabajo manual
          </span>
        )}
        {pedimentosThisMonth === 0 && daysSinceRojo === 0 && hoursSaved === 0 && (
          <span>
            <strong style={{ color: '#E6EDF3', fontFamily: 'var(--font-mono)' }}>{totalTraficos.toLocaleString()}</strong> operaciones gestionadas · sistema operativo
          </span>
        )}
      </div>
    </div>
  )
}
