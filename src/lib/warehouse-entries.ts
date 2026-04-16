/**
 * CRUZ · Block 13 — Warehouse entries (Vicente's dock workflow).
 *
 * Pure logic + validation. Route handlers in src/app/api/warehouse/** call
 * these helpers. Cronología event `warehouse_entry_received` is already in
 * events_catalog (Block 1); Block 7's corridor-position maps it to
 * `rz_warehouse`, so pulses move automatically once a row lands.
 */

import { z } from 'zod'

export const WAREHOUSE_ENTRY_RECEIVED_EVENT = 'warehouse_entry_received' as const

export const WAREHOUSE_PHOTO_BUCKET = 'warehouse-photos' as const

export type WarehouseStatus = 'receiving' | 'staged' | 'released'

export const DOCK_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const
export type DockOption = (typeof DOCK_OPTIONS)[number]

const TRAILER_REGEX = /^[A-Z0-9][A-Z0-9\- ]{1,19}$/

// Zod schema the API route uses before any DB write happens.
export const RegisterWarehouseEntrySchema = z.object({
  trafico_id: z
    .string()
    .min(1, 'Embarque requerido')
    .max(64, 'Embarque demasiado largo'),
  trailer_number: z
    .string()
    .min(2, 'Número de caja requerido')
    .max(20, 'Número de caja demasiado largo')
    .transform((v) => v.trim().toUpperCase())
    .refine((v) => TRAILER_REGEX.test(v), {
      message: 'Formato de caja inválido (A-Z, 0-9, espacios, guiones)',
    }),
  dock_assigned: z
    .enum(DOCK_OPTIONS)
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  notes: z
    .string()
    .max(500, 'Notas demasiado largas')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  // Photos arrive as multipart; this schema handles the JSON fallback path.
  // We validate filenames only (actual upload goes through service-role client).
  photo_count: z.number().int().min(0).max(8).default(0),
})

export type RegisterWarehouseEntryInput = z.infer<
  typeof RegisterWarehouseEntrySchema
>

export interface PhotoPathInput {
  companyId: string
  traficoId: string
  entryId: string
  index: number
  extension: string
}

/**
 * Produce the canonical storage path for a warehouse photo.
 * `{company_id}/{trafico_id}/{entry_id}/{timestamp}_{index}.{ext}`
 *
 * Deterministic within a single call (caller passes a stable timestamp) so
 * tests can assert the shape without racing the clock.
 */
export function buildPhotoPath(input: PhotoPathInput, nowIso: string): string {
  const safeExt = input.extension.replace(/^\./, '').toLowerCase()
  const stamp = nowIso.replace(/[:.]/g, '-')
  return `${input.companyId}/${input.traficoId}/${input.entryId}/${stamp}_${input.index}.${safeExt}`
}

export interface CorridorEventPayload {
  trafico_id: string
  entry_id: string
  trailer_number: string
  dock_assigned: string | null
  photo_count: number
  actor: string
}

/**
 * Shape the `workflow_events` row the API route inserts. Keeps the route
 * handler thin and lets the tests assert the event type + payload shape.
 */
export function buildCorridorEvent(
  companyId: string,
  payload: CorridorEventPayload,
): {
  workflow: 'warehouse'
  event_type: typeof WAREHOUSE_ENTRY_RECEIVED_EVENT
  trigger_id: string
  company_id: string
  payload: CorridorEventPayload
} {
  return {
    workflow: 'warehouse',
    event_type: WAREHOUSE_ENTRY_RECEIVED_EVENT,
    trigger_id: payload.trafico_id,
    company_id: companyId,
    payload,
  }
}
