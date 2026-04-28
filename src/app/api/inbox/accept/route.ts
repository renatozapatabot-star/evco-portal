/**
 * V2 Doc Intelligence · Phase 3 — Document Inbox bulk actions.
 *
 * Two actions today (V1):
 *
 *   · accept_type  — user confirms the AI's suggested doc_type (or
 *                    picks an override). We persist a fresh
 *                    document_classifications row with model
 *                    'user_confirmed' + confidence 1.0 so the audit
 *                    trail shows Tito/Ursula's approval. The invoice
 *                    stays in status='unassigned' — acceptance is a
 *                    classification decision, not an assignment.
 *
 *   · archive      — soft-discard the invoice (status='archived').
 *                    Irreversible in V1 per invoice-bank state machine
 *                    (unassigned → archived is allowed; archived is
 *                    terminal). Future work: restore endpoint.
 *
 * Bulk: accepts up to 100 ids per call. Tenant-scoped by
 * session.companyId (internal roles may override via company_id cookie).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { SMART_DOC_TYPES, smartToLegacyVision, type SmartDocType } from '@/lib/docs/classify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ALLOWED_ACTIONS = new Set(['accept_type', 'archive'])
const MAX_IDS = 100

interface AcceptBody {
  ids: string[]
  action: 'accept_type' | 'archive'
  /** Required when action='accept_type'. A SmartDocType. */
  smartType?: SmartDocType
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  let body: AcceptBody
  try {
    body = (await request.json()) as AcceptBody
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } },
      { status: 400 },
    )
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string') : []
  if (ids.length === 0) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Falta ids' } },
      { status: 400 },
    )
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: `Máximo ${MAX_IDS} ids por llamada` } },
      { status: 400 },
    )
  }
  if (!ALLOWED_ACTIONS.has(body.action)) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'action no soportada' } },
      { status: 400 },
    )
  }
  if (body.action === 'accept_type') {
    if (!body.smartType || !SMART_DOC_TYPES.includes(body.smartType)) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'smartType inválido' } },
        { status: 400 },
      )
    }
  }

  const companyId =
    session.role === 'client'
      ? session.companyId
      : (request.cookies.get('company_id')?.value || session.companyId)
  const actor = `${session.companyId}:${session.role}`

  // Tenant guard: confirm every id belongs to this company BEFORE any write.
  // A client ignoring their companyId and passing someone else's ids gets
  // zero rows back here and the update short-circuits.
  const { data: owned, error: ownedErr } = await supabase
    .from('pedimento_facturas')
    .select('id, status, file_url')
    .eq('company_id', companyId)
    .in('id', ids)

  if (ownedErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: ownedErr.message } },
      { status: 500 },
    )
  }

  const ownedRows = (owned ?? []) as Array<{ id: string; status: string; file_url: string | null }>
  const ownedIds = new Set(ownedRows.map((r) => r.id))
  const rejected = ids.filter((x) => !ownedIds.has(x))

  if (body.action === 'archive') {
    // Only unassigned → archived is valid per isValidStatusTransition.
    const toArchive = ownedRows
      .filter((r) => r.status === 'unassigned' || r.status === 'assigned')
      .map((r) => r.id)
    if (toArchive.length === 0) {
      return NextResponse.json({
        data: { archived: 0, accepted: 0, rejected, skipped: ownedIds.size },
        error: null,
      })
    }
    const { error: updErr } = await supabase
      .from('pedimento_facturas')
      .update({ status: 'archived' })
      .in('id', toArchive)
      .eq('company_id', companyId)
    if (updErr) {
      return NextResponse.json(
        { data: null, error: { code: 'INTERNAL_ERROR', message: updErr.message } },
        { status: 500 },
      )
    }
    // Audit trail — one workflow event per archived row.
    await supabase.from('workflow_events').insert(
      toArchive.map((id) => ({
        workflow: 'invoice',
        event_type: 'invoice_archived',
        trigger_id: null,
        company_id: companyId,
        payload: { invoice_id: id, actor, source: 'inbox_bulk' },
      })),
    )
    return NextResponse.json({
      data: { archived: toArchive.length, accepted: 0, rejected, skipped: ownedIds.size - toArchive.length },
      error: null,
    })
  }

  // accept_type path — one classification row per invoice id.
  const smartType = body.smartType as SmartDocType
  const legacyType = smartToLegacyVision(smartType)
  const classificationRows = ownedRows.map((r) => ({
    company_id: companyId,
    invoice_bank_id: r.id,
    expediente_document_id: null,
    file_url: r.file_url,
    doc_type: legacyType,
    supplier: null,
    invoice_number: null,
    invoice_date: null,
    currency: null,
    amount: null,
    line_items: null,
    raw_response: { source: 'user_confirmed', smart_type: smartType, actor },
    model: 'user_confirmed',
    confidence: 1,
    error: null,
  }))
  const { error: insErr } = await supabase
    .from('document_classifications')
    .insert(classificationRows)
  if (insErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: insErr.message } },
      { status: 500 },
    )
  }
  return NextResponse.json({
    data: { accepted: ownedRows.length, archived: 0, rejected, skipped: 0 },
    error: null,
  })
}
