import { NextRequest, NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/errors'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  const role = request.cookies.get('user_role')?.value
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
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
