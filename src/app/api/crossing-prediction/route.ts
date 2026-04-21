import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { verifySession } from '@/lib/session'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const MAX_HOURS = 72 // Outlier filter: crossings > 72h are data anomalies

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
  }

  const companyId = session.companyId
  // Get historical crossing times using REAL fecha_cruce column
  const { data: cruzados } = await supabase.from('traficos')
    .select('trafico, transportista_extranjero, fecha_llegada, fecha_cruce, estatus')
    .eq('company_id', companyId)
    .ilike('estatus', '%cruz%')
    .not('fecha_llegada', 'is', null)
    .not('fecha_cruce', 'is', null)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .limit(3000)

  // Calculate avg hours per carrier using fecha_cruce
  const carrierAvg: Record<string, { total: number; count: number }> = {}
  const dayAvg: Record<number, { total: number; count: number }> = {}
  let globalTotal = 0, globalCount = 0

  ;(cruzados || []).forEach((t: { fecha_cruce: string; fecha_llegada: string; transportista_extranjero?: string | null; trafico: string }) => {
    const hours = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 3600000
    if (hours <= 0 || hours > MAX_HOURS) return // Filter outliers

    globalTotal += hours; globalCount++

    const c = t.transportista_extranjero || 'UNKNOWN'
    if (!carrierAvg[c]) carrierAvg[c] = { total: 0, count: 0 }
    carrierAvg[c].total += hours; carrierAvg[c].count++

    const dow = new Date(t.fecha_llegada).getDay()
    if (!dayAvg[dow]) dayAvg[dow] = { total: 0, count: 0 }
    dayAvg[dow].total += hours; dayAvg[dow].count++
  })

  const globalAvgHours = globalCount > 0 ? Math.round((globalTotal / globalCount) * 10) / 10 : 48

  // Day of week stats
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
  const dayStats = Object.entries(dayAvg)
    .map(([day, d]) => ({ day: Number(day), name: dayNames[Number(day)], avgHours: Math.round(d.total / d.count * 10) / 10, samples: d.count }))
    .sort((a, b) => a.avgHours - b.avgHours)

  const fastestDay = dayStats[0]?.name || 'N/A'
  const slowestDay = dayStats[dayStats.length - 1]?.name || 'N/A'

  // Get active En Proceso embarques and predict
  const { data: active } = await supabase.from('traficos')
    .select('trafico, transportista_extranjero, fecha_llegada, estatus')
    .eq('company_id', companyId).eq('estatus', 'En Proceso')
    .not('fecha_llegada', 'is', null).gte('fecha_llegada', PORTAL_DATE_FROM).limit(500)

  const predictions: Record<string, { avgDays: number; predictedDate: string; confidence: string; carrier: string }> = {}

  ;(active || []).forEach((t: { fecha_llegada: string; transportista_extranjero?: string | null; trafico: string }) => {
    const carrier = t.transportista_extranjero || 'UNKNOWN'
    const cData = carrierAvg[carrier]
    const avgHours = cData && cData.count >= 3 ? Math.round(cData.total / cData.count * 10) / 10 : globalAvgHours
    const confidence = cData && cData.count >= 10 ? 'high' : cData && cData.count >= 3 ? 'medium' : 'low'

    const predicted = new Date(t.fecha_llegada)
    predicted.setTime(predicted.getTime() + avgHours * 3600000)

    predictions[t.trafico] = {
      avgDays: Math.round(avgHours / 24 * 10) / 10,
      predictedDate: predicted.toISOString().split('T')[0],
      confidence,
      carrier,
    }
  })

  return NextResponse.json({
    predictions,
    carrierStats: Object.entries(carrierAvg).map(([name, d]) => ({
      name, avgHours: Math.round(d.total / d.count * 10) / 10, avgDays: Math.round(d.total / d.count / 24 * 10) / 10, samples: d.count,
    })).sort((a, b) => a.avgHours - b.avgHours),
    globalAvgHours,
    globalAvgDays: Math.round(globalAvgHours / 24 * 10) / 10,
    fastest_day: fastestDay,
    slowest_day: slowestDay,
    dayStats,
    count: Object.keys(predictions).length,
    data_points: globalCount,
    max_hours_filter: MAX_HOURS,
  })
}
