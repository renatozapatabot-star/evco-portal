/**
 * Cliente-friendly Spanish labels for workflow_events event types.
 *
 * The raw event catalog uses technical vocabulary (semaforo_verde,
 * warehouse_received, doda_generated...). These labels translate the top 15
 * kinds into copy a plant manager or logistics coordinator can read at a
 * glance, es-MX, no jargon.
 *
 * Unknown kinds fall back to a Title-Cased version of the raw event_type.
 */

export type ClienteEventLabel = {
  label: string
  /** Lucide icon name — resolved at render time to keep this a pure helper. */
  icon: 'truck' | 'file-text' | 'package' | 'check-circle' | 'alert-circle' | 'map-pin' | 'flag' | 'circle'
}

const LABELS: Record<string, ClienteEventLabel> = {
  // Crossing / semáforo
  semaforo_verde:         { label: 'Cruzaste la frontera — semáforo verde',      icon: 'check-circle' },
  semaforo_rojo:          { label: 'Revisión aduanal — semáforo rojo',           icon: 'alert-circle' },
  crossing_started:       { label: 'Iniciando cruce de frontera',                icon: 'map-pin' },
  crossed:                { label: 'Cruce completado',                           icon: 'check-circle' },

  // Warehouse
  warehouse_received:     { label: 'Recibido en bodega Laredo',                  icon: 'package' },
  warehouse_scanned:      { label: 'Mercancía escaneada en bodega',              icon: 'package' },
  yard_staged:            { label: 'En patio — listo para cruce',                icon: 'truck' },

  // Pedimento
  pedimento_drafted:      { label: 'Pedimento en preparación',                   icon: 'file-text' },
  pedimento_paid:         { label: 'Pedimento pagado',                           icon: 'check-circle' },
  pedimento_validated:    { label: 'Pedimento validado',                         icon: 'check-circle' },

  // Docs
  document_uploaded:      { label: 'Documento recibido',                         icon: 'file-text' },
  document_missing:       { label: 'Documento pendiente',                        icon: 'alert-circle' },
  classification_ready:   { label: 'Clasificación arancelaria lista',            icon: 'file-text' },

  // Lifecycle
  trafico_created:        { label: 'Operación registrada',                       icon: 'flag' },
  trafico_closed:         { label: 'Operación cerrada',                          icon: 'check-circle' },
}

function titleCase(raw: string): string {
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function getClienteEventLabel(eventType: string | null | undefined): ClienteEventLabel {
  if (!eventType) return { label: 'Evento', icon: 'circle' }
  const hit = LABELS[eventType]
  if (hit) return hit
  return { label: titleCase(eventType), icon: 'circle' }
}

export const CLIENTE_EVENT_LABELS = LABELS
