import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'

export async function GET(request: NextRequest) {
  const role = request.cookies.get('user_role')?.value
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
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
