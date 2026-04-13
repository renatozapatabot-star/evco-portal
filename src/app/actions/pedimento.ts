'use server'

/**
 * AGUILA · Block 6a — Pedimento server actions.
 *
 * Every action: verifySession → company-scope check → mutation → sampled
 * decision log → return. Logging is sampled (≤1 per minute per pedimento)
 * to avoid flooding operational_decisions during heavy autosave traffic.
 */

import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import { validatePedimento as runValidation } from '@/lib/pedimento-validation'
import type {
  PedimentoRow,
  TabId,
  ValidationError,
  ChildTable,
  FullPedimento,
  DestinatarioRow,
  CompensacionRow,
  PagoVirtualRow,
  GuiaRow,
  TransportistaRow,
  CandadoRow,
  DescargaRow,
  CuentaGarantiaRow,
  ContribucionRow,
  PedimentoFacturaRow,
  PedimentoPartidaLite,
} from '@/lib/pedimento-types'

type ActionResult<T> = { data: T | null; error: { code: string; message: string } | null }

const CHILD_TABLES: readonly ChildTable[] = [
  'pedimento_destinatarios',
  'pedimento_compensaciones',
  'pedimento_pagos_virtuales',
  'pedimento_guias',
  'pedimento_transportistas',
  'pedimento_candados',
  'pedimento_descargas',
  'pedimento_cuentas_garantia',
  'pedimento_contribuciones',
  'pedimento_facturas',
]

// In-memory sampling map: last-logged timestamp per pedimento_id.
// Module scope persists per Node worker — acceptable for sampling heuristic.
const lastLoggedAt = new Map<string, number>()
const LOG_COOLDOWN_MS = 60_000

function shouldLog(pedimentoId: string): boolean {
  const prev = lastLoggedAt.get(pedimentoId) ?? 0
  const now = Date.now()
  if (now - prev < LOG_COOLDOWN_MS) return false
  lastLoggedAt.set(pedimentoId, now)
  return true
}

// Cronología sampling: one `pedimento_field_modified` per pedimento per actor
// per 5 minutes. Key format: `${pedimentoId}:${actor}`.
const lastEventAt = new Map<string, number>()
const EVENT_SAMPLE_MS = 5 * 60_000

function shouldFireFieldEvent(pedimentoId: string, actor: string): boolean {
  const key = `${pedimentoId}:${actor}`
  const prev = lastEventAt.get(key) ?? 0
  const now = Date.now()
  if (now - prev < EVENT_SAMPLE_MS) return false
  lastEventAt.set(key, now)
  return true
}

/** Significant fields that fire sampled `pedimento_field_modified` events. */
const SIGNIFICANT_FIELDS: ReadonlySet<string> = new Set([
  'pedimento_number',
  'regime_type',
  'document_type',
  'exchange_rate',
  'status',
])

async function getSession() {
  const cookieStore = await cookies()
  return verifySession(cookieStore.get('portal_session')?.value ?? '')
}

async function loadPedimentoForSession(
  pedimentoId: string,
): Promise<{ row: PedimentoRow; companyId: string } | null> {
  const session = await getSession()
  if (!session) return null
  const supabase = createServerClient()
  const { data } = await supabase
    .from('pedimentos')
    .select('*')
    .eq('id', pedimentoId)
    .maybeSingle<PedimentoRow>()
  if (!data) return null

  const isInternal = session.role === 'broker' || session.role === 'admin'
  if (!isInternal && data.company_id !== session.companyId) return null
  return { row: data, companyId: data.company_id }
}

