import { createServerClient } from '@/lib/supabase-server'

export interface OperatorPerformance {
  todayCount: number
  yesterdayCount: number
  weekCount: number
  monthCount: number
  personalRecord: number
  currentStreak: number
  teamRank: number
  teamSize: number
}

export async function computeOperatorPerformance(operatorId: string): Promise<OperatorPerformance> {
  const sb = createServerClient()
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)

  const [todayR, yesterdayR, weekR, monthR, historyR, teamR] = await Promise.allSettled([
    sb.from('operator_actions').select('id', { count: 'exact', head: true })
      .eq('operator_id', operatorId).gte('created_at', todayStart.toISOString()),
    sb.from('operator_actions').select('id', { count: 'exact', head: true })
      .eq('operator_id', operatorId)
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', todayStart.toISOString()),
    sb.from('operator_actions').select('id', { count: 'exact', head: true })
      .eq('operator_id', operatorId).gte('created_at', weekStart.toISOString()),
    sb.from('operator_actions').select('id', { count: 'exact', head: true })
      .eq('operator_id', operatorId)
      .gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
    // History for record + streak
    sb.from('operator_actions').select('created_at')
      .eq('operator_id', operatorId)
      .gte('created_at', new Date(now.getTime() - 90 * 86400000).toISOString())
      .limit(2000),
    // Team ranking (today)
    sb.from('operator_actions').select('operator_id')
      .gte('created_at', todayStart.toISOString()).limit(2000),
  ])

  const todayCount = todayR.status === 'fulfilled' ? todayR.value.count ?? 0 : 0
  const yesterdayCount = yesterdayR.status === 'fulfilled' ? yesterdayR.value.count ?? 0 : 0
  const weekCount = weekR.status === 'fulfilled' ? weekR.value.count ?? 0 : 0
  const monthCount = monthR.status === 'fulfilled' ? monthR.value.count ?? 0 : 0

  // Personal record from daily aggregates
  const dailyCounts: Record<string, number> = {}
  if (historyR.status === 'fulfilled' && historyR.value.data) {
    for (const row of historyR.value.data) {
      const day = (row as Record<string, unknown>).created_at
      if (typeof day === 'string') {
        const key = day.split('T')[0]
        dailyCounts[key] = (dailyCounts[key] || 0) + 1
      }
    }
  }
  const personalRecord = Math.max(0, ...Object.values(dailyCounts))

  // Streak
  let currentStreak = 0
  const checkDate = new Date(todayStart)
  // Count today if any actions
  if (todayCount > 0) currentStreak = 1
  checkDate.setDate(checkDate.getDate() - 1)
  for (let i = 0; i < 90; i++) {
    const key = checkDate.toISOString().split('T')[0]
    if ((dailyCounts[key] || 0) > 0) {
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else break
  }

  // Team rank
  const teamCounts: Record<string, number> = {}
  if (teamR.status === 'fulfilled' && teamR.value.data) {
    for (const row of teamR.value.data) {
      const id = (row as Record<string, unknown>).operator_id as string
      teamCounts[id] = (teamCounts[id] || 0) + 1
    }
  }
  const sorted = Object.entries(teamCounts).sort((a, b) => b[1] - a[1])
  const teamRank = sorted.findIndex(([id]) => id === operatorId) + 1 || sorted.length + 1

  return {
    todayCount, yesterdayCount, weekCount, monthCount,
    personalRecord, currentStreak,
    teamRank, teamSize: Math.max(sorted.length, 1),
  }
}
