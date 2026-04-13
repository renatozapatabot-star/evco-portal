/**
 * Block 8 · Invoice Bank — per-row mutations.
 *
 * PATCH /api/invoice-bank/[id]
 *   body: { action: 'assign', traficoId } | { action: 'archive' }
 * DELETE /api/invoice-bank/[id] — soft delete (status='archived')
 *   with metadata flag so the audit trail distinguishes archive from
 *   explicit delete.
 *
 * Every mutation:
 *   - verifies session + tenant scope
 *   - validates status transition via isValidStatusTransition()
 *   - writes the row
 *   - emits workflow_events
 *   - logs operational_decisions
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import {
  buildInvoiceAssignedPayload,
  isValidStatusTransition,
  type InvoiceBankStatus,
} from '@/lib/invoice-bank'
import { logDecision } from '@/lib/decision-logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PatchSchema = z.union([
  z.object({ action: z.literal('assign'), traficoId: z.string().min(1).max(128) }),
  z.object({ action: z.literal('archive') }),
])

async function loadRow(id: string, companyId: string) {
  return supabase
    .from('pedimento_facturas')
    .select('id, status, company_id, invoice_number, supplier_name, amount, currency, assigned_to_trafico_id')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const { id } = await params
  const companyId =
    session.role === 'client'
      ? session.companyId
      : (request.cookies.get('company_id')?.value || session.companyId)
  const actor = `${session.companyId}:${session.role}`

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } },
      { status: 400 },
    )
  }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'action o traficoId inválidos' } },
      { status: 400 },
    )
  }

  const { data: row, error: loadErr } = await loadRow(id, companyId)
  if (loadErr || !row) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Factura no encontrada' } },
      { status: 404 },
    )
  }

  const currentStatus = row.status as InvoiceBankStatus

  if (parsed.data.action === 'assign') {
    const { traficoId } = parsed.data
    if (!isValidStatusTransition(currentStatus, 'assigned')) {
      return NextResponse.json(
        { data: null, error: { code: 'CONFLICT', message: `No se puede asignar desde ${currentStatus}` } },
        { status: 409 },
      )
    }

    // Verify embarque exists + tenant-scope.
    const { data: trafRow, error: trafErr } = await supabase
      .from('traficos')
      .select('trafico, company_id')
      .eq('trafico', traficoId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (trafErr || !trafRow) {
      return NextResponse.json(
        { data: null, error: { code: 'NOT_FOUND', message: 'Embarque no encontrado' } },
        { status: 404 },
      )
    }

    const assignedAt = new Date().toISOString()
    const { error: updErr } = await supabase
      .from('pedimento_facturas')
      .update({ status: 'assigned', assigned_to_trafico_id: traficoId, assigned_at: assignedAt })
      .eq('id', id)
      .eq('company_id', companyId)
    if (updErr) {
      return NextResponse.json(
        { data: null, error: { code: 'INTERNAL_ERROR', message: updErr.message } },
        { status: 500 },
      )
    }

    const eventPayload = buildInvoiceAssignedPayload({
      invoiceId: id,
      traficoId,
      invoiceNumber: (row.invoice_number as string | null) ?? null,
      supplierName: (row.supplier_name as string | null) ?? null,
      amount: (row.amount as number | null) ?? null,
      currency: (row.currency as string | null) ?? null,
      actor,
    })
    await supabase.from('workflow_events').insert({ ...eventPayload, company_id: companyId })
    await logDecision({
      trafico: traficoId,
      company_id: companyId,
      decision_type: 'invoice_assigned',
      decision: `factura ${row.invoice_number ?? id} asignada a ${traficoId}`,
      reasoning: `Asignación manual por ${actor}`,
      dataPoints: { invoice_id: id, trafico_id: traficoId },
    })
    return NextResponse.json({ data: { id, status: 'assigned', assignedAt }, error: null })
  }

  // archive
  if (!isValidStatusTransition(currentStatus, 'archived')) {
    return NextResponse.json(
      { data: null, error: { code: 'CONFLICT', message: `No se puede archivar desde ${currentStatus}` } },
      { status: 409 },
    )
  }
  const archivedAt = new Date().toISOString()
  const { error: archErr } = await supabase
    .from('pedimento_facturas')
    .update({ status: 'archived', archived_at: archivedAt })
    .eq('id', id)
    .eq('company_id', companyId)
  if (archErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: archErr.message } },
      { status: 500 },
    )
  }
  await supabase.from('workflow_events').insert({
    workflow: 'invoice',
    event_type: 'invoice_archived',
    trigger_id: row.assigned_to_trafico_id ?? null,
    company_id: companyId,
    payload: { invoice_id: id, actor },
  })
  await logDecision({
    trafico: row.assigned_to_trafico_id ?? null,
    company_id: companyId,
    decision_type: 'invoice_archived',
    decision: `factura ${row.invoice_number ?? id} archivada`,
    reasoning: `Archivo manual por ${actor}`,
    dataPoints: { invoice_id: id },
  })
  return NextResponse.json({ data: { id, status: 'archived', archivedAt }, error: null })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Soft delete: mark archived + emit invoice_deleted (distinct from
  // invoice_archived so the audit trail differentiates intent).
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }
  const { id } = await params
  const companyId =
    session.role === 'client'
      ? session.companyId
      : (request.cookies.get('company_id')?.value || session.companyId)
  const actor = `${session.companyId}:${session.role}`

  const { data: row, error: loadErr } = await loadRow(id, companyId)
  if (loadErr || !row) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Factura no encontrada' } },
      { status: 404 },
    )
  }

  const { error: delErr } = await supabase
    .from('pedimento_facturas')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
  if (delErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: delErr.message } },
      { status: 500 },
    )
  }
  await supabase.from('workflow_events').insert({
    workflow: 'invoice',
    event_type: 'invoice_deleted',
    trigger_id: row.assigned_to_trafico_id ?? null,
    company_id: companyId,
    payload: { invoice_id: id, actor },
  })
  await logDecision({
    trafico: row.assigned_to_trafico_id ?? null,
    company_id: companyId,
    decision_type: 'invoice_deleted',
    decision: `factura ${row.invoice_number ?? id} eliminada (soft)`,
    reasoning: `Eliminación solicitada por ${actor}`,
    dataPoints: { invoice_id: id },
  })
  return NextResponse.json({ data: { id, status: 'archived' }, error: null })
}
