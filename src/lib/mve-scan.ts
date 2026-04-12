/**
 * AGUILA · Block 17 — MVE scan pure logic.
 *
 * Splits the scan into pure (testable) helpers + orchestration. Route handler
 * wires Supabase + Telegram around these.
 *
 * MVE deadline rule: 15 days after `pedimentos.created_at`. Status `cruzado`
 * excludes the pedimento from alerting. Severity:
 *   days_remaining > 7   → info
 *   3 <= days <= 7       → warning
 *   days < 3             → critical   (fires Telegram)
 */

export const MVE_WINDOW_DAYS = 15
export const MVE_LOOKAHEAD_DAYS = 7

export type Severity = 'info' | 'warning' | 'critical'

export interface PedimentoForScan {
  id: string
  trafico_id: string
  company_id: string
  pedimento_number: string | null
  status: string
  created_at: string
}

export interface AlertCandidate {
  pedimento_id: string
  trafico_id: string
  company_id: string
  severity: Severity
  deadline_at: string
  days_remaining: number
  message: string
}

export function computeDeadline(createdAtIso: string): Date {
  const created = new Date(createdAtIso)
  return new Date(created.getTime() + MVE_WINDOW_DAYS * 86_400_000)
}

export function computeDaysRemaining(deadline: Date, now: Date): number {
  const diffMs = deadline.getTime() - now.getTime()
  return Math.ceil(diffMs / 86_400_000)
}

export function computeSeverity(daysRemaining: number): Severity {
  if (daysRemaining < 3) return 'critical'
  if (daysRemaining <= 7) return 'warning'
  return 'info'
}

/**
 * True if the pedimento should be evaluated — not crossed, and deadline
 * within the lookahead window (< now + 7d).
 */
export function isApproachingDeadline(
  p: PedimentoForScan,
  now: Date,
): boolean {
  if (p.status === 'cruzado' || p.status === 'cancelado') return false
  const deadline = computeDeadline(p.created_at)
  const cutoff = new Date(now.getTime() + MVE_LOOKAHEAD_DAYS * 86_400_000)
  return deadline.getTime() < cutoff.getTime()
}

export function buildAlertCandidate(
  p: PedimentoForScan,
  now: Date,
): AlertCandidate {
  const deadline = computeDeadline(p.created_at)
  const daysRemaining = computeDaysRemaining(deadline, now)
  const severity = computeSeverity(daysRemaining)
  const ref = p.pedimento_number || p.trafico_id
  const message =
    severity === 'critical'
      ? `MVE crítica · ${ref} vence en ${daysRemaining}d`
      : severity === 'warning'
      ? `MVE próxima · ${ref} vence en ${daysRemaining}d`
      : `MVE en ventana · ${ref} vence en ${daysRemaining}d`
  return {
    pedimento_id: p.id,
    trafico_id: p.trafico_id,
    company_id: p.company_id,
    severity,
    deadline_at: deadline.toISOString(),
    days_remaining: daysRemaining,
    message,
  }
}

export function scanPedimentos(
  pedimentos: PedimentoForScan[],
  now: Date,
): AlertCandidate[] {
  const out: AlertCandidate[] = []
  for (const p of pedimentos) {
    if (!isApproachingDeadline(p, now)) continue
    out.push(buildAlertCandidate(p, now))
  }
  return out
}
