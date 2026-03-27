import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  // Get historical crossing times: tráficos that are Cruzado with both dates
  const { data: cruzados } = await supabase.from('traficos')
    .select('trafico, transportista_extranjero, fecha_llegada, updated_at, estatus')
    .eq('company_id', 'evco')
    .ilike('estatus', '%cruz%')
    .not('fecha_llegada', 'is', null)
    .limit(3000)

  // Calculate avg days per carrier
  const carrierAvg: Record<string, { total: number; count: number }> = {}
  let globalTotal = 0, globalCount = 0

  ;(cruzados || []).forEach((t: any) => {
    if (!t.fecha_llegada || !t.updated_at) return
    const days = Math.max(0, Math.floor((new Date(t.updated_at).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000))
    if (days > 90) return // filter outliers
    globalTotal += days; globalCount++
    const c = t.transportista_extranjero || 'UNKNOWN'
    if (!carrierAvg[c]) carrierAvg[c] = { total: 0, count: 0 }
    carrierAvg[c].total += days; carrierAvg[c].count++
  })

  const globalAvgDays = globalCount > 0 ? Math.round(globalTotal / globalCount) : 3

  // Get active En Proceso tráficos
  const { data: active } = await supabase.from('traficos')
    .select('trafico, transportista_extranjero, fecha_llegada, estatus')
    .eq('company_id', 'evco').eq('estatus', 'En Proceso')
    .not('fecha_llegada', 'is', null).limit(500)

  const predictions: Record<string, { avgDays: number; predictedDate: string; confidence: string; carrier: string }> = {}

  ;(active || []).forEach((t: any) => {
    const carrier = t.transportista_extranjero || 'UNKNOWN'
    const cData = carrierAvg[carrier]
    const avgDays = cData && cData.count >= 3 ? Math.round(cData.total / cData.count) : globalAvgDays
    const confidence = cData && cData.count >= 10 ? 'high' : cData && cData.count >= 3 ? 'medium' : 'low'

    const predicted = new Date(t.fecha_llegada)
    predicted.setDate(predicted.getDate() + avgDays)

    predictions[t.trafico] = {
      avgDays,
      predictedDate: predicted.toISOString().split('T')[0],
      confidence,
      carrier,
    }
  })

  return NextResponse.json({
    predictions,
    carrierStats: Object.entries(carrierAvg).map(([name, d]) => ({
      name, avgDays: Math.round(d.total / d.count), samples: d.count,
    })).sort((a, b) => a.avgDays - b.avgDays),
    globalAvgDays,
    count: Object.keys(predictions).length,
  })
}
