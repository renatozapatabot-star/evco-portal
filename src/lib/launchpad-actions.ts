import type { SupabaseClient } from '@supabase/supabase-js'
import { fmtDate } from '@/lib/format-utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LaunchpadAction {
  id: string
  rank: number
  source_table: string
  source_id: string
  title: string
  reason: string
  estimated_minutes: number
  href: string
  score: number
}

export interface CruzAutoAction {
  id: string
  description: string
  time_saved_minutes: number
  created_at: string
}

export interface LaunchpadData {
  actions: LaunchpadAction[]
  completed_count: number
  auto_actions: CruzAutoAction[]
  total_time_saved: number
}

// ---------------------------------------------------------------------------
// Workflow Detail Types (for inline panels)
// ---------------------------------------------------------------------------

export type WorkflowDetail =
  | ClasificacionDetail
  | BorradorDetail
  | LlamarDetail

export interface ClasificacionDetail {
  type: 'clasificacion'
  decision_id: string
  product_description: string
  suggested_classification: string
  confidence: number
  alternatives: { fraccion: string; description: string; confidence: number }[]
  filename?: string
}

export interface BorradorDetail {
  type: 'borrador'
  draft_id: string
  trafico_id: string | null
  supplier: string
  country: string
  confidence: number
  tier: number
  valor_total_usd: number
  regimen: string
  products_count: number
  invoice_number: string | null
}