export async function createPedimento(
  traficoId: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) return { data: null, error: { code: 'UNAUTHORIZED', message: 'No session' } }

  const supabase = createServerClient()
  const isInternal = session.role === 'broker' || session.role === 'admin'

  let traficoQ = supabase
    .from('traficos')
    .select('trafico, company_id')
    .eq('trafico', traficoId)
  if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)
  const { data: trafico } = await traficoQ.maybeSingle<{ trafico: string; company_id: string | null }>()
  if (!trafico || !trafico.company_id) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Embarque no encontrado' } }
  }

  const { data: existing } = await supabase
    .from('pedimentos')
    .select('id')
    .eq('trafico_id', traficoId)
    .eq('company_id', trafico.company_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>()
  if (existing) return { data: { id: existing.id }, error: null }

  const { data: created, error } = await supabase
    .from('pedimentos')
    .insert({
      trafico_id: traficoId,
      company_id: trafico.company_id,
      cliente_id: trafico.company_id,
    })
    .select('id')
    .single<{ id: string }>()

  if (error || !created) {
    return { data: null, error: { code: 'INSERT_ERROR', message: error?.message ?? 'Insert failed' } }
  }

  await logDecision({
    trafico: traficoId,
    company_id: trafico.company_id,
    decision_type: 'pedimento_created',
    decision: `Pedimento ${created.id} creado para embarque ${traficoId}`,
  })

  // Cronología — fire only on first creation (above short-circuit returns if existing)
  await supabase.from('workflow_events').insert({
    event_type: 'initial_pedimento_data_captured',
    workflow: 'pedimento',
    trigger_id: traficoId,
    company_id: trafico.company_id,
    payload: { pedimento_id: created.id, actor: `${session.companyId}:${session.role}` },
  })

  return { data: { id: created.id }, error: null }
}

