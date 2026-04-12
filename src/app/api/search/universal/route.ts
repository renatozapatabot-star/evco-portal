import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { runUniversalSearch } from '@/lib/search'

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
        traficos: [], entradas: [], pedimentos: [],
        proveedores: [], productos: [], fracciones: [], documentos: [],
        took_ms: 0,
      },
      error: null,
    })
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const companyId = isInternal ? '' : session.companyId
  const clientClave = request.cookies.get('company_clave')?.value ?? ''

  const data = await runUniversalSearch(q, { isInternal, companyId, clientClave })
  return NextResponse.json({ data, error: null })
}
