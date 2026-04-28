import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { runUniversalSearch } from '@/lib/search'

// P0-A7: resolve clave_cliente server-side from the verified companyId,
// never the cookie.
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE) throw new Error('SUPABASE_SERVICE_ROLE_KEY required for /api/search/universal')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, SERVICE_ROLE)

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({
      data: {
        query: q,
        traficos: [], pedimentos: [], entradas: [], facturas: [], partidas: [],
        productos: [], fracciones: [], clientes: [], proveedores: [],
        operadores: [], documentos: [], ordenes_carga: [],
        took_ms: 0,
      },
      error: null,
    })
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const companyId = isInternal ? '' : session.companyId

  let clientClave = ''
  if (!isInternal && session.companyId) {
    const { data: companyRow } = await supabase
      .from('companies')
      .select('clave_cliente')
      .eq('company_id', session.companyId)
      .maybeSingle()
    clientClave = (companyRow?.clave_cliente as string | undefined) ?? ''
  }

  const data = await runUniversalSearch(q, { isInternal, companyId, clientClave })
  return NextResponse.json({ data, error: null })
}
