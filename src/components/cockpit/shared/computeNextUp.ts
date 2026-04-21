import type { OperatorData } from './fetchCockpitData'

export interface NextUpCandidate {
  type: 'triage' | 'classification' | 'chase'
  trafico?: string
  company?: string
  description?: string
  urgencyReason: string
  actionLabel: string
  actionHref: string
  urgencyScore: number
}

function hoursSince(date: string | null): number {
  if (!date) return 0
  return (Date.now() - new Date(date).getTime()) / 3600000
}

/**
 * Compute the single most urgent next action for an operator.
 * Returns the highest-scoring candidate or null if nothing pending.
 */
export function computeNextUp(data: OperatorData): NextUpCandidate | null {
  const candidates: NextUpCandidate[] = []

  // Candidate 1: Next assigned trafico from existing nextUp
  if (data.nextUp) {
    const hoursOld = 0 // arrived_ago is pre-formatted, use suggestion confidence as proxy
    const confidence = data.nextUp.suggestion?.confidence ?? 100
    const hasMissingDocs = (data.nextUp.docs?.missing.length ?? 0) > 0

    candidates.push({
      type: 'triage',
      trafico: data.nextUp.trafico,
      company: data.nextUp.company,
      description: data.nextUp.description,
      urgencyReason: hasMissingDocs
        ? `Faltan ${data.nextUp.docs?.missing.length} documentos · ${data.nextUp.arrived_ago}`
        : confidence < 70
          ? `Clasificación con ${confidence}% confianza — revisar`
          : `Asignado · llegó hace ${data.nextUp.arrived_ago}`,
      actionLabel: hasMissingDocs ? 'Revisar documentos' : 'Continuar trabajo',
      actionHref: `/embarques/${encodeURIComponent(data.nextUp.trafico)}`,
      urgencyScore: hasMissingDocs ? 95 : confidence < 70 ? 90 : 70,
    })
  }

  // Candidate 2: Blocked traficos (high urgency — they're stuck)
  for (const b of data.blocked.slice(0, 2)) {
    candidates.push({
      type: 'chase',
      trafico: b.trafico,
      description: b.reason,
      urgencyReason: b.missingDocs.length > 0
        ? `Falta: ${b.missingDocs.slice(0, 3).join(', ')}`
        : b.reason,
      actionLabel: 'Resolver bloqueo',
      actionHref: `/embarques/${encodeURIComponent(b.trafico)}`,
      urgencyScore: 85,
    })
  }

  // Sort by urgency descending, return top 1
  candidates.sort((a, b) => b.urgencyScore - a.urgencyScore)
  return candidates[0] || null
}
