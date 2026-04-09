'use client'

interface Props {
  completedToday: number
  completedThisWeek: number
  completedThisMonth: number
}

export function PerformanceStrip({ completedToday, completedThisWeek, completedThisMonth }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 16, flexWrap: 'wrap',
      padding: '10px 16px', borderRadius: 8,
      background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.06)',
      marginBottom: 12,
    }}>
      <Stat value={completedToday} label="hoy" />
      <Stat value={completedThisWeek} label="esta semana" />
      <Stat value={completedThisMonth} label="este mes" />
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span className="font-mono" style={{
        fontSize: 18, fontWeight: 700,
        color: value > 0 ? '#C9A84C' : '#6E7681',
      }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: '#8B949E' }}>
        completado{value !== 1 ? 's' : ''} {label}
      </span>
    </div>
  )
}
