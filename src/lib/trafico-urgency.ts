export type UrgencyClass = 'zombie' | 'stalled' | 'overdue' | 'active' | 'completed'

export interface UrgencyResult {
  class: UrgencyClass
  label: string
  color: string
  bgColor: string
  action: string | null
  days: number
}

export function getTraficoUrgency(t: {
  estatus: string
  fecha_llegada: string | null
  pedimento?: string | null
  doc_count?: number
}): UrgencyResult {
  if ((t.estatus || '').toLowerCase().includes('cruz')) {
    return { class: 'completed', label: 'Cruzado', color: 'var(--portal-status-green-fg)', bgColor: '#F0FDF4', action: null, days: 0 }
  }

  const days = t.fecha_llegada
    ? Math.floor((Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000) : 0

  if (days > 90) {
    const hasActivity = !!t.pedimento || (t.doc_count || 0) > 0
    return {
      class: hasActivity ? 'stalled' : 'zombie',
      label: hasActivity ? 'Estancado' : 'Abandonado',
      color: hasActivity ? '#991B1B' : 'var(--portal-fg-5)',
      bgColor: hasActivity ? 'var(--portal-status-red-bg)' : 'var(--portal-ink-2)',
      action: hasActivity ? 'Intervención inmediata' : 'Archivar — sin actividad 90+ días',
      days,
    }
  }

  if (days > 30) {
    return { class: 'stalled', label: 'Estancado', color: '#991B1B', bgColor: 'var(--portal-status-red-bg)',
      action: 'Seguimiento urgente', days }
  }

  if (days > 7) {
    return { class: 'overdue', label: 'Retrasado', color: 'var(--danger-500)', bgColor: 'var(--portal-status-red-bg)',
      action: 'Seguimiento necesario', days }
  }

  return { class: 'active', label: 'En Proceso', color: 'var(--portal-status-amber-fg)', bgColor: '#FFFBEB', action: null, days }
}

export function classifyAllTraficos<T extends { estatus: string; fecha_llegada: string | null; pedimento?: string | null }>(traficos: T[]) {
  return traficos.map(t => ({ ...t, urgency: getTraficoUrgency(t) }))
}
