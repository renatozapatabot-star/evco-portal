/**
 * AGUILA · Warehouse Dock Tracker — data assembly.
 *
 * Joins warehouse_entries (dock receipt) with entradas (goods metadata)
 * in memory, since Supabase RLS on joined queries is unreliable.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type DockStatus = 'receiving' | 'staged' | 'released'

export interface WarehouseEntryRow {
  id: string
  trafico_id: string
  company_id: string
  trailer_number: string
  dock_assigned: string | null
  received_by: string
  received_at: string
  photo_urls: string[]
  notes: string | null
  status: DockStatus
  created_at: string
}

export interface EntradaRow {
  cve_entrada: string
  trafico: string | null
  cantidad_bultos: number | null
  peso_bruto: number | null
  tiene_faltantes: boolean | null
  mercancia_danada: boolean | null
}

export interface TrackerItem {
  entry: WarehouseEntryRow
  bultosTotal: number | null
  pesoTotal: number | null
  hasFaltantes: boolean
  hasDamage: boolean
  entradas: number
}

export interface TrackerData {
  items: TrackerItem[]
  totals: {
    receiving: number
    staged: number
    released: number
    today: number
    damaged: number
  }
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function loadTrackerData(
  sb: SupabaseClient,
  opts: { companyId?: string | null; limit?: number } = {},
): Promise<TrackerData> {
  const limit = opts.limit ?? 100

  let q = sb
    .from('warehouse_entries')
    .select('id, trafico_id, company_id, trailer_number, dock_assigned, received_by, received_at, photo_urls, notes, status, created_at')
    .order('received_at', { ascending: false })
    .limit(limit)

  if (opts.companyId) q = q.eq('company_id', opts.companyId)

  const { data } = await q
  const entries = (data ?? []) as WarehouseEntryRow[]

  const traficoIds = Array.from(new Set(entries.map(e => e.trafico_id).filter(Boolean)))
  let entradasByTrafico = new Map<string, EntradaRow[]>()

  if (traficoIds.length > 0) {
    const { data: entradasData } = await sb
      .from('entradas')
      .select('cve_entrada, trafico, cantidad_bultos, peso_bruto, tiene_faltantes, mercancia_danada')
      .in('trafico', traficoIds)
      .limit(500)

    entradasByTrafico = new Map()
    for (const row of (entradasData ?? []) as EntradaRow[]) {
      if (!row.trafico) continue
      if (!entradasByTrafico.has(row.trafico)) entradasByTrafico.set(row.trafico, [])
      entradasByTrafico.get(row.trafico)!.push(row)
    }
  }

  const items: TrackerItem[] = entries.map(entry => {
    const matched = entradasByTrafico.get(entry.trafico_id) ?? []
    const bultosTotal = matched.reduce<number | null>(
      (sum, e) => e.cantidad_bultos != null ? (sum ?? 0) + Number(e.cantidad_bultos) : sum,
      null,
    )
    const pesoTotal = matched.reduce<number | null>(
      (sum, e) => e.peso_bruto != null ? (sum ?? 0) + Number(e.peso_bruto) : sum,
      null,
    )
    return {
      entry,
      bultosTotal,
      pesoTotal,
      hasFaltantes: matched.some(e => e.tiene_faltantes === true),
      hasDamage: matched.some(e => e.mercancia_danada === true),
      entradas: matched.length,
    }
  })

  const todayIso = startOfTodayIso()
  const totals = {
    receiving: items.filter(i => i.entry.status === 'receiving').length,
    staged: items.filter(i => i.entry.status === 'staged').length,
    released: items.filter(i => i.entry.status === 'released').length,
    today: items.filter(i => i.entry.received_at >= todayIso).length,
    damaged: items.filter(i => i.hasDamage || i.hasFaltantes).length,
  }

  return { items, totals }
}

export function ageMinutes(receivedAtIso: string): number {
  return Math.max(0, Math.round((Date.now() - Date.parse(receivedAtIso)) / 60000))
}

export function formatAge(receivedAtIso: string): string {
  const mins = ageMinutes(receivedAtIso)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return `${hrs} h`
  const days = Math.floor(hrs / 24)
  return `${days} d`
}
