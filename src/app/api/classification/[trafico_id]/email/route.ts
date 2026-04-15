/**
 * Block 5 — POST /api/classification/:trafico_id/email
 *
 * Sends the most recent generated classification sheet for the embarque to
 * the provided recipients (or the per-cliente default recipients). PDF +
 * Excel attached. ZAPATA AI letterhead email body.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'

import {
  renderClassificationSheetHTML,
  buildClassificationSubject,
} from '../../../../../../scripts/lib/email-templates/classification-sheet.js'

const SENDER =
  process.env.RESEND_FROM_ADDRESS || 'ZAPATA AI <sistema@renatozapata.com>'

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

type ClassificationSheetRow = {
  id: string
  trafico_id: string
  cliente_id: string
  company_id: string
  pdf_url: string | null
  excel_url: string | null
  partidas_count: number
  total_value: number | null
  config: unknown
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ trafico_id: string }> },
) {
  const { trafico_id } = await context.params
  const traficoId = decodeURIComponent(trafico_id)

  const session = await verifySession(
    (await cookies()).get('portal_session')?.value ?? '',
  )
  if (!session) return err('UNAUTHORIZED', 'No autorizado', 401)

  const body = (await request.json().catch(() => ({}))) as {
    recipients?: string[]
    mensaje?: string
  }
  const recipients = (body.recipients ?? []).filter(
    (r) => typeof r === 'string' && r.includes('@'),
  )
  if (recipients.length === 0) {
    return err('VALIDATION_ERROR', 'Destinatarios requeridos', 400)
  }

  const supabase = createServerClient()
  const isInternal =
    session.role === 'broker' || session.role === 'admin' || session.role === 'operator'

  // Tenant scope check on the embarque.
  let scopeQ = supabase.from('traficos').select('trafico, company_id').eq('trafico', traficoId)
  if (!isInternal) scopeQ = scopeQ.eq('company_id', session.companyId)
  const { data: scope, error: scopeErr } = await scopeQ.maybeSingle()
  if (scopeErr) return err('DB_ERROR', scopeErr.message, 500)
  if (!scope) return err('NOT_FOUND', 'Embarque no encontrado', 404)

  // Latest generated sheet.
  const { data: sheetRaw, error: sheetErr } = await supabase
    .from('classification_sheets')
    .select('id, trafico_id, cliente_id, company_id, pdf_url, excel_url, partidas_count, total_value, config')
    .eq('trafico_id', traficoId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (sheetErr) return err('DB_ERROR', sheetErr.message, 500)
  if (!sheetRaw)
    return err('NOT_FOUND', 'Genera la hoja antes de enviarla', 404)
  const sheet = sheetRaw as ClassificationSheetRow

  // Company name for subject/letterhead.
  let clienteName = sheet.company_id
  try {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('company_id', sheet.company_id)
      .maybeSingle()
    const c = company as { name: string | null } | null
    if (c?.name) clienteName = c.name
  } catch {
    // ignore
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return err('CONFIG_ERROR', 'RESEND_API_KEY no configurado', 500)

  // Fetch PDF + Excel to attach. Storage public URLs are fine here; fall
  // back gracefully if either is missing.
  const attachments: Array<{ filename: string; content: string }> = []
  async function fetchB64(url: string): Promise<string | null> {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const buf = Buffer.from(await res.arrayBuffer())
      return buf.toString('base64')
    } catch {
      return null
    }
  }
  if (sheet.pdf_url) {
    const b64 = await fetchB64(sheet.pdf_url)
    if (b64) attachments.push({ filename: `clasificacion-${traficoId}.pdf`, content: b64 })
  }
  if (sheet.excel_url) {
    const b64 = await fetchB64(sheet.excel_url)
    if (b64)
      attachments.push({ filename: `clasificacion-${traficoId}.xlsx`, content: b64 })
  }

  const html = renderClassificationSheetHTML({
    traficoRef: traficoId,
    clienteName,
    operatorName: `${session.companyId}:${session.role}`,
    dueDate: new Date().toLocaleDateString('es-MX', { timeZone: 'America/Chicago' }),
    mensaje: body.mensaje ?? '',
    partidasCount: sheet.partidas_count,
    productsCount: sheet.partidas_count, // partidas_count proxy — products_count not persisted
    totalValue: Number(sheet.total_value ?? 0),
    attachments: attachments.map((a) => a.filename),
  })

  const subject = buildClassificationSubject(traficoId, clienteName)

  const resend = new Resend(apiKey)
  const sendRes = await resend.emails.send({
    from: SENDER,
    to: recipients,
    subject,
    html,
    attachments,
  })
  if (sendRes.error) {
    return err('EMAIL_ERROR', `Resend: ${sendRes.error.message}`, 502)
  }

  // Mark recipients on the history row.
  await supabase
    .from('classification_sheets')
    .update({ sent_to_recipients: recipients })
    .eq('id', sheet.id)

  try {
    await supabase.from('operational_decisions').insert({
      decision_type: 'classification_sheet_emailed',
      entity_type: 'trafico',
      entity_id: traficoId,
      actor: `${session.companyId}:${session.role}`,
      payload: { sheet_id: sheet.id, recipients },
    })
  } catch {
    // Non-fatal.
  }

  return NextResponse.json({
    data: { ok: true, sheetId: sheet.id, recipients },
    error: null,
  })
}
