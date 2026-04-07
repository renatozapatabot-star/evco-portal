// src/app/api/cost-insights/route.ts
// Broker-only API — returns cost optimization insights + monthly savings
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
    const [insights, monthly] = await Promise.all([
      supabase
        .from('cost_insights')
        .select('*')
        .eq('company_id', companyId)
        .order('estimated_savings_usd', { ascending: false })
        .limit(50),
      supabase
        .from('operations_savings')
        .select('*')
        .eq('company_id', companyId)
        .order('month', { ascending: false })
        .limit(6),
    ])

    const allInsights = insights.data || []
    const totalEstimated = allInsights.reduce((s, i) => s + (i.estimated_savings_usd || 0), 0)
    const newCount = allInsights.filter(i => i.status === 'new').length

    return NextResponse.json({
      data: {
        insights: allInsights,
        monthly: monthly.data || [],
        summary: {
          total_insights: allInsights.length,
          new_insights: newCount,
          total_estimated_usd: Math.round(totalEstimated),
          total_implemented_usd: Math.round(allInsights
            .filter(i => i.status === 'implemented')
            .reduce((s, i) => s + (i.implemented_savings_usd || 0), 0)),
        },
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 })
  }
}
