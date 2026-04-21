import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { verifySession } from '@/lib/session'

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Solo administrador' } }, { status: 403 })
  }

  try {
    const checkpoint = JSON.parse(
      readFileSync('/tmp/historical-sync-checkpoint.json', 'utf8')
    )
    return NextResponse.json({
      completed: checkpoint.completed?.length || 0,
      total: 50,
      pct: Math.round(((checkpoint.completed?.length || 0) / 50) * 100),
      clients: checkpoint.completed || []
    })
  } catch {
    return NextResponse.json({
      completed: 0,
      total: 50,
      pct: 0,
      clients: [],
      note: 'No checkpoint file found — sync may not have started'
    })
  }
}
