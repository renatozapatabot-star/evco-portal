'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logOperatorAction } from '@/lib/operator-actions'
import type { ActionResult } from './types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface Operator {
  operatorId: string
  operatorName: string
  role: string
}

async function getOperator(): Promise<Operator | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value
  if (!token) return null
  const session = await verifySession(token)
  if (!session) return null
  if (!['admin', 'broker', 'operator'].includes(session.role)) return null
  const operatorId = cookieStore.get('operator_id')?.value || session.companyId
  const operatorName = cookieStore.get('operator_name')?.value || 'Operador'
  return { operatorId, operatorName, role: session.role }
}

interface ShadowLogInput {
  trafico: string
  companyId: string
  actionType: string
  decision: string
  reasoning: string
  before?: unknown
  after?: unknown
  targetEntity?: string
  aiPredictedValue?: string | null
}

async function shadowLog(op: Operator, input: ShadowLogInput): Promise<void> {
  const agreement = input.aiPredictedValue != null
    ? String(input.aiPredictedValue) === String(input.after ?? '')
    : null

  await supabase.from('operational_decisions').insert({
    trafico: input.trafico,
    company_id: input.companyId,
    decision_type: input.actionType,
    decision: input.decision,
    reasoning: input.reasoning,
    data_points_used: {
      operator_id: op.operatorId,
      operator_name: op.operatorName,
      action_type: input.actionType,
      target_entity: input.targetEntity || input.trafico,
      before: input.before ?? null,
      after: input.after ?? null,
      ai_predicted_value: input.aiPredictedValue ?? null,
      agreement,
      source: 'v1_workspace',
      timestamp: new Date().toISOString(),
    },
  })
}

export async function markEntradaReceived(
  traficoId: string,
  companyId: string,
): Promise<ActionResult> {
  const op = await getOperator()
  if (!op) return { success: false, error: 'No autorizado' }
  if (!traficoId) return { success: false, error: 'Tráfico requerido' }

  const { data: entradas, error: fetchErr } = await supabase
    .from('entradas')
    .select('cve_entrada, recibido_por')
    .eq('trafico', traficoId)
    .is('recibido_por', null)
    .limit(10)

  if (fetchErr) return { success: false, error: fetchErr.message }
  if (!entradas || entradas.length === 0) {
    return { success: false, error: 'Sin entradas pendientes en este tráfico' }
  }

  const ids = entradas.map(e => e.cve_entrada)
  const { error: updateErr } = await supabase
    .from('entradas')
    .update({ recibido_por: op.operatorName })
    .in('cve_entrada', ids)

  if (updateErr) return { success: false, error: updateErr.message }

  logOperatorAction({
    operatorId: op.operatorId,
    actionType: 'mark_entrada_received',
    targetTable: 'entradas',
    targetId: traficoId,
    companyId,
    payload: { count: ids.length, entradas: ids },
  })

  await shadowLog(op, {
    trafico: traficoId,
    companyId,
    actionType: 'manual_entrada_receipt',
    decision: `${ids.length} entrada(s) marcadas como recibidas`,
    reasoning: `Operador ${op.operatorName} confirmó recepción física de ${ids.length} entrada(s)`,
    targetEntity: traficoId,
    before: { recibido_por: null },
    after: { recibido_por: op.operatorName, count: ids.length },
  })

  revalidatePath('/operador/inicio')
  return { success: true }
}

