import { NextResponse } from 'next/server'
import { computeStatusSentence } from '@/lib/compute-status-sentence'
import { CLIENT_CLAVE } from '@/lib/client-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await computeStatusSentence(CLIENT_CLAVE)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to compute status'
    return NextResponse.json(
      { level: 'green', sentence: 'Cargando estado...', count: 0, error: message },
      { status: 500 }
    )
  }
}
