import { daysUntilMVE } from '@/lib/compliance-dates'

export interface PriorityChip {
  label: string
  query: string
  urgency: 'critical' | 'warning' | 'info'
}

export function getMostActionableChips(state: {
  urgentCount: number
  pendingSolicitudes: number
  staleTraficos: number
  congestedBridge?: string
  congestedMinutes?: number
}): PriorityChip[] {
  const chips: PriorityChip[] = []
  const mveDays = daysUntilMVE()

  if (mveDays <= 1) {
    chips.push({ label: `MVE vence ${mveDays <= 0 ? 'HOY' : 'mañana'}`, query: '¿Qué necesito para cumplir con MVE antes del cierre?', urgency: 'critical' })
  }
  if (state.urgentCount > 0) {
    chips.push({ label: `${state.urgentCount} tráficos urgentes`, query: `Tengo ${state.urgentCount} tráficos urgentes. ¿Cuál es el más crítico y qué debo hacer primero?`, urgency: 'critical' })
  }
  if (state.pendingSolicitudes > 0) {
    chips.push({ label: `${state.pendingSolicitudes} solicitudes pendientes`, query: `Hay ${state.pendingSolicitudes} solicitudes de documentos sin respuesta. ¿Qué opciones tengo para acelerar?`, urgency: 'warning' })
  }
  if (state.congestedBridge && state.congestedMinutes && state.congestedMinutes > 90) {
    chips.push({ label: `${state.congestedBridge} congestionado`, query: `El puente ${state.congestedBridge} tiene ${state.congestedMinutes} minutos de espera. ¿Qué puente recomiendas?`, urgency: 'warning' })
  }
  if (state.staleTraficos > 0) {
    chips.push({ label: `${state.staleTraficos} sin movimiento`, query: `Tengo ${state.staleTraficos} tráficos sin movimiento por más de 14 días. ¿Qué opciones hay?`, urgency: 'warning' })
  }

  // Always include at least one general chip
  if (chips.length < 4) {
    chips.push({ label: 'Resumen del día', query: '¿Cuál es el resumen operativo de hoy?', urgency: 'info' })
  }
  if (chips.length < 4) {
    chips.push({ label: 'Clasifica un producto', query: 'Clasifica este producto para importación', urgency: 'info' })
  }

  return chips.slice(0, 4)
}
