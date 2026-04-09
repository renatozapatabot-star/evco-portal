/**
 * Card urgency sorting for Command Center.
 * Pure function: KPI data → urgency level per card → sort order.
 */

export type Urgency = 'red' | 'amber' | 'green' | 'neutral'

export const URGENCY_SORT: Record<Urgency, number> = {
  red: 0,
  amber: 1,
  green: 2,
  neutral: 3,
}

export const URGENCY_COLORS: Record<Urgency, string> = {
  red: 'var(--danger-500, #DC2626)',
  amber: 'var(--warning-500, #D97706)',
  green: 'var(--success, #16A34A)',
  neutral: 'var(--text-muted, #9B9B9B)',
}

export interface CardKPIs {
  enProceso: number
  urgentes: number
  pendingEntradas: number
  docsFaltantes: number
}

export type CardKey = 'traficos' | 'entradas' | 'expedientes' | 'pedimentos' | 'contabilidad' | 'inventario' | 'reportes' | 'tipo_cambio' | 'ultimo_cruce' | 'docs_pendientes' | 'crossing_intelligence' | 'demand_forecast' | 'cost_optimizer' | 'dispatch_coordinator'

export function getCardUrgency(card: CardKey, data: CardKPIs): Urgency {
  switch (card) {
    case 'traficos':
      return data.urgentes > 0 ? 'red' : data.enProceso > 0 ? 'amber' : 'green'
    case 'entradas':
      return data.pendingEntradas > 0 ? 'amber' : 'green'
    case 'expedientes':
      return data.docsFaltantes > 0 ? 'amber' : 'green'
    case 'pedimentos':
      return 'green'
    case 'contabilidad':
      return 'green'
    case 'inventario':
      return 'neutral'
    case 'reportes':
      return 'neutral'
    case 'tipo_cambio':
      return 'neutral'
    case 'ultimo_cruce':
      return 'green'
    case 'docs_pendientes':
      return data.docsFaltantes > 0 ? 'amber' : 'green'
    case 'crossing_intelligence':
    case 'demand_forecast':
    case 'cost_optimizer':
    case 'dispatch_coordinator':
      return 'neutral'
  }
}

export function sortByUrgency<T extends { urgency: Urgency }>(cards: T[]): T[] {
  return [...cards].sort((a, b) => URGENCY_SORT[a.urgency] - URGENCY_SORT[b.urgency])
}

// ── Urgency Intensity — escalates with age ──
export type UrgencyIntensity = 'normal' | 'elevated' | 'critical' | 'overdue'

export function getUrgencyIntensity(urgency: Urgency, oldestUrgentDate: string | null): UrgencyIntensity {
  if (urgency !== 'red' && urgency !== 'amber') return 'normal'
  if (!oldestUrgentDate) return 'normal'
  const days = (Date.now() - new Date(oldestUrgentDate).getTime()) / 86400000
  if (urgency === 'red' && days > 5) return 'overdue'
  if (days > 3) return 'critical'
  if (days > 1) return 'elevated'
  return 'normal'
}

export const INTENSITY_CSS_CLASS: Record<UrgencyIntensity, string> = {
  normal: '',
  elevated: 'urgency-elevated',
  critical: 'urgency-critical',
  overdue: 'urgency-overdue',
}
