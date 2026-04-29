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

// CRUZ's scope ends at border crossing — we don't track delivery to the
// final consignee. All three terminal estatus values (GlobalPC's 'Cruzado',
// SAT's 'E1', and the manual 'Entregado') now render as the same single
// word "Cruzado" so the client never sees a list vs. detail mismatch
// where the same embarque appeared as "Cruzado" on one screen and
// "Entregado" on the next.
const MAP: Record<string, EstatusDisplay> = {
  'En Proceso':       { label: 'En proceso',      tone: 'in_flight' },
  'Documentacion':    { label: 'Documentación',   tone: 'in_flight' },
  'Documentación':    { label: 'Documentación',   tone: 'in_flight' },
  'En Aduana':        { label: 'En aduana',       tone: 'in_flight' },
  'Pedimento Pagado': { label: 'Pagado',          tone: 'positive'  },
  'Cruzado':          { label: 'Cruzado',         tone: 'positive'  },
  'E1':               { label: 'Cruzado',         tone: 'positive'  },
  // Defensive entries for E2/E3 — the JS-side translator
  // (scripts/lib/translate-estatus.js) declares all three E-codes in
  // RAW_DESPACHO_CODES as values that must not leak past sync. E2/E3
  // are not observed in production data today, but if either ever
  // reaches the cockpit (mis-merge in sync, manual import, etc.), the
  // user sees "En proceso" instead of raw "E2"/"E3". The drift fence
  // test in src/lib/__tests__/estatus-translator.drift.test.ts asserts
  // every RAW_DESPACHO_CODES entry has a TS-side mapping.
  'E2':               { label: 'En proceso',      tone: 'in_flight' },
  'E3':               { label: 'En proceso',      tone: 'in_flight' },
  'Entregado':        { label: 'Cruzado',         tone: 'positive'  },
}

export function translateEstatus(raw: string | null | undefined): EstatusDisplay {
  if (!raw) return { label: 'Sin estado', tone: 'unknown' }
  const hit = MAP[raw]
  if (hit) return hit
  return { label: raw, tone: 'unknown' }
}
