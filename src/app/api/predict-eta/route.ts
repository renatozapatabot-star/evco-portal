import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ETAModel {
  global_avg: number
  global_median: number
  by_day_of_week: Record<string, number>
  by_regimen: Record<string, number>
  by_value_bracket: Record<string, number>
  by_client: Record<string, number>
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number }
  confidence: string
}

/**
 * POST /api/predict-eta
 * Predicts crossing ETA for a trafico based on historical patterns.
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { trafico_id } = await req.json()
  if (!trafico_id) return NextResponse.json({ error: 'trafico_id required' }, { status: 400 })

  // Get model from system_config
  const { data: config } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'eta_model')
    .single()

  if (!config?.value) {
    return NextResponse.json({
      prediction: null,
      message: 'Modelo de predicción no disponible. Se construye semanalmente.',
    })
  }

  const model = config.value as ETAModel

  // Get trafico details
  const { data: trafico } = await supabase
    .from('traficos')
    .select('fecha_llegada, regimen, importe_total, company_id')
    .eq('trafico', trafico_id)
    .single()

  if (!trafico?.fecha_llegada) {
    return NextResponse.json({
      prediction: null,
      message: 'Embarque sin fecha de llegada — no se puede predecir.',
    })
  }

  // Calculate prediction using model factors
  const llegada = new Date(trafico.fecha_llegada)
  const dayOfWeek = llegada.getDay()
  const regimen = (trafico.regimen || 'A1').toUpperCase()
  const value = Number(trafico.importe_total) || 0
  const valueBracket = value > 100000 ? 'high' : value > 10000 ? 'mid' : 'low'
  const companyId = trafico.company_id || ''

  // Weighted average of factors
  const factors: number[] = []
  const weights: number[] = []

  // Global average (weight 1)
  factors.push(model.global_avg)
  weights.push(1)

  // Day of week (weight 1.5)
  if (model.by_day_of_week[dayOfWeek] !== undefined) {
    factors.push(model.by_day_of_week[dayOfWeek])
    weights.push(1.5)
  }

  // Regimen (weight 2)
  if (model.by_regimen[regimen] !== undefined) {
    factors.push(model.by_regimen[regimen])
    weights.push(2)
  }

  // Value bracket (weight 1)
  if (model.by_value_bracket[valueBracket] !== undefined) {
    factors.push(model.by_value_bracket[valueBracket])
    weights.push(1)
  }

  // Client history (weight 2.5 — strongest signal)
  if (model.by_client[companyId] !== undefined) {
    factors.push(model.by_client[companyId])
    weights.push(2.5)
  }

  // Weighted average
  const totalWeight = weights.reduce((s, w) => s + w, 0)
  const predicted = Math.round(factors.reduce((s, f, i) => s + f * weights[i], 0) / totalWeight * 10) / 10

  // Estimated crossing date
  const etaDate = new Date(llegada.getTime() + predicted * 86400000)
  const daysElapsed = Math.floor((Date.now() - llegada.getTime()) / 86400000)
  const daysRemaining = Math.max(0, Math.round(predicted - daysElapsed))

  return NextResponse.json({
    prediction: {
      estimated_days: predicted,
      estimated_date: etaDate.toISOString().split('T')[0],
      days_elapsed: daysElapsed,
      days_remaining: daysRemaining,
      range: {
        optimistic: model.percentiles.p25,
        expected: model.percentiles.p50,
        conservative: model.percentiles.p75,
      },
      confidence: model.confidence,
      factors_used: factors.length,
    },
    message: daysRemaining > 0
      ? `Estimado: ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''} restante${daysRemaining !== 1 ? 's' : ''}`
      : 'Debería cruzar pronto — ya superó el tiempo promedio',
  })
}
