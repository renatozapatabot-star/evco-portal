/**
 * GET /api/clasificar/unclassified
 *
 * Lists products needing classification: `globalpc_productos` rows with
 * null/empty fraccion, tenant-scoped (clients see own; internal see all or
 * filter by ?company_id). Capped at 100 to keep bulk calls bounded.
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

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return err('UNAUTHORIZED', 'No autorizado', 401)

  const isInternal = ['operator', 'admin', 'broker'].includes(session.role)
  const sp = request.nextUrl.searchParams
  const companyId =
    session.role === 'client'
      ? session.companyId
      : (sp.get('company_id') || request.cookies.get('company_id')?.value || '')
  const limit = Math.min(Math.max(Number.parseInt(sp.get('limit') ?? '50', 10) || 50, 1), 100)
  const q = (sp.get('q') ?? '').trim()

  // globalpc_productos real columns: id, cve_producto, cve_cliente,
  // cve_proveedor, descripcion, descripcion_ingles, fraccion, umt, marca,
  // nico, pais_origen, precio_unitario, globalpc_folio, created_at,
  // company_id. There is NO cve_trafico, cantidad, unidad, valor_unitario,
  // or valor_total — those are partida-level and live on globalpc_partidas
  // (cantidad + precio_unitario are the real partida shape; valor_total
  // is computed as cantidad × precio_unitario). M16 phantom-sweep rewire.
  let query = supabase
    .from('globalpc_productos')
    .select('id, cve_producto, cve_proveedor, cve_cliente, descripcion, descripcion_ingles, pais_origen, umt, company_id, created_at')
    .or('fraccion.is.null,fraccion.eq.')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!isInternal || companyId) {
    query = query.eq('company_id', companyId)
  }
  if (q.length > 0) {
    query = query.ilike('descripcion', `%${q}%`)
  }

  const { data, error } = await query
  if (error) {
    return err('DB_ERROR', error.message, 500)
  }
  return NextResponse.json({ data: data ?? [], error: null })
}
