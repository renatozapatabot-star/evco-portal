/**
 * Feedback training loop for the 3 Killer Daily Driver Workflows.
 *
 * The detectors emit a base_confidence. The runner blends that with a
 * feedback prior so past 👍/👎 on similar findings actually tunes what
 * Ursula sees tomorrow.
 *
 * We compute the prior per (kind, signature-family) where the family is
 * the signature stripped of subject-specific ids. That way a 👎 on
 * `missing_nom:trafico:X:fraccion:3901.20.01` also dampens future
 * findings of the form `missing_nom:trafico:Y:fraccion:3901.20.01` —
 * the learning is about the *pattern*, not just the single shipment.
 *
 * The blend is Beta(α,β)-shaped but implemented with closed-form
 * counts so the training logic is auditable without a stats library.
 */

import type { WorkflowKind } from './types'

export interface FeedbackCounts {
  up: number
  down: number
}

export interface SignatureFeedback {
  kind: WorkflowKind
  family: string
  up: number
  down: number
}

/**
 * Strip the volatile parts of a signature so findings of the same
 * pattern-class collapse to one family key.
 *
 * Rules per kind (kept narrow + deterministic so tests can assert):
 *   · missing_nom           → keep the fraccion, drop the trafico id
 *   · high_value_risk       → keep the pattern name, drop ids
 *   · duplicate_shipment    → always the same family — pair-generic
 */
export function signatureFamily(kind: WorkflowKind, signature: string): string {
  const parts = signature.split(':')
  switch (kind) {
    case 'missing_nom': {
      // missing_nom:trafico:<id>:fraccion:<fraccion>
      const fraccionIdx = parts.indexOf('fraccion')
      if (fraccionIdx >= 0 && parts[fraccionIdx + 1]) {
        return `missing_nom:fraccion:${parts[fraccionIdx + 1]}`
      }
      return 'missing_nom:generic'
    }
    case 'high_value_risk': {
      // high_value_risk:<pattern>:...
      const pattern = parts[1] ?? 'generic'
      return `high_value_risk:${pattern}`
    }
    case 'duplicate_shipment': {
      // duplicate_shipment:pair:<a>:<b> — learn on the kind as a whole.
      return 'duplicate_shipment:pair'
    }
  }
}

/**
 * Blend a detector's base confidence with accumulated feedback. The
 * weight of the prior scales with the feedback volume so a single 👎
 * doesn't nuke a well-calibrated rule, but 10+ consistent 👎 moves the
 * needle decisively.
 *
 * Bounds: output clamped to [0.05, 0.99] so a suppressed finding is
 * still stored at shadow severity — Tito can always sweep the
 * dismissed pile for missed calls.
 */
export function blendConfidence(
  baseConfidence: number,
  counts: FeedbackCounts | null | undefined,
): number {
  const base = Math.max(0, Math.min(1, baseConfidence))
  if (!counts) return base
  const total = counts.up + counts.down
  if (total === 0) return base

  // Weight = total / (total + K). K=6 means the prior is worth ~6 votes;
  // matches the Block CC "three focused passes" heuristic — three 👍 and
  // three 👎 leave the base confidence essentially unchanged.
  const K = 6
  const weight = total / (total + K)
  const empirical = counts.up / total
  const blended = base * (1 - weight) + empirical * weight

  return Math.max(0.05, Math.min(0.99, blended))
}

/**
 * Aggregate feedback rows into the counts shape the runner consumes.
 * Split so tests can exercise the reducer without a Supabase fixture.
 */
export function aggregateFeedback(
  rows: ReadonlyArray<{ kind: WorkflowKind; signature: string; thumbs: 'up' | 'down' }>,
): Map<string, FeedbackCounts> {
  const out = new Map<string, FeedbackCounts>()
  for (const r of rows) {
    const family = signatureFamily(r.kind, r.signature)
    const entry = out.get(family) ?? { up: 0, down: 0 }
    if (r.thumbs === 'up') entry.up += 1
    else entry.down += 1
    out.set(family, entry)
  }
  return out
}
