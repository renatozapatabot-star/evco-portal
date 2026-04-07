// src/app/api/competitive-intel/route.ts
// Admin-only — competitive intelligence digest
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  if (role !== 'admin' && role !== 'broker') {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Solo administrador' } }, { status: 401 })
  }

  try {
    const { data: intel } = await supabase
      .from('competitive_intel')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(50)

    const all = intel || []
    const actionable = all.filter(i => i.actionable && i.status === 'new')

    return NextResponse.json({
      data: {
        intel: all,
        summary: {
          total: all.length,
          new: all.filter(i => i.status === 'new').length,
          actionable: actionable.length,
          by_type: all.reduce((acc: Record<string, number>, i) => {
            acc[i.intel_type] = (acc[i.intel_type] || 0) + 1
            return acc
          }, {}),
        },
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 })
  }
}
