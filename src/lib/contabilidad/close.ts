/**
 * AGUILA · V1.5 F3 — Monthly close checklist helpers.
 *
 * Idempotent seed + single-item toggle. The 8 standard items are the
 * minimum Anabel verifies before calling a month closed for Patente 3596.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ChecklistItem {
  id: string
  company_id: string
  month: string // YYYY-MM-01
  item_key: string
  item_label: string
  is_done: boolean
  done_at: string | null
  done_by: string | null
  notes: string | null
  display_order: number
}

export interface ChecklistSeed {
  key: string
  label: string
  order: number
}

export const SEED_ITEMS: readonly ChecklistSeed[] = [
  { key: 'facturas_emitidas',              label: 'Facturas emitidas revisadas',    order: 10 },
  { key: 'conciliacion_bancaria',          label: 'Conciliación bancaria completa', order: 20 },
  { key: 'iva_calculado',                  label: 'IVA del mes calculado',          order: 30 },
  { key: 'nomina_pagada',                  label: 'Nómina pagada y registrada',     order: 40 },
  { key: 'anexo24_generado',               label: 'Anexo 24 generado',              order: 50 },
  { key: 'cuentas_por_cobrar_revisadas',   label: 'Cuentas por cobrar revisadas',   order: 60 },
  { key: 'cuentas_por_pagar_revisadas',    label: 'Cuentas por pagar revisadas',    order: 70 },
  { key: 'mve_sin_alertas_criticas',       label: 'MVE sin alertas críticas',       order: 80 },
] as const

/**
 * Returns 'YYYY-MM-01' for the month containing `date` (defaults to today).
 * Anchored to America/Chicago (Laredo).
 */
export function monthAnchor(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  return `${y}-${m}-01`
}

/**
 * Idempotent upsert of the 8 seed items for the given (company_id, month).
 * Returns the rows in display_order. Relies on the UNIQUE constraint to
 * avoid duplicates when called concurrently.
 */
export async function ensureMonthlyChecklist(
  supabase: SupabaseClient,
  companyId: string,
  month: string,
): Promise<ChecklistItem[]> {
  const existing = await supabase
    .from('monthly_close_checklist')
    .select('id, company_id, month, item_key, item_label, is_done, done_at, done_by, notes, display_order')
    .eq('company_id', companyId)
    .eq('month', month)

  const presentKeys = new Set(
    (existing.data ?? []).map((r) => (r as { item_key: string }).item_key),
  )
  const missing = SEED_ITEMS.filter(s => !presentKeys.has(s.key))

  if (missing.length > 0) {
    await supabase
      .from('monthly_close_checklist')
      .insert(missing.map(s => ({
        company_id: companyId,
        month,
        item_key: s.key,
        item_label: s.label,
        display_order: s.order,
        is_done: false,
      })))
      .select('id')
  }

  const { data } = await supabase
    .from('monthly_close_checklist')
    .select('id, company_id, month, item_key, item_label, is_done, done_at, done_by, notes, display_order')
    .eq('company_id', companyId)
    .eq('month', month)
    .order('display_order', { ascending: true })

  return (data ?? []) as ChecklistItem[]
}

/**
 * Flip `is_done` for a single checklist item. Stamps done_at / done_by when
 * transitioning to true, clears them when transitioning to false.
 */
export async function toggleChecklistItem(
  supabase: SupabaseClient,
  itemId: string,
  companyId: string,
  userId: string | null,
): Promise<ChecklistItem | null> {
  const { data: row } = await supabase
    .from('monthly_close_checklist')
    .select('is_done')
    .eq('id', itemId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!row) return null
  const nextDone = !(row as { is_done: boolean }).is_done

  const { data: updated } = await supabase
    .from('monthly_close_checklist')
    .update({
      is_done: nextDone,
      done_at: nextDone ? new Date().toISOString() : null,
      done_by: nextDone ? userId : null,
    })
    .eq('id', itemId)
    .eq('company_id', companyId)
    .select('id, company_id, month, item_key, item_label, is_done, done_at, done_by, notes, display_order')
    .maybeSingle()

  return (updated as ChecklistItem | null) ?? null
}
