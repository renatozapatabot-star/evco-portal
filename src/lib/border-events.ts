/**
 * CRUZ Border Event Tracking — 12 granular events
 *
 * More granular than any competitor (7 events typical).
 * Every border crossing broken into 12 discrete, timestamped events
 * logged to trafico_timeline for immutable audit trail.
 */

export interface BorderEvent {
  type: string
  label: string
  icon: string
  color: string
  bg: string
  sequence: number      // 1-12 ordering
  clientVisible: boolean // shown to clients on portal
  publicVisible: boolean // shown on public tracking link
}

/**
 * 12 border events — each maps to a trafico_timeline event_type.
 * Sequence determines display order in timeline.
 */
export const BORDER_EVENTS: BorderEvent[] = [
  {
    type: 'doc_received',
    label: 'Documentos recibidos',
    icon: '📥', color: '#0D9488', bg: 'rgba(13,148,136,0.12)',
    sequence: 1, clientVisible: true, publicVisible: true,
  },
  {
    type: 'customs_filed',
    label: 'Pedimento transmitido',
    icon: '📄', color: '#7E22CE', bg: 'rgba(126,34,206,0.12)',
    sequence: 2, clientVisible: true, publicVisible: true,
  },
  {
    type: 'customs_paid',
    label: 'Pedimento pagado',
    icon: '💳', color: '#7E22CE', bg: 'rgba(126,34,206,0.12)',
    sequence: 3, clientVisible: true, publicVisible: true,
  },
  {
    type: 'customs_cleared',
    label: 'Despacho autorizado',
    icon: '✅', color: '#16A34A', bg: 'rgba(22,163,74,0.12)',
    sequence: 4, clientVisible: true, publicVisible: true,
  },
  {
    type: 'exam_flagged',
    label: 'Semáforo rojo — reconocimiento',
    icon: '🔴', color: '#DC2626', bg: 'rgba(220,38,38,0.12)',
    sequence: 5, clientVisible: true, publicVisible: false,
  },
  {
    type: 'exam_cleared',
    label: 'Reconocimiento completado',
    icon: '🟢', color: '#16A34A', bg: 'rgba(22,163,74,0.12)',
    sequence: 6, clientVisible: true, publicVisible: false,
  },
  {
    type: 'bridge_assigned',
    label: 'Puente asignado',
    icon: '🌉', color: '#2563EB', bg: 'rgba(37,99,235,0.12)',
    sequence: 7, clientVisible: true, publicVisible: true,
  },
  {
    type: 'crossing_start',
    label: 'Cruce iniciado',
    icon: '🚛', color: '#D97706', bg: 'rgba(217,119,6,0.12)',
    sequence: 8, clientVisible: true, publicVisible: true,
  },
  {
    type: 'crossing_complete',
    label: 'Cruce completado',
    icon: '🏁', color: '#16A34A', bg: 'rgba(22,163,74,0.12)',
    sequence: 9, clientVisible: true, publicVisible: true,
  },
  {
    type: 'delivery_dispatched',
    label: 'En ruta a destino',
    icon: '🚚', color: '#2563EB', bg: 'rgba(37,99,235,0.12)',
    sequence: 10, clientVisible: true, publicVisible: true,
  },
  {
    type: 'delivery_confirmed',
    label: 'Entrega confirmada',
    icon: '📦', color: '#16A34A', bg: 'rgba(22,163,74,0.12)',
    sequence: 11, clientVisible: true, publicVisible: true,
  },
  {
    type: 'invoice_generated',
    label: 'Factura generada',
    icon: '🧾', color: '#8B6914', bg: 'rgba(196,150,60,0.12)',
    sequence: 12, clientVisible: true, publicVisible: false,
  },
]

/**
 * Event type → config lookup map for timeline rendering.
 * Merge with existing EVENT_CONFIG in tráfico detail page.
 */
export const BORDER_EVENT_MAP: Record<string, { icon: string; color: string; bg: string }> =
  Object.fromEntries(BORDER_EVENTS.map(e => [e.type, { icon: e.icon, color: e.color, bg: e.bg }]))

/**
 * Get border events visible to clients (for portal timeline).
 */
export function getClientBorderEvents(): BorderEvent[] {
  return BORDER_EVENTS.filter(e => e.clientVisible)
}

/**
 * Get border events visible on public tracking links.
 */
export function getPublicBorderEvents(): BorderEvent[] {
  return BORDER_EVENTS.filter(e => e.publicVisible)
}

/**
 * Map a raw estatus string to the highest completed border event sequence number.
 */
export function getCompletedSequence(estatus: string, hasPedimento: boolean, hasCruce: boolean): number {
  const s = (estatus || '').toLowerCase()

  if (s.includes('entreg')) return 11
  if (hasCruce || s.includes('cruz')) return 9
  if (s.includes('rojo') || s.includes('reconocimiento')) return 5
  if (s.includes('pagado')) return 3
  if (hasPedimento) return 2
  return 1 // at minimum, docs received if tráfico exists
}

/**
 * Build timeline steps for a tráfico with completed/current/pending states.
 */
export function buildBorderTimeline(
  estatus: string,
  hasPedimento: boolean,
  hasCruce: boolean,
  events: BorderEvent[] = BORDER_EVENTS,
): Array<BorderEvent & { state: 'completed' | 'current' | 'pending' }> {
  const completedSeq = getCompletedSequence(estatus, hasPedimento, hasCruce)

  return events.map(e => ({
    ...e,
    state: e.sequence < completedSeq ? 'completed' as const
      : e.sequence === completedSeq ? 'current' as const
      : 'pending' as const,
  }))
}
