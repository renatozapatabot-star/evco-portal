// src/app/api/negotiation/route.ts
// Broker-only API — returns supplier negotiation briefs
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
  if (role !== 'broker' && role !== 'admin') {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Acceso restringido' } }, { status: 401 })
  }

  const companyId = cookieStore.get('company_clave')?.value
  if (!companyId) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sin empresa' } }, { status: 401 })
  }

  try {
    const { data: briefs } = await supabase
      .from('negotiation_briefs')
      .select('*')
      .eq('company_id', companyId)
      .order('potential_savings_usd', { ascending: false })
      .limit(30)

    const all = briefs || []
    const totalSavings = all.reduce((s, b) => s + (b.potential_savings_usd || 0), 0)

    return NextResponse.json({
      data: {
        briefs: all,
        summary: {
          total_suppliers: all.length,
          total_potential_savings: Math.round(totalSavings),
          above_market: all.filter(b => (b.price_vs_market_pct || 0) > 10).length,
        },
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 })
  }
}