export interface LlamarDetail {
  type: 'llamar'
  solicitud_id: string
  trafico_id: string
  doc_type: string
  doc_label: string
  supplier_name: string | null
  supplier_phone: string | null
  contact_name: string | null
  solicitado_at: string
  script: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIME_SAVED: Record<string, number> = {
  classification: 3,
  document_solicitation: 8,
  status_update: 2,
  email_response: 5,
  email_processed: 4,
  document_attached: 2,
}

const DEFAULT_TIME_SAVED = 3

const TIER_MINUTES: Record<number, number> = { 1: 2, 2: 5, 3: 10 }

// ---------------------------------------------------------------------------
// Today boundary in America/Chicago
// ---------------------------------------------------------------------------

function todayChicago(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

// ---------------------------------------------------------------------------
// Age helper — hours since a timestamp
// ---------------------------------------------------------------------------

function ageHours(ts: string | null): number {
  if (!ts) return 0
  return Math.max(0, (Date.now() - new Date(ts).getTime()) / 3_600_000)
}

// ---------------------------------------------------------------------------
// Scoring: query all sources + rank
// ---------------------------------------------------------------------------

interface RawCandidate {
  source_table: string
  source_id: string
  urgency: number
  impact: number
  estimated_minutes: number
  title: string
  reason: string
  href: string
}

function mapWorkflowEvent(row: Record<string, unknown>): RawCandidate {
  const age = ageHours(row.created_at as string)
  const eventType = (row.event_type as string) || 'evento'
  return {
    source_table: 'workflow_events',
    source_id: String(row.id),
    urgency: Math.min(age / 4, 10),
    impact: 7,
    estimated_minutes: 5,
    title: `Procesar evento: ${eventType}`,
    reason: `Pendiente desde ${fmtDate(row.created_at as string)}`,
    href: '/embarques',
  }
}

function mapAgentDecision(row: Record<string, unknown>): RawCandidate {
  const age = ageHours(row.created_at as string)
  const decision = (row.decision as string) || 'acción'
  const confidence = row.confidence as number | null
  return {
    source_table: 'agent_decisions',
    source_id: String(row.id),
    urgency: Math.min(age / 2, 10),
    impact: 8,
    estimated_minutes: 3,
    title: `Revisar decisión: ${decision}`,
    reason: confidence
      ? `ZAPATA AI sugirió con ${confidence}% confianza`
      : 'Requiere revisión humana',
    href: '/agente',
  }
}

function mapSolicitud(row: Record<string, unknown>): RawCandidate {
  const escalate = row.escalate_after as string | null
  const hoursPast = escalate
    ? Math.max(0, (Date.now() - new Date(escalate).getTime()) / 3_600_000)
    : 2
  const docType = (row.doc_type as string) || 'documento'
  const traficoId = (row.trafico_id as string) || ''
  return {
    source_table: 'documento_solicitudes',
    source_id: String(row.id),
    urgency: Math.min(hoursPast / 2, 10),
    impact: 6,
    estimated_minutes: 8,
    title: `Seguimiento: ${docType}`,
    reason: traficoId
      ? `Embarque ${traficoId} — solicitado ${fmtDate(row.solicitado_at as string)}, sin respuesta`
      : `Solicitado ${fmtDate(row.solicitado_at as string)}, sin respuesta`,
    href: traficoId ? `/embarques/${traficoId}` : '/expedientes',
  }
}

function mapDraft(row: Record<string, unknown>): RawCandidate {
  const tier = (row.escalation_level as number) || 2
  const draftData = (row.draft_data || {}) as Record<string, unknown>
  const confidence = draftData.confidence as number | null
  return {
    source_table: 'pedimento_drafts',
    source_id: String(row.id),
    urgency: 9,
    impact: 10,
    estimated_minutes: TIER_MINUTES[tier] || 5,
    title: 'Revisar borrador de pedimento',
    reason: confidence
      ? `Tier ${tier} — confianza ${confidence}%`
      : `Tier ${tier} — requiere revisión`,
    href: '/drafts',
  }
}

function mapMissingDoc(row: Record<string, unknown>): RawCandidate {
  const docType = (row.doc_type as string) || 'documento'
  const pedimentoId = (row.pedimento_id as string) || ''
  return {
    source_table: 'expediente_documentos',
    source_id: String(row.id),
    urgency: 4,
    impact: 5,
    estimated_minutes: 10,
    title: `Subir ${docType} faltante`,
    reason: pedimentoId
      ? `Expediente incompleto: ${pedimentoId}`
      : 'Expediente incompleto',
    href: '/expedientes',
  }
}

function scoreCandidate(c: RawCandidate): number {
  return c.urgency * c.impact * (1 / c.estimated_minutes)
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

export async function scoreLaunchpadActions(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ actions: LaunchpadAction[]; completed_count: number }> {
  const today = todayChicago()

  // Fetch all sources + today's completions in parallel
  const [wfRes, adRes, dsRes, pdRes, edRes, compRes] = await Promise.all([
    supabase
      .from('workflow_events')
      .select('id, workflow, event_type, trigger_id, created_at, payload')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20),
    supabase
      .from('agent_decisions')
      .select('id, trigger_type, decision, confidence, autonomy_level, created_at')
      .eq('company_id', companyId)
      .is('was_correct', null)
      .lte('autonomy_level', 1)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('documento_solicitudes')
      .select('id, trafico_id, doc_type, solicitado_at, solicitado_a, escalate_after')
      .eq('company_id', companyId)
      .eq('status', 'solicitado')
      .lt('escalate_after', new Date().toISOString())
      .order('escalate_after', { ascending: true })
      .limit(20),
    supabase
      .from('pedimento_drafts')
      .select('id, trafico_id, draft_data, status, escalation_level, created_at')
      .eq('company_id', companyId)
      .in('status', ['pending', 'approved_pending'])
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('expediente_documentos')
      .select('id, pedimento_id, doc_type, nombre')
      .eq('company_id', companyId)
      .is('file_url', null)
      .limit(20),
    supabase
      .from('launchpad_completions')
      .select('source_table, source_id, status')
      .eq('company_id', companyId)
      .eq('action_date', today),
  ])

  // Build exclusion set from today's completions
  const completions = compRes.data || []
  const excludeSet = new Set(
    completions.map((c) => `${c.source_table}:${c.source_id}`),
  )
  const completedCount = completions.filter(
    (c) => c.status === 'completed',
  ).length

  // Map all sources to candidates
  const candidates: RawCandidate[] = [
    ...(wfRes.data || []).map(mapWorkflowEvent),
    ...(adRes.data || []).map(mapAgentDecision),
    ...(dsRes.data || []).map(mapSolicitud),
    ...(pdRes.data || []).map(mapDraft),
    ...(edRes.data || []).map(mapMissingDoc),
  ]

  // Filter out completed/postponed, score, sort, take top 3
  const actions = candidates
    .filter((c) => !excludeSet.has(`${c.source_table}:${c.source_id}`))
    .map((c) => ({ ...c, score: scoreCandidate(c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c, i) => ({
      id: `${c.source_table}:${c.source_id}`,
      rank: i + 1,
      source_table: c.source_table,
      source_id: c.source_id,
      title: c.title,
      reason: c.reason,
      estimated_minutes: c.estimated_minutes,
      href: c.href,
      score: Math.round(c.score * 100) / 100,
    }))

  return { actions, completed_count: Math.min(completedCount, 3) }
}

// ---------------------------------------------------------------------------
// CRUZ auto-actions (what the agent did today autonomously)
// ---------------------------------------------------------------------------

export async function getCruzAutoActions(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ auto_actions: CruzAutoAction[]; total_time_saved: number }> {
  const today = todayChicago()
  const todayStart = `${today}T00:00:00-05:00`

  const { data } = await supabase
    .from('agent_decisions')
    .select('id, trigger_type, decision, action_taken, created_at')
    .eq('company_id', companyId)
    .gte('autonomy_level', 2)
    .gte('created_at', todayStart)
    .order('created_at', { ascending: false })
    .limit(50)

  const autoActions: CruzAutoAction[] = (data || []).map((row) => {
    const triggerType = (row.trigger_type as string) || ''
    const timeSaved = TIME_SAVED[triggerType] ?? DEFAULT_TIME_SAVED
    const description =
      (row.action_taken as string) ||
      (row.decision as string) ||
      'Acción automática'
    return {
      id: String(row.id),
      description,
      time_saved_minutes: timeSaved,
      created_at: row.created_at as string,
    }
  })

  const totalTimeSaved = autoActions.reduce(
    (sum, a) => sum + a.time_saved_minutes,
    0,
  )

  return { auto_actions: autoActions, total_time_saved: totalTimeSaved }
}

// ---------------------------------------------------------------------------
// Doc label mapping (shared with solicitar-documentos)
// ---------------------------------------------------------------------------

const DOC_LABELS: Record<string, string> = {
  FACTURA: 'Factura Comercial',
  'LISTA DE EMPAQUE': 'Lista de Empaque',
  PEDIMENTO: 'Pedimento Aduanal',
  'ACUSE DE COVE': 'Acuse de COVE',
  CARTA: 'Carta de Instrucciones',
  'QR DODA': 'QR DODA',
  CFDI: 'CFDI XML',
  'CARTA PORTE': 'Carta Porte',
  'CERTIFICADO USMCA': 'Certificado T-MEC/USMCA',
}

// ---------------------------------------------------------------------------
// Workflow detail fetchers (for inline panels)
// ---------------------------------------------------------------------------

async function getClasificacionDetail(
  supabase: SupabaseClient,
  companyId: string,
  sourceId: string,
): Promise<ClasificacionDetail | null> {
  const { data: row } = await supabase
    .from('agent_decisions')
    .select('id, trigger_type, trigger_id, decision, confidence, action_taken')
    .eq('id', sourceId)
    .eq('company_id', companyId)
    .single()

  if (!row) return null

  // Try to get filename from document_classifications
  let filename: string | undefined
  if (row.trigger_id) {
    const { data: doc } = await supabase
      .from('document_classifications')
      .select('filename, doc_type')
      .eq('id', row.trigger_id)
      .single()
    if (doc) filename = doc.filename
  }

  // Parse decision/action_taken for classification info
  const suggested = (row.action_taken as string) || (row.decision as string) || ''
  const confidence = (row.confidence as number) || 0

  return {
    type: 'clasificacion',
    decision_id: String(row.id),
    product_description: (row.decision as string) || 'Producto sin descripción',
    suggested_classification: suggested,
    confidence,
    alternatives: [],
    filename,
  }
}

async function getBorradorDetail(
  supabase: SupabaseClient,
  companyId: string,
  sourceId: string,
): Promise<BorradorDetail | null> {
  const { data: row } = await supabase
    .from('pedimento_drafts')
    .select('id, trafico_id, draft_data, escalation_level, status')
    .eq('id', sourceId)
    .eq('company_id', companyId)
    .single()

  if (!row) return null

  const dd = (row.draft_data || {}) as Record<string, unknown>
  const products = (dd.products as unknown[]) || []

  return {
    type: 'borrador',
    draft_id: String(row.id),
    trafico_id: (row.trafico_id as string) || null,
    supplier: (dd.supplier_name as string) || (dd.supplier as string) || 'Desconocido',
    country: (dd.country as string) || '—',
    confidence: (dd.confidence as number) || 0,
    tier: (row.escalation_level as number) || 2,
    valor_total_usd: (dd.valor_total_usd as number) || 0,
    regimen: (dd.regimen as string) || '—',
    products_count: products.length,
    invoice_number: (dd.invoice_number as string) || null,
  }
}

async function getLlamarDetail(
  supabase: SupabaseClient,
  companyId: string,
  sourceId: string,
): Promise<LlamarDetail | null> {
  const { data: row } = await supabase
    .from('documento_solicitudes')
    .select('id, trafico_id, doc_type, solicitado_at, solicitado_a')
    .eq('id', sourceId)
    .eq('company_id', companyId)
    .single()

  if (!row) return null

  const traficoId = (row.trafico_id as string) || ''
  const docType = (row.doc_type as string) || ''
  const docLabel = DOC_LABELS[docType] || docType

  // Try to find supplier contact info
  let supplierName: string | null = null
  let supplierPhone: string | null = null
  let contactName: string | null = null

  if (traficoId) {
    // Get supplier from traficos
    const { data: trafico } = await supabase
      .from('traficos')
      .select('proveedores')
      .eq('trafico', traficoId)
      .eq('company_id', companyId)
      .single()

    const proveedorCode = trafico?.proveedores as string | null
    if (proveedorCode) {
      // Try supplier_contacts first
      const { data: contact } = await supabase
        .from('supplier_contacts')
        .select('supplier_name, contact_name, contact_phone')
        .eq('proveedor', proveedorCode)
        .eq('company_id', companyId)
        .limit(1)
        .single()

      if (contact) {
        supplierName = contact.supplier_name || null
        contactName = contact.contact_name || null
        supplierPhone = contact.contact_phone || null
      }
    }
  }

  // Build call script
  const script = `Hola, soy de Renato Zapata, llamamos por el ${docLabel} pendiente del embarque ${traficoId}.`

  return {
    type: 'llamar',
    solicitud_id: String(row.id),
    trafico_id: traficoId,
    doc_type: docType,
    doc_label: docLabel,
    supplier_name: supplierName,
    supplier_phone: supplierPhone,
    contact_name: contactName,
    solicitado_at: (row.solicitado_at as string) || '',
    script,
  }
}

export async function getWorkflowDetail(
  supabase: SupabaseClient,
  companyId: string,
  sourceTable: string,
  sourceId: string,
): Promise<WorkflowDetail | null> {
  switch (sourceTable) {
    case 'agent_decisions':
      return getClasificacionDetail(supabase, companyId, sourceId)
    case 'pedimento_drafts':
      return getBorradorDetail(supabase, companyId, sourceId)
    case 'documento_solicitudes':
    case 'expediente_documentos':
      return getLlamarDetail(supabase, companyId, sourceId)
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Workflow completion (updates source + creates events)
// ---------------------------------------------------------------------------

interface CompletePayload {
  action_type: 'confirm' | 'correct' | 'approve' | 'reject' | 'call_done'
  corrected_to?: string
  correction_note?: string
}

export async function completeWorkflow(
  supabase: SupabaseClient,
  companyId: string,
  sourceTable: string,
  sourceId: string,
  payload: CompletePayload,
): Promise<{ success: boolean; error?: string }> {
  const today = todayChicago()

  // 1. Update source table
  if (sourceTable === 'agent_decisions') {
    const wasCorrect = payload.action_type === 'confirm'
    await supabase
      .from('agent_decisions')
      .update({
        was_correct: wasCorrect,
        corrected_by: 'operator',
        outcome: wasCorrect ? 'confirmed' : `corrected_to:${payload.corrected_to || ''}`,
      })
      .eq('id', sourceId)
      .eq('company_id', companyId)
  } else if (sourceTable === 'pedimento_drafts') {
    const status = payload.action_type === 'approve' ? 'approved' : 'rejected'
    await supabase
      .from('pedimento_drafts')
      .update({ status })
      .eq('id', sourceId)
      .eq('company_id', companyId)
  } else if (sourceTable === 'documento_solicitudes') {
    await supabase
      .from('documento_solicitudes')
      .update({
        status: 'llamado',
        llamado_at: new Date().toISOString(),
      })
      .eq('id', sourceId)
      .eq('company_id', companyId)
  }

  // 2. Mark completed in launchpad_completions
  await supabase.from('launchpad_completions').upsert(
    {
      company_id: companyId,
      action_date: today,
      source_table: sourceTable,
      source_id: sourceId,
      status: 'completed',
    },
    { onConflict: 'company_id,action_date,source_table,source_id' },
  )

  // 3. Emit workflow_event for agent learning
  const workflowMap: Record<string, string> = {
    agent_decisions: 'classify',
    pedimento_drafts: 'pedimento',
    documento_solicitudes: 'docs',
    expediente_documentos: 'docs',
  }

  await supabase.from('workflow_events').insert({
    workflow: workflowMap[sourceTable] || 'intake',
    event_type: 'human_review_completed',
    trigger_id: sourceId,
    company_id: companyId,
    payload: {
      source_table: sourceTable,
      action_type: payload.action_type,
      corrected_to: payload.corrected_to || null,
      correction_note: payload.correction_note || null,
    },
    status: 'completed',
    completed_at: new Date().toISOString(),
  })

  return { success: true }
}
