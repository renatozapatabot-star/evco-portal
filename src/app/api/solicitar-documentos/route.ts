import { NextRequest, NextResponse } from 'next/server'
import { solicitarDocumentos } from '@/lib/solicitar-documentos'
import { CLIENT_CLAVE } from '@/lib/client-config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { traficoId, missingDocs } = body

    if (!traficoId || !Array.isArray(missingDocs) || missingDocs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'traficoId and missingDocs[] required' },
        { status: 400 }
      )
    }

    const result = await solicitarDocumentos(traficoId, missingDocs, CLIENT_CLAVE)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
