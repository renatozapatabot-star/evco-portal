import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const companyId = session.role === 'client' ? session.companyId : (request.cookies.get('company_id')?.value || session.companyId)

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json(
      { notifications: [], error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ notifications: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const companyId = session.role === 'client' ? session.companyId : (request.cookies.get('company_id')?.value || session.companyId)

  const { id } = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('company_id', companyId)

  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const companyId = session.role === 'client' ? session.companyId : (request.cookies.get('company_id')?.value || session.companyId)

  const { action } = await request.json()

  if (action === 'mark_all_read') {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('company_id', companyId)
      .eq('read', false)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
