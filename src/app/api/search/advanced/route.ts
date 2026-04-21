import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { sanitizeIlike } from '@/lib/sanitize'
import { validateAdvancedCriteria } from '@/lib/search-registry'
import { logDecision } from '@/lib/decision-logger'
import type {
  AdvancedSearchCriteria,
  AdvancedSearchResponse,
  AdvancedSearchResultRow,
} from '@/types/search'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ADVANCED_LIMIT = 200

const AdvancedSchema = z.object({
  traficoKey: z.string().max(128).optional(),
  pedimentoNumber: z.string().max(128).optional(),
  invoiceNumber: z.string().max(128).optional(),
  productNumber: z.string().max(128).optional(),
  tariffFraction: z.string().max(32).optional(),
  orderNumber: z.string().max(128).optional(),
  warehouseEntryKey: z.string().max(128).optional(),
  trailerBoxNumber: z.string().max(64).optional(),
  mpCertificateNumber: z.string().max(128).optional(),
  dateFrom: z.string().max(10).optional(),
  dateTo: z.string().max(10).optional(),
  clientCompanyId: z.string().max(64).optional(),
  statusCategory: z.array(z.string().max(64)).optional(),
  operatorId: z.string().max(64).optional(),
})

function trim(v: string | undefined): string | undefined {
  const t = v?.trim()
  return t && t.length > 0 ? t : undefined
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } },
      { status: 400 },
    )
  }

  const parsed = AdvancedSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 },
    )
  }

  const criteria: AdvancedSearchCriteria = parsed.data
  const guard = validateAdvancedCriteria(criteria)
  if (!guard.valid) {
    // Blank-submit guard: never touch Supabase.
    const res: AdvancedSearchResponse = {
      ok: true,
      results: [],
      count: 0,
      truncated: false,
      message: guard.message,
    }
    return NextResponse.json({ data: res, error: null })
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const companyId = isInternal ? '' : session.companyId
  const clientClave = request.cookies.get('company_clave')?.value ?? ''

  const sb = createServerClient()
  let q = sb.from('traficos')
    .select('trafico, estatus, descripcion_mercancia, fecha_llegada, pedimento, company_id')
    .limit(ADVANCED_LIMIT)

  // Scope — non-internal users are locked to their own company.
  if (!isInternal) q = q.eq('company_id', companyId)

  const t = trim(criteria.traficoKey)
  if (t) q = q.ilike('trafico', `%${sanitizeIlike(t)}%`)

  const p = trim(criteria.pedimentoNumber)
  if (p) q = q.ilike('pedimento', `%${sanitizeIlike(p)}%`)

  const e = trim(criteria.warehouseEntryKey)
  if (e) {
    // Link via entradas.trafico — embarque rows that own an entrada matching the key.
    const safeE = sanitizeIlike(e)
    const { data: ent } = await sb.from('entradas')
      .select('trafico').ilike('cve_entrada', `%${safeE}%`).limit(ADVANCED_LIMIT)
    const traficoKeys = Array.from(new Set((ent ?? [])
      .map((r: { trafico: string | null }) => r.trafico).filter((x): x is string => !!x)))
    if (traficoKeys.length === 0) {
      const empty: AdvancedSearchResponse = { ok: true, results: [], count: 0, truncated: false }
      return NextResponse.json({ data: empty, error: null })
    }
    q = q.in('trafico', traficoKeys)
  }

  const inv = trim(criteria.invoiceNumber)
  if (inv) {
    const safeInv = sanitizeIlike(inv)
    let fq = sb.from('aduanet_facturas').select('pedimento').ilike('num_factura', `%${safeInv}%`).limit(ADVANCED_LIMIT)
    if (!isInternal && clientClave) fq = fq.eq('clave_cliente', clientClave)
    const { data: fac } = await fq
    const peds = Array.from(new Set((fac ?? [])
      .map((r: { pedimento: string | null }) => r.pedimento).filter((x): x is string => !!x)))
    if (peds.length === 0) {
      const empty: AdvancedSearchResponse = { ok: true, results: [], count: 0, truncated: false }
      return NextResponse.json({ data: empty, error: null })
    }
    q = q.in('pedimento', peds)
  }

  const df = trim(criteria.dateFrom)
  if (df) q = q.gte('fecha_llegada', df)
  const dt = trim(criteria.dateTo)
  if (dt) q = q.lte('fecha_llegada', dt)

  const cid = trim(criteria.clientCompanyId)
  if (isInternal && cid) q = q.eq('company_id', cid)

  const op = trim(criteria.operatorId)
  if (op) q = q.eq('assigned_to_operator_id', op)

  const fr = trim(criteria.tariffFraction)
  if (fr) {
    const safeFr = sanitizeIlike(fr)
    const { data: part } = await sb.from('globalpc_partidas')
      .select('cve_trafico').ilike('fraccion_arancelaria', `%${safeFr}%`).limit(ADVANCED_LIMIT)
    const traficoKeys = Array.from(new Set((part ?? [])
      .map((r: { cve_trafico: string | null }) => r.cve_trafico).filter((x): x is string => !!x)))
    if (traficoKeys.length === 0) {
      const empty: AdvancedSearchResponse = { ok: true, results: [], count: 0, truncated: false }
      return NextResponse.json({ data: empty, error: null })
    }
    q = q.in('trafico', traficoKeys)
  }

  const { data, error } = await q
  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  const rows = (data ?? []) as AdvancedSearchResultRow[]
  const truncated = rows.length >= ADVANCED_LIMIT
  const response: AdvancedSearchResponse = {
    ok: true,
    results: rows,
    count: rows.length,
    truncated,
  }

  // Analytics — operational_decisions + interaction_events.
  // Non-blocking.
  void logDecision({
    decision_type: 'search_advanced',
    decision: `advanced_search:${rows.length}`,
    reasoning: `Advanced search by ${session.role} in ${session.companyId}`,
    dataPoints: { criteria, result_count: rows.length, truncated },
    company_id: session.companyId,
  })

  void sb.from('interaction_events').insert({
    event_type: 'page_view',
    event_name: 'page_view',
    page_path: '/api/search/advanced',
    user_id: `${session.companyId}:${session.role}`,
    company_id: session.companyId,
    payload: {
      event: 'search_advanced_submitted',
      field_count: Object.values(criteria).filter((v) => {
        if (v == null) return false
        if (typeof v === 'string') return v.trim().length > 0
        if (Array.isArray(v)) return v.length > 0
        return true
      }).length,
      result_count: rows.length,
    },
  })

  return NextResponse.json({ data: response, error: null })
}
