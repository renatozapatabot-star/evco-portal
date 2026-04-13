import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.role === 'client' ? session.companyId : (req.nextUrl.searchParams.get('company_id') || session.companyId)

  // Get most recent forecast
  const { data } = await supabase
    .from('demand_forecasts')
    .select('forecast_data, forecast_date')
    .eq('company_id', companyId)
    .order('forecast_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) {
    // Generate on-the-fly from embarques
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]
    const { data: traficos } = await supabase
      .from('traficos')
      .select('fecha_llegada, importe_total')
      .eq('company_id', companyId)
      .gte('fecha_llegada', yearAgo)

    const rows = traficos || []
    if (rows.length < 5) {
      return NextResponse.json({ forecast: null, message: 'Datos insuficientes para pronóstico' })
    }

    // Group by month, compute 3-month average
    const monthly: Record<string, { count: number; value: number }> = {}
    for (const t of rows) {
      const m = (t.fecha_llegada || '').substring(0, 7)
      if (!m) continue
      if (!monthly[m]) monthly[m] = { count: 0, value: 0 }
      monthly[m].count++
      monthly[m].value += Number(t.importe_total) || 0
    }

    const months = Object.keys(monthly).sort()
    const recent = months.slice(-3)
    const avgCount = Math.round(recent.reduce((s, m) => s + monthly[m].count, 0) / recent.length)
    const avgValue = Math.round(recent.reduce((s, m) => s + monthly[m].value, 0) / recent.length)

    return NextResponse.json({
      forecast: {
        expected_traficos: avgCount,
        expected_value_usd: avgValue,
        confidence_low: Math.max(0, avgCount - 3),
        confidence_high: avgCount + 3,
        trend_direction: 'stable',
        period: '30 días',
        source: 'on-the-fly',
      },
    })
  }

  return NextResponse.json({ forecast: data.forecast_data?.forecast, date: data.forecast_date })
}
