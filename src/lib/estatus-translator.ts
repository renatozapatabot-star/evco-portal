/**
 * Maps GlobalPC / internal estatus codes to client-facing Spanish labels + tones.
 * Client portal must never render raw codes like "E1" — invariant #14
 * (client surfaces show certainty, not opaque jargon).
 *
 * Actual distinct values in production traficos (2026-04-16 audit):
 *   Cruzado, Pedimento Pagado, E1, En Proceso
 *
 * "Documentacion", "En Aduana" are pre-aligned with in-flight pipeline values;
 * "Entregado" follows the GlobalPC E1 convention (delivered to consignee).
 */

export type EstatusTone = 'positive' | 'in_flight' | 'neutral' | 'unknown'

export interface EstatusDisplay {
  label: string
  tone: EstatusTone
}

const MAP: Record<string, EstatusDisplay> = {
  'En Proceso':       { label: 'En proceso',      tone: 'in_flight' },
  'Documentacion':    { label: 'Documentación',   tone: 'in_flight' },
  'Documentación':    { label: 'Documentación',   tone: 'in_flight' },
  'En Aduana':        { label: 'En aduana',       tone: 'in_flight' },
  'Pedimento Pagado': { label: 'Pagado',          tone: 'positive'  },
  'Cruzado':          { label: 'Cruzó',           tone: 'positive'  },
  'E1':               { label: 'Entregado',       tone: 'positive'  },
  'Entregado':        { label: 'Entregado',       tone: 'positive'  },
}

export function translateEstatus(raw: string | null | undefined): EstatusDisplay {
  if (!raw) return { label: 'Sin estado', tone: 'unknown' }
  const hit = MAP[raw]
  if (hit) return hit
  return { label: raw, tone: 'unknown' }
}
