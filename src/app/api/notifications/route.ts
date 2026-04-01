import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const companyId = request.cookies.get('company_id')?.value
  const userRole = request.cookies.get('user_role')?.value
  if (!userRole) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  const companyId = request.cookies.get('company_id')?.value
  const userRole = request.cookies.get('user_role')?.value
  if (!userRole) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
