/**
 * CRUZ Operations Center — Role Config
 *
 * Block's insight: hierarchy exists because humans had to route
 * information. CRUZ routes information directly to whoever needs it.
 * Each staff member sees exactly what they need, nothing more.
 *
 * 3 people. 3 views. Same data.
 */

export type OpsRole = 'director' | 'classifier' | 'coordinator'

export interface StaffConfig {
  id: string
  name: string
  role: OpsRole
  title: string
  focus: string[]
}

export const STAFF: Record<string, StaffConfig> = {
  tito: {
    id: 'tito',
    name: 'Tito',
    role: 'director',
    title: 'Director General',
    focus: ['exceptions', 'clients_at_risk', 'savings', 'autonomy'],
  },
  juanjose: {
    id: 'juanjose',
    name: 'Juan José',
    role: 'classifier',
    title: 'Clasificador',
    focus: ['classifications', 'learning', 'accuracy'],
  },
  eloisa: {
    id: 'eloisa',
    name: 'Eloisa',
    role: 'coordinator',
    title: 'Coordinadora',
    focus: ['escalations', 'clients', 'emails', 'satisfaction'],
  },
}

export function getStaffConfig(staffId?: string | null): StaffConfig {
  if (staffId && STAFF[staffId]) return STAFF[staffId]
  return STAFF.tito // default to director view
}

// ── Metrics builder ──

export interface OpsMetrics {
  // Director
  exceptionsToday: number
  autoProcessedToday: number
  clientsAtRisk: Array<{ company_id: string; name: string; daysSinceActivity: number }>
  dailySavings: number
  autonomyLevels: Array<{ action: string; level: number; levelName: string }>

  // Classifier
  pendingClassifications: number
  accuracyCurrent: number
  correctionsThisWeek: number
  recentLearnings: Array<{ original: string; corrected: string; date: string }>

  // Coordinator
  pendingEscalations: number
  activeClients7d: number
  totalClients: number
  emailsProcessedToday: number
  inactiveClients: Array<{ company_id: string; name: string; daysSinceActivity: number }>
}

export function buildSummary(config: StaffConfig, metrics: OpsMetrics): string {
  switch (config.role) {
    case 'director': {
      const auto = metrics.autoProcessedToday
      const exc = metrics.exceptionsToday
      return `${exc} excepción${exc !== 1 ? 'es' : ''} hoy. ${auto} procesadas automáticamente.`
    }
    case 'classifier': {
      const pending = metrics.pendingClassifications
      return `${pending} clasificación${pending !== 1 ? 'es' : ''} necesita${pending !== 1 ? 'n' : ''} tu expertise.`
    }
    case 'coordinator': {
      const esc = metrics.pendingEscalations
      return `${esc} escalación${esc !== 1 ? 'es' : ''} pendiente${esc !== 1 ? 's' : ''}.`
    }
  }
}

export function buildSubtitle(config: StaffConfig, metrics: OpsMetrics): string {
  switch (config.role) {
    case 'director': {
      const risk = metrics.clientsAtRisk.length
      const parts: string[] = []
      if (risk > 0) parts.push(`${risk} cliente${risk !== 1 ? 's' : ''} necesita${risk !== 1 ? 'n' : ''} atención`)
      if (metrics.dailySavings >= 100) parts.push(`$${Math.round(metrics.dailySavings).toLocaleString()} USD ahorrados hoy`)
      return parts.length > 0 ? parts.join(' · ') : 'Todo bajo control.'
    }
    case 'classifier': {
      const acc = Math.round(metrics.accuracyCurrent)
      const corr = metrics.correctionsThisWeek
      return `Precisión: ${acc}% · ${corr} corrección${corr !== 1 ? 'es' : ''} esta semana`
    }
    case 'coordinator': {
      const active = metrics.activeClients7d
      const total = metrics.totalClients
      return `${active} de ${total} clientes activos esta semana · ${metrics.emailsProcessedToday} correos hoy`
    }
  }
}