export async function savePedimentoField(
  pedimentoId: string,
  tab: TabId,
  field: string,
  value: unknown,
): Promise<ActionResult<{ updated_at: string }>> {
  const loaded = await loadPedimentoForSession(pedimentoId)
  if (!loaded) return { data: null, error: { code: 'UNAUTHORIZED', message: 'No access' } }

  const supabase = createServerClient()
  const patch: Record<string, unknown> = { [field]: value, updated_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('pedimentos')
    .update(patch)
    .eq('id', pedimentoId)
    .select('updated_at')
    .single<{ updated_at: string }>()

  if (error || !data) {
    return { data: null, error: { code: 'UPDATE_ERROR', message: error?.message ?? 'Update failed' } }
  }

  if (shouldLog(pedimentoId)) {
    await logDecision({
      trafico: loaded.row.trafico_id,
      company_id: loaded.companyId,
      decision_type: 'pedimento_field_saved',
      decision: `Campo ${tab}.${field} actualizado`,
      dataPoints: { pedimento_id: pedimentoId, tab, field },
    })
  }

  // Cronología — sampled event for significant fields only
  if (SIGNIFICANT_FIELDS.has(field)) {
    const session = await getSession()
    const actor = session ? `${session.companyId}:${session.role}` : 'unknown:unknown'
    if (shouldFireFieldEvent(pedimentoId, actor)) {
      await supabase.from('workflow_events').insert({
        event_type: 'pedimento_field_modified',
        workflow: 'pedimento',
        trigger_id: loaded.row.trafico_id,
        company_id: loaded.companyId,
        payload: { pedimento_id: pedimentoId, tab, field, actor },
      })
    }
  }

  return { data: { updated_at: data.updated_at }, error: null }
}

export async function savePedimentoBatch(
  pedimentoId: string,
  tab: TabId,
  fields: Record<string, unknown>,
): Promise<ActionResult<{ updated_at: string }>> {
  const loaded = await loadPedimentoForSession(pedimentoId)
  if (!loaded) return { data: null, error: { code: 'UNAUTHORIZED', message: 'No access' } }
  if (Object.keys(fields).length === 0) {
    return { data: null, error: { code: 'VALIDATION_ERROR', message: 'Empty batch' } }
  }

  const supabase = createServerClient()
  const patch = { ...fields, updated_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('pedimentos')
    .update(patch)
    .eq('id', pedimentoId)
    .select('updated_at')
    .single<{ updated_at: string }>()

  if (error || !data) {
    return { data: null, error: { code: 'UPDATE_ERROR', message: error?.message ?? 'Update failed' } }
  }

  if (shouldLog(pedimentoId)) {
    await logDecision({
      trafico: loaded.row.trafico_id,
      company_id: loaded.companyId,
      decision_type: 'pedimento_batch_saved',
      decision: `Batch en ${tab} (${Object.keys(fields).length} campos)`,
      dataPoints: { pedimento_id: pedimentoId, tab, fields: Object.keys(fields) },
    })
  }

  return { data: { updated_at: data.updated_at }, error: null }
}

export async function addChildRow(
  pedimentoId: string,
  table: ChildTable,
  row: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const loaded = await loadPedimentoForSession(pedimentoId)
  if (!loaded) return { data: null, error: { code: 'UNAUTHORIZED', message: 'No access' } }
  if (!CHILD_TABLES.includes(table)) {
    return { data: null, error: { code: 'VALIDATION_ERROR', message: 'Unknown child table' } }
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from(table)
    .insert({ ...row, pedimento_id: pedimentoId })
    .select('id')
    .single<{ id: string }>()
  if (error || !data) {
    return { data: null, error: { code: 'INSERT_ERROR', message: error?.message ?? 'Insert failed' } }
  }
  return { data: { id: data.id }, error: null }
}

export async function updateChildRow(
  pedimentoId: string,
  table: ChildTable,
  rowId: string,
  fields: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const loaded = await loadPedimentoForSession(pedimentoId)
  if (!loaded) return { data: null, error: { code: 'UNAUTHORIZED', message: 'No access' } }
  if (!CHILD_TABLES.includes(table)) {
    return { data: null, error: { code: 'VALIDATION_ERROR', message: 'Unknown child table' } }
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from(table)
    .update(fields)
    .eq('id', rowId)
    .eq('pedimento_id', pedimentoId)
    .select('id')
    .single<{ id: string }>()
  if (error || !data) {
    return { data: null, error: { code: 'UPDATE_ERROR', message: error?.message ?? 'Update failed' } }
  }
  return { data: { id: data.id }, error: null }
}

export async function deleteChildRow(
  pedimentoId: string,
  table: ChildTable,
  rowId: string,
): Promise<ActionResult<{ id: string }>> {
  const loaded = await loadPedimentoForSession(pedimentoId)
  if (!loaded) return { data: null, error: { code: 'UNAUTHORIZED', message: 'No access' } }
  if (!CHILD_TABLES.includes(table)) {
    return { data: null, error: { code: 'VALIDATION_ERROR', message: 'Unknown child table' } }
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', rowId)
    .eq('pedimento_id', pedimentoId)
  if (error) {
    return { data: null, error: { code: 'DELETE_ERROR', message: error.message } }
  }
  return { data: { id: rowId }, error: null }
}

type LitePartidaRow = {
  cve_producto: string | null
  cve_cliente: string | null
  cantidad: number | null
  precio_unitario: number | null
  pais_origen: string | null
}
type LiteProductoRow = {
  cve_producto: string | null
  cve_cliente: string | null
  fraccion: string | null
}

async function loadPartidasForTrafico(traficoId: string): Promise<PedimentoPartidaLite[]> {
  const supabase = createServerClient()
  // globalpc_partidas has no cve_trafico / fraccion / valor_comercial columns —
  // the join chain is: facturas (by cve_trafico) → folios → partidas (by folio)
  // → productos (by cve_producto) for fraction, with valor computed from
  // cantidad * precio_unitario.
  const { data: facturas } = await supabase
    .from('globalpc_facturas')
    .select('folio')
    .eq('cve_trafico', traficoId)
    .limit(100)
  const folios = (facturas ?? [])
    .map((f: { folio: number | null }) => f.folio)
    .filter((f): f is number => f != null)
  if (folios.length === 0) return []

  const { data: rawPartidas } = await supabase
    .from('globalpc_partidas')
    .select('cve_producto, cve_cliente, cantidad, precio_unitario, pais_origen')
    .in('folio', folios)
    .limit(2000)
  const rows = (rawPartidas as LitePartidaRow[] | null) ?? []

  const cves = Array.from(new Set(rows.map(r => r.cve_producto).filter((c): c is string => !!c)))
  const fraccionMap = new Map<string, string>()
  if (cves.length > 0) {
    const { data: prods } = await supabase
      .from('globalpc_productos')
      .select('cve_producto, cve_cliente, fraccion')
      .in('cve_producto', cves)
      .limit(2000)
    for (const p of (prods as LiteProductoRow[] | null) ?? []) {
      fraccionMap.set(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`, p.fraccion ?? '')
    }
  }

  return rows.map(p => {
    const cantidad = Number(p.cantidad) || 0
    const precio = Number(p.precio_unitario) || 0
    return {
      fraccion: fraccionMap.get(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`) || null,
      cantidad: p.cantidad ?? null,
      pais_origen: p.pais_origen ?? null,
      valor_comercial: cantidad * precio,
    }
  })
}

export async function validatePedimento(
  pedimentoId: string,
): Promise<ActionResult<{ errors: ValidationError[]; errors_count: number; warnings_count: number; can_submit: boolean }>> {
  const loaded = await loadPedimentoForSession(pedimentoId)
  if (!loaded) return { data: null, error: { code: 'UNAUTHORIZED', message: 'No access' } }

  const supabase = createServerClient()
  const [
    destinatarios, compensaciones, pagos, guias, transportistas,
    candados, descargas, cuentas, contribuciones, facturas,
  ] = await Promise.all([
    supabase.from('pedimento_destinatarios').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_compensaciones').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_pagos_virtuales').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_guias').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_transportistas').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_candados').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_descargas').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_cuentas_garantia').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_contribuciones').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_facturas').select('*').eq('pedimento_id', pedimentoId),
  ])

  const partidas = await loadPartidasForTrafico(loaded.row.trafico_id)

  const full: FullPedimento = {
    parent: loaded.row,
    destinatarios: (destinatarios.data as DestinatarioRow[] | null) ?? [],
    compensaciones: (compensaciones.data as CompensacionRow[] | null) ?? [],
    pagos_virtuales: (pagos.data as PagoVirtualRow[] | null) ?? [],
    guias: (guias.data as GuiaRow[] | null) ?? [],
    transportistas: (transportistas.data as TransportistaRow[] | null) ?? [],
    candados: (candados.data as CandadoRow[] | null) ?? [],
    descargas: (descargas.data as DescargaRow[] | null) ?? [],
    cuentas_garantia: (cuentas.data as CuentaGarantiaRow[] | null) ?? [],
    contribuciones: (contribuciones.data as ContribucionRow[] | null) ?? [],
    facturas: (facturas.data as PedimentoFacturaRow[] | null) ?? [],
    partidas,
  }

  const errors = runValidation(full)
  const errors_count = errors.filter(e => e.severity === 'error').length
  const warnings_count = errors.filter(e => e.severity === 'warning').length

  return {
    data: { errors, errors_count, warnings_count, can_submit: errors_count === 0 },
    error: null,
  }
}

export async function linkPedimentoToTrafico(
  pedimentoId: string,
  traficoId: string,
): Promise<ActionResult<{ id: string }>> {
  const loaded = await loadPedimentoForSession(pedimentoId)
  if (!loaded) return { data: null, error: { code: 'UNAUTHORIZED', message: 'No access' } }

  const supabase = createServerClient()
  let traficoQ = supabase.from('traficos').select('trafico, company_id').eq('trafico', traficoId)
  const session = await getSession()
  if (!session) return { data: null, error: { code: 'UNAUTHORIZED', message: 'No session' } }
  const isInternal = session.role === 'broker' || session.role === 'admin'
  if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)
  const { data: trafico } = await traficoQ.maybeSingle<{ trafico: string; company_id: string | null }>()
  if (!trafico) return { data: null, error: { code: 'NOT_FOUND', message: 'Embarque no encontrado' } }

  const { error } = await supabase
    .from('pedimentos')
    .update({ trafico_id: traficoId, updated_at: new Date().toISOString() })
    .eq('id', pedimentoId)
  if (error) {
    return { data: null, error: { code: 'UPDATE_ERROR', message: error.message } }
  }
  return { data: { id: pedimentoId }, error: null }
}
