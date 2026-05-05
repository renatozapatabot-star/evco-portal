import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { solicitarDocumentos } from '@/lib/solicitar-documentos'
import { verifySession } from '@/lib/session'

// P0-A7: resolve clave_cliente from the verified companyId, never the cookie.
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE) throw new Error('SUPABASE_SERVICE_ROLE_KEY required for /api/solicitar-documentos')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, SERVICE_ROLE)

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { data: companyRow } = await supabase
      .from('companies')
      .select('clave_cliente')
      .eq('company_id', session.companyId)
      .maybeSingle()
    const clientClave = (companyRow?.clave_cliente as string | undefined) ?? ''
    const body = await request.json()
    const { traficoId, missingDocs } = body

    if (!traficoId || !Array.isArray(missingDocs) || missingDocs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'traficoId and missingDocs[] required' },
        { status: 400 }
      )
    }

    const result = await solicitarDocumentos(traficoId, missingDocs, clientClave)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