export async function updateTraficoStatus(
  traficoId: string,
  companyId: string,
  currentStatus: string,
  nextStatus: string,
): Promise<ActionResult> {
  const op = await getOperator()
  if (!op) return { success: false, error: 'No autorizado' }
  if (!traficoId || !nextStatus) return { success: false, error: 'Parámetros inválidos' }
  if (currentStatus === nextStatus) return { success: false, error: 'Sin cambio de estado' }

  // Pull latest AI prediction for this trafico (if any) — for shadow comparison
  const { data: prediction } = await supabase
    .from('workflow_events')
    .select('payload')
    .eq('trigger_id', traficoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const aiPredicted = prediction?.payload
    ? (prediction.payload as Record<string, unknown>).predicted_status as string | undefined
    : undefined

  const { error: updateErr } = await supabase
    .from('traficos')
    .update({ estatus: nextStatus, updated_at: new Date().toISOString() })
    .eq('trafico', traficoId)

  if (updateErr) return { success: false, error: updateErr.message }

  logOperatorAction({
    operatorId: op.operatorId,
    actionType: 'update_trafico_status',
    targetTable: 'traficos',
    targetId: traficoId,
    companyId,
    payload: { from: currentStatus, to: nextStatus },
  })

  await shadowLog(op, {
    trafico: traficoId,
    companyId,
    actionType: 'manual_status_change',
    decision: `Estatus: ${currentStatus} → ${nextStatus}`,
    reasoning: `Operador ${op.operatorName} cambió estatus manualmente`,
    targetEntity: traficoId,
    before: currentStatus,
    after: nextStatus,
    aiPredictedValue: aiPredicted ?? null,
  })

  revalidatePath('/operador/inicio')
  return { success: true }
}

export async function sendQuickEmail(
  traficoId: string,
  companyId: string,
  template: 'docs_request' | 'status_update' | 'reminder',
): Promise<ActionResult> {
  const op = await getOperator()
  if (!op) return { success: false, error: 'No autorizado' }
  if (!traficoId) return { success: false, error: 'Tráfico requerido' }

  // V1: email is DRAFT-ONLY. Approval gate is absolute per CLAUDE.md.
  // We insert a pending workflow_event — the standard solicitation pipeline
  // handles draft → Telegram approval → send.
  const { error: insertErr } = await supabase
    .from('workflow_events')
    .insert({
      workflow: 'docs',
      event_type: 'manual_email_requested',
      trigger_id: traficoId,
      company_id: companyId,
      payload: {
        template,
        requested_by: op.operatorId,
        requested_by_name: op.operatorName,
        requested_at: new Date().toISOString(),
      },
      status: 'pending',
    })

  if (insertErr) return { success: false, error: insertErr.message }

  logOperatorAction({
    operatorId: op.operatorId,
    actionType: 'send_quick_email',
    targetTable: 'workflow_events',
    targetId: traficoId,
    companyId,
    payload: { template },
  })

  await shadowLog(op, {
    trafico: traficoId,
    companyId,
    actionType: 'manual_email_draft',
    decision: `Email encolado (plantilla: ${template})`,
    reasoning: `Operador ${op.operatorName} solicitó envío de email — requiere aprobación antes de salir`,
    targetEntity: traficoId,
    after: { template, status: 'pending_approval' },
  })

  revalidatePath('/operador/inicio')
  return { success: true }
}

export async function addDocument(
  traficoId: string,
  companyId: string,
  docType: string,
  fileName: string,
  fileUrl: string,
  fileSize: number,
): Promise<ActionResult> {
  const op = await getOperator()
  if (!op) return { success: false, error: 'No autorizado' }
  if (!traficoId || !fileUrl || !docType) return { success: false, error: 'Parámetros inválidos' }

  // Shadow: check what the classifier would have predicted for this filename
  const { data: autoClass } = await supabase
    .from('document_classifications')
    .select('doc_type')
    .eq('filename', fileName)
    .limit(1)
    .maybeSingle()

  const { error: insertErr } = await supabase
    .from('expediente_documentos')
    .insert({
      pedimento_id: traficoId,
      trafico_id: traficoId,
      doc_type: docType,
      nombre: fileName,
      file_url: fileUrl,
      file_size: fileSize,
      uploaded_by: op.operatorId,
      uploaded_at: new Date().toISOString(),
    })

  if (insertErr) return { success: false, error: insertErr.message }

  logOperatorAction({
    operatorId: op.operatorId,
    actionType: 'add_document',
    targetTable: 'expediente_documentos',
    targetId: traficoId,
    companyId,
    payload: { doc_type: docType, file_name: fileName },
  })

  await shadowLog(op, {
    trafico: traficoId,
    companyId,
    actionType: 'manual_document_upload',
    decision: `Documento cargado: ${docType}`,
    reasoning: `Operador ${op.operatorName} subió ${fileName}`,
    targetEntity: traficoId,
    after: { doc_type: docType, file_name: fileName },
    aiPredictedValue: autoClass?.doc_type ?? null,
  })

  revalidatePath('/operador/inicio')
  return { success: true }
}

export async function logTraficoView(traficoId: string): Promise<void> {
  const op = await getOperator()
  if (!op || !traficoId) return
  logOperatorAction({
    operatorId: op.operatorId,
    actionType: 'view_trafico',
    targetTable: 'traficos',
    targetId: traficoId,
  })
}
