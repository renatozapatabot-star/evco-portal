import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { assessRisk } from '@/lib/intelligence-mesh'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  // Auth
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value || ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  const traficoId = req.nextUrl.searchParams.get('trafico_id')
  if (!traficoId) {
    return NextResponse.json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'trafico_id required' } }, { status: 400 })
  }

  // Fetch embarque (client-isolated)
  const isInternal = session.role === 'broker' || session.role === 'admin'
  let query = supabase.from('traficos').select('*').eq('trafico', traficoId).limit(1)
  if (!isInternal) {
    query = query.eq('company_id', session.companyId)
  }

  const { data: traficos, error: fetchError } = await query
  if (fetchError || !traficos || traficos.length === 0) {
    return NextResponse.json({ data: null, error: { code: 'NOT_FOUND', message: 'Embarque not found' } }, { status: 404 })
  }

  const trafico = traficos[0]

  try {
    const assessment = await assessRisk(trafico, supabase)
    return NextResponse.json({ data: assessment, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Risk assessment failed'
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 })
  }
}
