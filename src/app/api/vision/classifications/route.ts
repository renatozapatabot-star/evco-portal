/**
 * ZAPATA AI V1.5 · F14 — GET /api/vision/classifications
 *
 * Returns the most recent classification row for a given invoice bank
 * entry (or expediente document). Used by the banco-facturas right
 * rail to render the "Extraído por ZAPATA AI" chip + confirm button.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const companyId =
    session.role === 'client'
      ? session.companyId
      : (request.cookies.get('company_id')?.value || session.companyId)

  const url = new URL(request.url)
  const invoiceBankId = url.searchParams.get('invoiceBankId')
  const expedienteDocId = url.searchParams.get('expedienteDocId')

  if (!invoiceBankId && !expedienteDocId) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'invoiceBankId o expedienteDocId requerido' } },
      { status: 400 },
    )
  }

  let query = supabase
    .from('document_classifications')
    .select('id, doc_type, supplier, invoice_number, invoice_date, currency, amount, confirmed_at, confirmed_match, company_id, error')
    .order('classified_at', { ascending: false })
    .limit(1)

  if (invoiceBankId) query = query.eq('invoice_bank_id', invoiceBankId)
  if (expedienteDocId) query = query.eq('expediente_document_id', expedienteDocId)

  const { data, error } = await query.maybeSingle()
  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  // Tenant guard — clients only see their company rows.
  if (data && session.role === 'client' && data.company_id && data.company_id !== companyId) {
    return NextResponse.json({ data: { classification: null }, error: null })
  }

  return NextResponse.json({ data: { classification: data ?? null }, error: null })
}
