/**
 * ZAPATA AI · Block 14 — Yard / patio entries.
 *
 * Pure logic: validation (Zod), grid geometry (A1..Z9), waiting-time color
 * bucketing, workflow_events shaping. Route handlers in
 * src/app/api/yard/** call these helpers. Visual surface at /bodega/patio.
 */

import { z } from 'zod'

export const YARD_ENTERED_EVENT = 'yard_entered' as const
export const YARD_EXITED_EVENT = 'yard_exited' as const

export type YardEventType = typeof YARD_ENTERED_EVENT | typeof YARD_EXITED_EVENT

// Grid geometry — A1..Z9 (26 cols × 9 rows).
export const GRID_COLUMNS = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
] as const
export type GridColumn = (typeof GRID_COLUMNS)[number]

export const GRID_ROWS = [1,2,3,4,5,6,7,8,9] as const
export type GridRow = (typeof GRID_ROWS)[number]

const YARD_POSITION_REGEX = /^[A-Z][1-9]$/
const TRAILER_REGEX = /^[A-Z0-9][A-Z0-9\- ]{1,19}$/

// Waiting-time thresholds (ms).
export const WAIT_BUCKET_GOLD_MS = 2 * 60 * 60 * 1000 // 2h
export const WAIT_BUCKET_RED_MS = 6 * 60 * 60 * 1000 // 6h

export type WaitBucket = 'silver' | 'gold' | 'red'

/**
 * Map a waiting duration (ms) to the ZAPATA AI color bucket.
 *  - silver:  < 2h
 *  - gold:    2h – 6h
 *  - red:     > 6h
 */
export function waitBucket(elapsedMs: number): WaitBucket {
  if (elapsedMs < WAIT_BUCKET_GOLD_MS) return 'silver'
  if (elapsedMs < WAIT_BUCKET_RED_MS) return 'gold'
  return 'red'
}

export function waitBucketFromDates(
  enteredAt: string | Date,
  now: Date = new Date(),
): WaitBucket {
  const t = typeof enteredAt === 'string' ? new Date(enteredAt).getTime() : enteredAt.getTime()
  return waitBucket(now.getTime() - t)
}

// ── Zod schemas ─────────────────────────────────────────────────────────────

export const RegisterYardEntrySchema = z
  .object({
    trafico_id: z
      .string()
      .min(1, 'Embarque requerido')
      .max(64, 'Embarque demasiado largo')
      .transform((v) => v.trim()),
    trailer_number: z
      .string()
      .min(2, 'Número de caja requerido')
      .max(20, 'Número de caja demasiado largo')
      .transform((v) => v.trim().toUpperCase())
      .refine((v) => TRAILER_REGEX.test(v), {
        message: 'Formato de caja inválido (A-Z, 0-9, espacios, guiones)',
      }),
    yard_position: z
      .string()
      .transform((v) => v.trim().toUpperCase())
      .refine((v) => YARD_POSITION_REGEX.test(v), {
        message: 'Posición inválida — usa A1 a Z9',
      }),
    refrigerated: z.boolean().default(false),
    temperature_setting: z
      .number()
      .min(-40, 'Temperatura fuera de rango')
      .max(40, 'Temperatura fuera de rango')
      .optional()
      .nullable()
      .transform((v) => (v === undefined ? null : v)),
  })
  .superRefine((val, ctx) => {
    if (val.refrigerated && (val.temperature_setting === null || val.temperature_setting === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['temperature_setting'],
        message: 'Captura la temperatura cuando la caja es refrigerada',
      })
    }
    if (!val.refrigerated && val.temperature_setting !== null && val.temperature_setting !== undefined) {
      // Force null when not refrigerated — avoid stale values.
      val.temperature_setting = null
    }
  })

export type RegisterYardEntryInput = z.infer<typeof RegisterYardEntrySchema>

// ── Grid keyboard navigation (pure function) ────────────────────────────────

export interface GridCell {
  col: GridColumn
  row: GridRow
}

export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

export function parsePosition(position: string): GridCell | null {
  const up = position.trim().toUpperCase()
  if (!YARD_POSITION_REGEX.test(up)) return null
  return {
    col: up[0] as GridColumn,
    row: Number(up[1]) as GridRow,
  }
}

export function formatPosition(cell: GridCell): string {
  return `${cell.col}${cell.row}`
}

/**
 * Move a cell by one step. Clamped at grid edges (no wraparound — keeps the
 * surface predictable when the operator's thumb is on the phone).
 */
export function moveCell(current: GridCell, key: ArrowKey): GridCell {
  const colIdx = GRID_COLUMNS.indexOf(current.col)
  const rowIdx = GRID_ROWS.indexOf(current.row)
  switch (key) {
    case 'ArrowLeft':
      return { col: GRID_COLUMNS[Math.max(0, colIdx - 1)], row: current.row }
    case 'ArrowRight':
      return { col: GRID_COLUMNS[Math.min(GRID_COLUMNS.length - 1, colIdx + 1)], row: current.row }
    case 'ArrowUp':
      return { col: current.col, row: GRID_ROWS[Math.max(0, rowIdx - 1)] }
    case 'ArrowDown':
      return { col: current.col, row: GRID_ROWS[Math.min(GRID_ROWS.length - 1, rowIdx + 1)] }
  }
}

// ── Workflow events shaping ─────────────────────────────────────────────────

export interface YardEventPayload {
  trafico_id: string
  entry_id: string
  trailer_number: string
  yard_position: string
  refrigerated: boolean
  temperature_setting: number | null
  actor: string
}

export function buildYardEvent(
  companyId: string,
  eventType: YardEventType,
  payload: YardEventPayload,
): {
  workflow: 'warehouse'
  event_type: YardEventType
  trigger_id: string
  company_id: string
  payload: YardEventPayload
} {
  return {
    workflow: 'warehouse',
    event_type: eventType,
    trigger_id: payload.trafico_id,
    company_id: companyId,
    payload,
  }
}
