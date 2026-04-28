/**
 * Cliente self-service dashboard queries.
 *
 * All functions scope by company_id (passed from the signed session — NEVER
 * derived from cookies or URL). RLS on the underlying tables is the hard
 * wall; these filters are defense-in-depth.
 *
 * Used by /inicio cliente tabs (Feature 11 / V1.5 F11).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// Keep the supabase client generic so both server and service clients work.
// The queries below only touch public schema columns that exist in all envs.
type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export type ClienteTraficoCard = {
  trafico: string
  estatus: string | null
  fecha_llegada: string | null
  pedimento: string | null
  proveedor: string | null
  last_event_type: string | null
  last_event_at: string | null
}

export type ClienteDocumento = {
  id: string
  trafico_id: string | null
  nombre: string | null
  doc_type: string | null
  file_url: string | null
  created_at: string | null
}

export type ClienteNotificacion = {
  id: string
  trafico_id: string | null
  event_type: string | null
  created_at: string | null
}

const ACTIVE_LIMIT = 50
const DOCS_LIMIT = 100
const NOTIF_LIMIT = 30

/**
 * Active embarques for the cliente, plus the most recent workflow event per row.
 *
 * Two-step batched fetch (N+1 avoided): pull embarques, then pull all events
 * for those trigger_ids in a single `in()` call.
 */
export async function getClienteActiveTraficos(
  supabase: AnyClient,
  companyId: string,
): Promise<ClienteTraficoCard[]> {
  if (!companyId) return []

  // "Active" = not closed. NULL estatus is treated as active (Postgres `NOT ILIKE` drops nulls silently).
  // traficos real column is `proveedores` (plural; text like "PRV_526" per trafico).
  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico, estatus, fecha_llegada, pedimento, proveedores')
    .eq('company_id', companyId)
    .or('estatus.is.null,estatus.not.ilike.%cerrado%')
    .order('fecha_llegada', { ascending: false, nullsFirst: false })
    .limit(ACTIVE_LIMIT)

  let rows = (traficos ?? []) as Array<Record<string, unknown>>

  // WHY: EVCO has seasonal quiet periods where every embarque really is closed.
  // The cockpit still needs to show life — fall back to the most recent 90 days
  // of embarques regardless of estatus so Mis Embarques Activos is never blank
  // for a client that has real history.
  if (rows.length === 0) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()
    const { data: recent } = await supabase
      .from('traficos')
      .select('trafico, estatus, fecha_llegada, pedimento, proveedores')
      .eq('company_id', companyId)
      .gte('fecha_llegada', ninetyDaysAgo)
      .order('fecha_llegada', { ascending: false, nullsFirst: false })
      .limit(ACTIVE_LIMIT)
    rows = (recent ?? []) as Array<Record<string, unknown>>
  }

  if (rows.length === 0) return []

  const refs = rows.map(r => String(r.trafico)).filter(Boolean)
  const eventsByRef = new Map<string, { event_type: string | null; created_at: string | null }>()

  if (refs.length > 0) {
    const { data: events } = await supabase
      .from('workflow_events')
      .select('trigger_id, event_type, created_at')
      .in('trigger_id', refs)
      .order('created_at', { ascending: false })
      .limit(500)

    for (const ev of (events ?? []) as Array<Record<string, unknown>>) {
      const key = String(ev.trigger_id)
      if (!eventsByRef.has(key)) {
        eventsByRef.set(key, {
          event_type: (ev.event_type as string) ?? null,
          created_at: (ev.created_at as string) ?? null,
        })
      }
    }
  }

  return rows.map(r => {
    const ref = String(r.trafico)
    const last = eventsByRef.get(ref)
    return {
      trafico: ref,
      estatus: (r.estatus as string) ?? null,
      fecha_llegada: (r.fecha_llegada as string) ?? null,
      pedimento: (r.pedimento as string) ?? null,
      // DB column is `proveedores` (plural, text); output field stays `proveedor` for UI back-compat.
      proveedor: (r.proveedores as string) ?? null,
      last_event_type: last?.event_type ?? null,
      last_event_at: last?.created_at ?? null,
    }
  })
}

/**
 * All documents across the cliente's embarques. Recent first, capped at 100.
 *
 * Scopes by joining through company_id — the expediente_documentos RLS policy
 * handles the hard wall, this filter is belt-and-suspenders.
 */
export async function getClienteDocuments(
  supabase: AnyClient,
  companyId: string,
): Promise<ClienteDocumento[]> {
  if (!companyId) return []

  // Pull cliente's embarque refs first (cheap, company_id indexed).
  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico')
    .eq('company_id', companyId)
    .order('fecha_llegada', { ascending: false, nullsFirst: false })
    .limit(200)

  const refs = ((traficos ?? []) as Array<Record<string, unknown>>)
    .map(r => String(r.trafico))
    .filter(Boolean)
  if (refs.length === 0) return []

  // expediente_documentos real columns: id, doc_type, file_name, file_url,
  // uploaded_at, pedimento_id (the trafico slug — confusing naming but the
  // actual link column). The ClienteDocumento output field names stay stable
  // for UI back-compat (trafico_id / nombre / created_at).
  const { data: docs } = await supabase
    .from('expediente_documentos')
    .select('id, pedimento_id, file_name, doc_type, file_url, uploaded_at')
    .in('pedimento_id', refs)
    .order('uploaded_at', { ascending: false, nullsFirst: false })
    .limit(DOCS_LIMIT)

  return ((docs ?? []) as Array<Record<string, unknown>>).map(d => ({
    id: String(d.id),
    trafico_id: (d.pedimento_id as string) ?? null,
    nombre: (d.file_name as string) ?? null,
    doc_type: (d.doc_type as string) ?? null,
    file_url: (d.file_url as string) ?? null,
    created_at: (d.uploaded_at as string) ?? null,
  }))
}

/**
 * Last 30 workflow events affecting the cliente's embarques, reverse chrono.
 */
export async function getClienteNotifications(
  supabase: AnyClient,
  companyId: string,
): Promise<ClienteNotificacion[]> {
  if (!companyId) return []

  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico')
    .eq('company_id', companyId)
    .order('fecha_llegada', { ascending: false, nullsFirst: false })
    .limit(200)

  const refs = ((traficos ?? []) as Array<Record<string, unknown>>)
    .map(r => String(r.trafico))
    .filter(Boolean)
  if (refs.length === 0) return []

  const { data: events } = await supabase
    .from('workflow_events')
    .select('id, trigger_id, event_type, created_at')
    .in('trigger_id', refs)
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(NOTIF_LIMIT)

  return ((events ?? []) as Array<Record<string, unknown>>).map(e => ({
    id: String(e.id),
    trafico_id: (e.trigger_id as string) ?? null,
    event_type: (e.event_type as string) ?? null,
    created_at: (e.created_at as string) ?? null,
  }))
}
