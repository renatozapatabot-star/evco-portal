'use client'

import type { OperatorPerformance } from '../shared/computeOperatorPerformance'

interface Props extends OperatorPerformance {
  operatorName: string
}

export function PerformanceStrip({
  todayCount, yesterdayCount, weekCount, monthCount,
  personalRecord, currentStreak, teamRank, teamSize,
  operatorName,
}: Props) {
  const firstName = operatorName.split(' ')[0]
  const delta = todayCount - yesterdayCount
  const isRecord = todayCount > personalRecord && todayCount > 0

  // Next milestone
  const milestones = [5, 10, 25, 50, 100]
  const nextMilestone = milestones.find(m => m > todayCount) || todayCount + 25
  const prevMilestone = milestones.filter(m => m <= todayCount).pop() || 0
  const progress = nextMilestone > prevMilestone
    ? ((todayCount - prevMilestone) / (nextMilestone - prevMilestone)) * 100
    : 0

  return (
    <div style={{
      background: 'rgba(255,255,255,0.045)',
      borderRadius: 10,
      padding: '12px 16px',
      marginBottom: 12,
      border: isRecord ? '1px solid rgba(192,197,206,0.3)' : '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Top row: greeting + main KPIs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          {/* Today count */}
          <div>
            <span className="font-mono" style={{
              fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800,
              color: isRecord ? 'var(--portal-fg-1)' : todayCount > 0 ? 'var(--portal-fg-1)' : '#6E7681',
            }}>
              {todayCount}
            </span>
            <span style={{ fontSize: 'var(--aguila-fs-meta)', color: '#8B949E', marginLeft: 6 }}>
              acción{todayCount !== 1 ? 'es' : ''} hoy
            </span>
          </div>

          {/* Delta vs yesterday */}
          {yesterdayCount > 0 && (
            <span className="font-mono" style={{
              fontSize: 'var(--aguila-fs-section)', fontWeight: 600,
              color: delta >= 0 ? 'var(--portal-status-green-fg)' : 'var(--portal-status-red-fg)',
            }}>
              {delta >= 0 ? '↑' : '↓'}{Math.abs(delta)} vs ayer
            </span>
          )}

          {/* Record badge */}
          {isRecord && (
            <span style={{
              fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, color: 'var(--portal-fg-1)',
              background: 'rgba(192,197,206,0.15)',
              padding: '2px 8px', borderRadius: 4,
            }}>
              ★ Récord
            </span>
          )}
        </div>

        {/* Right: streak + rank */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {currentStreak > 1 && (
            <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-1)' }}>
              🔥 {currentStreak}d racha
            </span>
          )}
          <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body)', color: '#8B949E' }}>
            {teamRank}º de {teamSize}
          </span>
        </div>
      </div>

      {/* Progress bar to next milestone */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(progress, 100)}%`,
            height: '100%', borderRadius: 2,
            background: isRecord ? 'var(--portal-fg-1)' : 'var(--portal-status-green-fg)',
            transition: 'width 500ms ease',
          }} />
        </div>
        <span style={{ fontSize: 'var(--aguila-fs-label)', color: '#6E7681', flexShrink: 0 }}>
          meta: {nextMilestone}
        </span>
      </div>

      {/* Bottom: week + month */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', color: '#6E7681' }}>
          Semana: <span className="font-mono" style={{ color: '#8B949E', fontWeight: 600 }}>{weekCount}</span>
        </span>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', color: '#6E7681' }}>
          Mes: <span className="font-mono" style={{ color: '#8B949E', fontWeight: 600 }}>{monthCount}</span>
        </span>
      </div>
    </div>
  )
}
