import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { COMPANY_ID } from '@/lib/client-config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('company_id', COMPANY_ID)
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
  const { id } = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
