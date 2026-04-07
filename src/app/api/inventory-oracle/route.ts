// src/app/api/inventory-oracle/route.ts
// Broker-only API — returns inventory estimates + reorder alerts
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
    const [estimates, alerts] = await Promise.all([
      supabase
        .from('inventory_estimates')
        .select('*')
        .eq('company_id', companyId)
        .order('days_of_cover', { ascending: true })
        .limit(100),
      supabase
        .from('reorder_alerts')
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['pending', 'sent'])
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    // Summary KPIs
    const all = estimates.data || []
    const criticalCount = all.filter(e => e.risk_level === 'critical').length
    const warningCount = all.filter(e => e.risk_level === 'warning').length
    const avgCover = all.length > 0
      ? Math.round(all.reduce((s, e) => s + (e.days_of_cover || 0), 0) / all.length)
      : null

    return NextResponse.json({
      data: {
        estimates: all,
        alerts: alerts.data || [],
        summary: {
          total_products: all.length,
          critical: criticalCount,
          warning: warningCount,
          avg_days_cover: avgCover,
        },
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 })
  }
}
