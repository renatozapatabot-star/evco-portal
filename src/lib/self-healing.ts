/**
 * CRUZ Self-Healing — Portal Types + Dashboard Helpers
 *
 * The system gets healthier over time.
 * Month 1: 10 manual interventions/week
 * Month 12: manual only for truly novel problems
 */

export interface HealingEvent {
  id: number
  detected_at: string
  issue_type: string
  severity: 'info' | 'warning' | 'critical'
  description: string | null
  action_taken: string | null
  healed: boolean
  heal_duration_ms: number | null
  manual_required: boolean
}

export interface HealingStats {
  eventsThisWeek: number
  autoResolved: number
  manualRequired: number
  uptimePercent: number
  meanHealTimeMs: number
  topIssues: Array<{ type: string; count: number }>
  trend: 'improving' | 'stable' | 'degrading'
}

export function computeHealingStats(events: HealingEvent[]): HealingStats {
  const total = events.length
  const autoResolved = events.filter(e => e.healed).length
  const manualRequired = events.filter(e => e.manual_required).length

  // Mean heal time (only healed events with duration)
  const healedWithTime = events.filter(e => e.healed && e.heal_duration_ms && e.heal_duration_ms > 0)
  const meanHealTimeMs = healedWithTime.length > 0
    ? Math.round(healedWithTime.reduce((s, e) => s + (e.heal_duration_ms || 0), 0) / healedWithTime.length)
    : 0

  // Uptime: % of checks that found no issues (approximate)
  // Assumes ~672 checks/week (every 15 min × 7 days)
  const checksPerWeek = 672
  const uptimePercent = total > 0
    ? Math.min(99.99, Math.round((1 - manualRequired / checksPerWeek) * 10000) / 100)
    : 99.99

  // Top issues by frequency
  const counts = new Map<string, number>()
  for (const e of events) {
    counts.set(e.issue_type, (counts.get(e.issue_type) || 0) + 1)
  }
  const topIssues = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }))

  // Trend: compare first half vs second half of events
  const mid = Math.floor(events.length / 2)
  const firstHalfManual = events.slice(0, mid).filter(e => e.manual_required).length
  const secondHalfManual = events.slice(mid).filter(e => e.manual_required).length
  const trend: HealingStats['trend'] = secondHalfManual < firstHalfManual ? 'improving'
    : secondHalfManual > firstHalfManual ? 'degrading' : 'stable'

  return {
    eventsThisWeek: total,
    autoResolved,
    manualRequired,
    uptimePercent,
    meanHealTimeMs,
    topIssues,
    trend,
  }
}

export function formatHealingSummary(stats: HealingStats): string {
  const parts: string[] = []
  parts.push(`${stats.eventsThisWeek} eventos esta semana`)
  parts.push(`${stats.autoResolved} auto-resueltos`)
  if (stats.manualRequired > 0) {
    parts.push(`${stats.manualRequired} requirieron intervención manual`)
  }
  parts.push(`Uptime: ${stats.uptimePercent}%`)
  if (stats.meanHealTimeMs > 0) {
    parts.push(`Tiempo promedio de auto-reparación: ${Math.round(stats.meanHealTimeMs / 1000)}s`)
  }
  const trendEmoji = stats.trend === 'improving' ? '📈' : stats.trend === 'degrading' ? '📉' : '➡️'
  parts.push(`${trendEmoji} Tendencia: ${stats.trend === 'improving' ? 'mejorando' : stats.trend === 'degrading' ? 'empeorando' : 'estable'}`)

  return parts.join(' · ')
}
