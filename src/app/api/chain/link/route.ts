/**
 * POST /api/chain/link
 *
 * Wires a missing chain node onto a tráfico. Supports four node kinds; each
 * maps to a different FK update path because the underlying tables pre-date
 * a unified chain model.
 *
 * Body:
 *   { trafico_id: string, node_type: 'factura'|'entrada'|'pedimento'|'expediente',
 *     target_id: string }
 *
 * Returns: { success: true, node_type, target_id, trafico_id } on success.
 *
 * Tenant scope: every lookup joins via company_id so operators can't cross
 * clients and clients can't touch another tenant's data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logOperatorAction } from '@/lib/operator-actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const INTERNAL_ROLES = new Set(['operator', 'admin', 'broker', 'contabilidad'])

const BodySchema = z.object({
  trafico_id: z.string().min(1).max(128),
  node_type: z.enum(['factura', 'entrada', 'pedimento', 'expediente']),
  target_id: z.string().min(1).max(128),
})

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value ?? '')
  if (!session) return err('UNAUTHORIZED', 'Sesión inválida', 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('VALIDATION_ERROR', 'JSON inválido', 400)
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join('; '), 400)
  }
  const { trafico_id, node_type, target_id } = parsed.data

  // Confirm caller can touch this tráfico.
  const { data: trafRow, error: trafErr } = await supabase
    .from('traficos')
    .select('trafico, company_id, pedimento')
    .eq('trafico', trafico_id)
    .maybeSingle()
  if (trafErr) return err('DB_ERROR', trafErr.message, 500)
  if (!trafRow) return err('NOT_FOUND', 'Embarque no encontrado', 404)

  const traficoCompanyId = (trafRow as { company_id: string | null }).company_id
  if (session.role === 'client' && traficoCompanyId !== session.companyId) {
    return err('FORBIDDEN', 'Embarque de otro cliente', 403)
  }
  if (session.role !== 'client' && !INTERNAL_ROLES.has(session.role)) {
    return err('FORBIDDEN', 'Rol sin permiso para vincular', 403)
  }

  let linkedDescription = ''

  if (node_type === 'factura') {
    const { data: fac, error: facErr } = await supabase
      .from('pedimento_facturas')
      .select('id, company_id, status, invoice_number')
      .eq('id', target_id)
      .maybeSingle()
    if (facErr) return err('DB_ERROR', facErr.message, 500)
    if (!fac) return err('NOT_FOUND', 'Factura no encontrada en el banco', 404)
    const facRow = fac as { id: string; company_id: string | null; status: string; invoice_number: string | null }
    if (facRow.company_id !== traficoCompanyId) {
      return err('VALIDATION_ERROR', 'Factura pertenece a otro cliente', 400)
    }
    if (facRow.status === 'archived') {
      return err('VALIDATION_ERROR', 'Factura archivada — no se puede vincular', 400)
    }
    const { error: updErr } = await supabase
      .from('pedimento_facturas')
      .update({
        status: 'assigned',
        assigned_to_trafico_id: trafico_id,
        assigned_at: new Date().toISOString(),
      })
      .eq('id', target_id)
    if (updErr) return err('DB_ERROR', updErr.message, 500)
    linkedDescription = `factura ${facRow.invoice_number ?? target_id} → ${trafico_id}`
  } else if (node_type === 'entrada') {
    const { data: ent, error: entErr } = await supabase
      .from('entradas')
      .select('cve_entrada, company_id, trafico')
      .eq('cve_entrada', target_id)
      .maybeSingle()
    if (entErr) return err('DB_ERROR', entErr.message, 500)
    if (!ent) return err('NOT_FOUND', 'Entrada no encontrada', 404)
    const entRow = ent as { cve_entrada: string; company_id: string | null; trafico: string | null }
    if (entRow.company_id !== traficoCompanyId) {
      return err('VALIDATION_ERROR', 'Entrada pertenece a otro cliente', 400)
    }
    const { error: updErr } = await supabase
      .from('entradas')
      .update({ trafico: trafico_id, updated_at: new Date().toISOString() })
      .eq('cve_entrada', target_id)
    if (updErr) return err('DB_ERROR', updErr.message, 500)
    linkedDescription = `entrada ${target_id} → ${trafico_id}`
  } else if (node_type === 'pedimento') {
    const pedimentoValue = target_id.trim()
    if (!/^\d{2}\s\d{2}\s\d{4}\s\d{7}$/.test(pedimentoValue)) {
      return err('VALIDATION_ERROR', 'Pedimento debe tener formato DD AD PPPP SSSSSSS', 400)
    }
    const { error: updErr } = await supabase
      .from('traficos')
      .update({ pedimento: pedimentoValue, updated_at: new Date().toISOString() })
      .eq('trafico', trafico_id)
    if (updErr) return err('DB_ERROR', updErr.message, 500)
    linkedDescription = `pedimento ${pedimentoValue} → ${trafico_id}`
  } else if (node_type === 'expediente') {
    const { data: doc, error: docErr } = await supabase
      .from('expediente_documentos')
      .select('id, company_id, trafico_id')
      .eq('id', target_id)
      .maybeSingle()
    if (docErr) return err('DB_ERROR', docErr.message, 500)
    if (!doc) return err('NOT_FOUND', 'Documento no encontrado', 404)
    const docRow = doc as { id: string; company_id: string | null; trafico_id: string | null }
    if (docRow.company_id && docRow.company_id !== traficoCompanyId) {
      return err('VALIDATION_ERROR', 'Documento pertenece a otro cliente', 400)
    }
    const { error: updErr } = await supabase
      .from('expediente_documentos')
      .update({ trafico_id })
      .eq('id', target_id)
    if (updErr) return err('DB_ERROR', updErr.message, 500)
    linkedDescription = `expediente ${target_id} → ${trafico_id}`
  }

  await logOperatorAction({
    operatorName: `${session.companyId}:${session.role}`,
    actionType: 'chain_node_linked',
    targetTable: 'traficos',
    targetId: trafico_id,
    companyId: traficoCompanyId ?? session.companyId,
    payload: { node_type, target_id, trafico_id },
  })

  await supabase.from('workflow_events').insert({
    workflow: 'chain',
    event_type: 'chain_node_linked',
    trigger_id: trafico_id,
    company_id: traficoCompanyId,
    payload: { node_type, target_id, description: linkedDescription },
  })

  return NextResponse.json({
    data: {
      success: true,
      trafico_id,
      node_type,
      target_id,
      description: linkedDescription,
    },
    error: null,
  })
}
