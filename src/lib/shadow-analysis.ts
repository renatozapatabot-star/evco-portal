/**
 * V1 Polish Pack · Block 12 — shadow/accuracy analysis.
 *
 * Joins `operational_decisions` rows by (trafico, decision_type) pair. When
 * multiple rows exist for the same pair with different `decision` values,
 * we count that as a disagreement event between the human-originated row
 * (reasoning present, longer) and the system-originated row (no reasoning
 * or short auto-generated reasoning).
 *
 * Caveat: `operational_decisions` does not yet carry an explicit
 * actor/source column. Until it does, this module infers human vs system
 * from the presence of reasoning text. Flagged in the audit as a known
 * assumption; when Renato adds an `actor text` column this module will
 * start using it cleanly.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ShadowByDay {
  date: string // YYYY-MM-DD
  agreed: number
  disagreed: number
}

export interface ShadowByAction {
  rate: number // 0..1
  n: number
}

export interface ShadowStats {
  totalCompared: number
  agreementRate: number // 0..1
  humanWinsWhenDisagree: number
  systemWinsWhenDisagree: number
  byAction: Record<string, ShadowByAction>
  byDay: ShadowByDay[]
  insufficient: boolean
  progress: number
}

interface DecisionRow {
  trafico: string | null
  decision_type: string
  decision: string
  reasoning: string | null
  created_at: string
  outcome: string | null
  was_optimal: boolean | null
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function isHumanSourced(row: DecisionRow): boolean {
  // Heuristic: human-authored rows typically carry reasoning text (>40 chars).
  // System-authored rows either omit reasoning or use short templates.
  const r = (row.reasoning ?? '').trim()
  return r.length >= 40
}

export async function computeAgreementStats(
  days: number,
  serviceClient: SupabaseClient,
): Promise<ShadowStats> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data, error } = await serviceClient
    .from('operational_decisions')
    .select('trafico, decision_type, decision, reasoning, created_at, outcome, was_optimal')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(5000)

  if (error || !data) {
    return {
      totalCompared: 0,
      agreementRate: 0,
      humanWinsWhenDisagree: 0,
      systemWinsWhenDisagree: 0,
      byAction: {},
      byDay: [],
      insufficient: true,
      progress: 0,
    }
  }

  const rows = data as DecisionRow[]

  // Group by (trafico, decision_type)
  const groups = new Map<string, DecisionRow[]>()
  for (const r of rows) {
    if (!r.trafico) continue
    const key = `${r.trafico}::${r.decision_type}`
    const arr = groups.get(key) ?? []
    arr.push(r)
    groups.set(key, arr)
  }

  let totalCompared = 0
  let agreed = 0
  let humanWins = 0
  let systemWins = 0
  const byActionAgreed: Record<string, number> = {}
  const byActionTotal: Record<string, number> = {}
  const byDayAgreed = new Map<string, number>()
  const byDayDisagreed = new Map<string, number>()

  for (const [, pair] of groups) {
    if (pair.length < 2) continue
    const human = pair.find(isHumanSourced)
    const system = pair.find((r) => !isHumanSourced(r))
    if (!human || !system) continue

    totalCompared += 1
    const action = human.decision_type
    byActionTotal[action] = (byActionTotal[action] ?? 0) + 1

    const day = dayKey(human.created_at)
    const didAgree = human.decision.trim().toLowerCase() === system.decision.trim().toLowerCase()
    if (didAgree) {
      agreed += 1
      byActionAgreed[action] = (byActionAgreed[action] ?? 0) + 1
      byDayAgreed.set(day, (byDayAgreed.get(day) ?? 0) + 1)
    } else {
      byDayDisagreed.set(day, (byDayDisagreed.get(day) ?? 0) + 1)
      // When disagreeing, `was_optimal` on each row tells us who was correct
      // (populated later when outcomes land). For now we split by whether
      // the human-side row carried `was_optimal=true`.
      if (human.was_optimal === true) humanWins += 1
      else if (system.was_optimal === true) systemWins += 1
    }
  }

  const byAction: Record<string, ShadowByAction> = {}
  for (const action of Object.keys(byActionTotal)) {
    const n = byActionTotal[action]
    const a = byActionAgreed[action] ?? 0
    byAction[action] = { rate: n > 0 ? a / n : 0, n }
  }

  // Build full daily series (no gaps) across requested window.
  const byDay: ShadowByDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    byDay.push({
      date: key,
      agreed: byDayAgreed.get(key) ?? 0,
      disagreed: byDayDisagreed.get(key) ?? 0,
    })
  }

  return {
    totalCompared,
    agreementRate: totalCompared > 0 ? agreed / totalCompared : 0,
    humanWinsWhenDisagree: humanWins,
    systemWinsWhenDisagree: systemWins,
    byAction,
    byDay,
    insufficient: totalCompared < 100,
    progress: totalCompared,
  }
}
