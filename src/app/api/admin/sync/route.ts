import { NextRequest, NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/errors'
import { exec } from 'child_process'
import { promisify } from 'util'
import { verifySession } from '@/lib/session'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Solo administrador' } }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const company = searchParams.get('company')

  try {
    // Run nightly pipeline in background
    const cmd = company
      ? `cd ${process.env.HOME}/evco-portal && node scripts/nightly-pipeline.js --company=${company}`
      : `cd ${process.env.HOME}/evco-portal && node scripts/nightly-pipeline.js`

    execAsync(cmd).catch(console.error) // fire and forget

    return NextResponse.json({
      success: true,
      message: company ? `Sync started for ${company}` : 'Full sync started'
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 })
  }
}
