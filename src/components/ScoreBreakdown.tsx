'use client'

import { type ScoreBreakdownItem } from '@/lib/cruz-score'

interface Props {
  breakdown: {
    docs: ScoreBreakdownItem
    time: ScoreBreakdownItem
    payment: ScoreBreakdownItem
    pedimento: ScoreBreakdownItem
    compliance: ScoreBreakdownItem
  }
  score: number
}

export function ScoreBreakdown({ breakdown, score }: Props) {
  const items = [breakdown.docs, breakdown.time, breakdown.payment, breakdown.pedimento, breakdown.compliance]

  return (
    <div style={{ padding: '12px 0' }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ width: 90, fontSize: 12, fontWeight: 600, color: 'var(--n-600)' }}>{item.label}</span>
          <div style={{ flex: 1, height: 6, background: 'var(--n-100)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${item.score}%`, height: '100%', borderRadius: 3,
              background: item.score >= 80 ? 'var(--success)' : item.score >= 50 ? '#D4952A' : 'var(--danger-500)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{ width: 36, fontSize: 11, fontWeight: 700, textAlign: 'right', fontFamily: 'var(--font-mono)',
            color: item.score >= 80 ? 'var(--success)' : item.score >= 50 ? '#D4952A' : 'var(--danger-500)' }}>
            {item.score}
          </span>
          <span style={{ width: 32, fontSize: 10, color: 'var(--n-400)', textAlign: 'right' }}>
            {Math.round(item.weight * 100)}%
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: 'var(--b-default)', paddingTop: 8, marginTop: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--n-700)' }}>Total</span>
        <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'var(--font-mono)',
          color: score >= 80 ? 'var(--success)' : score >= 50 ? '#D4952A' : 'var(--danger-500)' }}>{score}/100</span>
      </div>
    </div>
  )
}
