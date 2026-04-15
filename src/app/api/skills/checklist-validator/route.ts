import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * ZAPATA AI v10 skill — document-checklist-validator.
 *
 * Given a trafico_id, returns { required, present, missing, complete_pct }.
 * Client-scoped (respects session.companyId for client role; admin/broker
 * bypass via service role).
 *
 * Response shape: `{ data, error }` per core-invariants rule 1.
 */

const REQUIRED_BY_REGIMEN: Record<string, string[]> = {
  IMD: ['factura', 'pedimento', 'lista_de_empaque', 'certificado_origen'],
  ITE: ['factura', 'pedimento', 'lista_de_empaque'],
  ITR: ['factura', 'pedimento'],
  A1:  ['factura', 'pedimento', 'lista_de_empaque'],
  IT:  ['factura', 'pedimento', 'lista_de_empaque'],
  IN:  ['factura', 'pedimento'],
  _default: ['factura', 'pedimento', 'lista_de_empaque'],
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión requerida' } }, { status: 401 })

  let body: { trafico_id?: string } = {}
  try { body = await req.json() } catch { /* ignore */ }
  const traficoId = body.trafico_id
  if (!traficoId) return NextResponse.json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'trafico_id requerido' } }, { status: 400 })

  const sb = createServerClient()

  // Resolve the trafico (scoped by company for client role)
  let traficoQ = sb.from('traficos').select('trafico, regimen, company_id').eq('trafico', traficoId)
  if (session.role === 'client') traficoQ = traficoQ.eq('company_id', session.companyId)
  const { data: traficoRow, error: traficoErr } = await traficoQ.maybeSingle()
  if (traficoErr) return NextResponse.json({ data: null, error: { code: 'DB_ERROR', message: traficoErr.message } }, { status: 500 })
  if (!traficoRow) return NextResponse.json({ data: null, error: { code: 'NOT_FOUND', message: 'Embarque no encontrado' } }, { status: 404 })

  const trafico = traficoRow as { trafico: string; regimen: string | null; company_id: string }
  const regimen = (trafico.regimen || '_default').toUpperCase()
  const required = REQUIRED_BY_REGIMEN[regimen] ?? REQUIRED_BY_REGIMEN._default

  const { data: docsRaw, error: docsErr } = await sb
    .from('expediente_documentos')
    .select('doc_type')
    .eq('trafico_id', trafico.trafico)
    .limit(500)
  if (docsErr) return NextResponse.json({ data: null, error: { code: 'DB_ERROR', message: docsErr.message } }, { status: 500 })

  const docs = (docsRaw ?? []) as Array<{ doc_type: string | null }>
  const presentSet = new Set<string>()
  for (const d of docs) {
    if (d.doc_type) presentSet.add(d.doc_type.toLowerCase())
  }
  const present = required.filter((r) => presentSet.has(r))
  const missing = required.filter((r) => !presentSet.has(r))
  const complete_pct = required.length > 0 ? Math.round((present.length / required.length) * 100) : 100

  return NextResponse.json({
    data: {
      trafico_id: trafico.trafico,
      regimen,
      required,
      present,
      missing,
      complete_pct,
    },
    error: null,
  })
}
