/**
 * CRUZ Shared Truth Layer — Multi-Perspective Data Projection
 *
 * Same embarque, four views. Each perspective sees only what's
 * relevant to their role. The data is ONE source of truth;
 * the projection determines what each party sees.
 *
 * Broker: full operational visibility
 * Client: certainty-focused (confidence, status, value)
 * Supplier: document-focused (what's sent, what's missing)
 * Carrier: logistics-focused (pickup, transit, delivery)
 */

export type Perspective = 'broker' | 'client' | 'supplier' | 'carrier'

export interface TraficoView {
  trafico: string
  statusLabel: string
  statusColor: string
  fields: Record<string, unknown>
}

interface RawTrafico {
  trafico?: string
  estatus?: string | null
  importe_total?: number | null
  pedimento?: string | null
  proveedores?: string | null
  descripcion_mercancia?: string | null
  transportista_mexicano?: string | null
  transportista_extranjero?: string | null
  fecha_llegada?: string | null
  fecha_cruce?: string | null
  regimen?: string | null
  score_reasons?: string | null
  semaforo?: number | null
  [k: string]: unknown
}

// ── Status translation ──

function translateStatus(estatus: string, perspective: Perspective): { label: string; color: string } {
  const s = (estatus || '').toLowerCase()

  if (s.includes('cruz')) {
    return {
      broker: { label: 'Cruzado', color: '#16A34A' },
      client: { label: 'Cruzó ✅', color: '#16A34A' },
      supplier: { label: 'Entregado al destino', color: '#16A34A' },
      carrier: { label: 'Cruzado — libre', color: '#16A34A' },
    }[perspective]
  }

  if (s.includes('pagado')) {
    return {
      broker: { label: 'Pedimento Pagado', color: '#0D9488' },
      client: { label: 'Despacho en progreso', color: '#0D9488' },
      supplier: { label: 'Documentos completos', color: '#0D9488' },
      carrier: { label: 'Despacho aduanal', color: '#D97706' },
    }[perspective]
  }

  if (s.includes('rojo') || s.includes('reconocimiento')) {
    return {
      broker: { label: 'Semáforo Rojo', color: '#DC2626' },
      client: { label: 'En revisión', color: '#D97706' },
      supplier: { label: 'En revisión aduanal', color: '#D97706' },
      carrier: { label: 'Detenido en frontera', color: '#DC2626' },
    }[perspective]
  }

  // Default: En Proceso
  return {
    broker: { label: estatus || 'En Proceso', color: '#D97706' },
    client: { label: 'En proceso', color: '#D97706' },
    supplier: { label: 'Pendiente', color: '#D97706' },
    carrier: { label: 'En tránsito', color: '#2563EB' },
  }[perspective]
}

// ── Data projection ──

export function projectTrafico(raw: RawTrafico, perspective: Perspective): TraficoView {
  const { label, color } = translateStatus(raw.estatus || '', perspective)

  const base = {
    trafico: raw.trafico || '',
    statusLabel: label,
    statusColor: color,
  }

  switch (perspective) {
    case 'broker':
      return {
        ...base,
        fields: {
          importe_total: raw.importe_total,
          pedimento: raw.pedimento,
          proveedores: raw.proveedores,
          descripcion: raw.descripcion_mercancia,
          transportista: raw.transportista_mexicano || raw.transportista_extranjero,
          fecha_llegada: raw.fecha_llegada,
          fecha_cruce: raw.fecha_cruce,
          regimen: raw.regimen,
          score_reasons: raw.score_reasons,
          semaforo: raw.semaforo,
        },
      }

    case 'client':
      return {
        ...base,
        fields: {
          importe_total: raw.importe_total,
          pedimento: raw.pedimento,
          proveedores: raw.proveedores,
          descripcion: raw.descripcion_mercancia,
          transportista: raw.transportista_mexicano ? nameOnly(raw.transportista_mexicano) : undefined,
          fecha_llegada: raw.fecha_llegada,
          fecha_cruce: raw.fecha_cruce,
          regimen: raw.regimen,
          // No score_reasons, no semaforo, no compliance
        },
      }

    case 'supplier':
      return {
        ...base,
        fields: {
          descripcion: raw.descripcion_mercancia,
          fecha_llegada: raw.fecha_llegada,
          // No value, no pedimento, no carrier, no compliance
        },
      }

    case 'carrier':
      return {
        ...base,
        fields: {
          descripcion: raw.descripcion_mercancia ? cargoType(raw.descripcion_mercancia) : undefined,
          transportista: raw.transportista_mexicano || raw.transportista_extranjero,
          fecha_llegada: raw.fecha_llegada,
          fecha_cruce: raw.fecha_cruce,
          // No value, no pedimento, no supplier, no compliance
        },
      }
  }
}

// ── Timeline filter ──

interface TimelineEvent {
  type: string
  [k: string]: unknown
}

const TIMELINE_FILTERS: Record<Perspective, Set<string>> = {
  broker: new Set(), // empty = show all
  client: new Set(['status_changed', 'doc_uploaded', 'crossed', 'pedimento_paid', 'pedimento', 'cruce']),
  supplier: new Set(['doc_uploaded', 'doc_requested', 'doc_received', 'solicitud']),
  carrier: new Set(['pickup', 'in_transit', 'at_border', 'crossed', 'delivered', 'cruce', 'status_changed']),
}

export function filterTimeline(events: TimelineEvent[], perspective: Perspective): TimelineEvent[] {
  const allowed = TIMELINE_FILTERS[perspective]
  if (allowed.size === 0) return events // broker sees all
  return events.filter(e => allowed.has(e.type))
}

// ── Helpers ──

function nameOnly(raw: string): string {
  // Return just the company name, strip IDs or codes
  return raw.split(/[(\-#]/)[0].trim()
}

function cargoType(desc: string): string {
  // Simplify description for carrier: just the first 30 chars
  return desc.substring(0, 30).trim() + (desc.length > 30 ? '...' : '')
}
