import { NextRequest, NextResponse } from 'next/server'
import { computeStatusSentence } from '@/lib/compute-status-sentence'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const clientClave = request.cookies.get('company_clave')?.value ?? '9254'
    const result = await computeStatusSentence(clientClave)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to compute status'
    return NextResponse.json(
      { level: 'green', sentence: 'Cargando estado...', count: 0, error: message },
      { status: 500 }
    )
  }
}
