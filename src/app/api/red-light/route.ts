import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const userRole = req.cookies.get('user_role')?.value
  if (!userRole) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trafico = req.nextUrl.searchParams.get('trafico')
  if (!trafico) return NextResponse.json({ error: 'Missing trafico param' }, { status: 400 })

  const { data: riskData } = await supabase
    .from('pedimento_risk_scores')
    .select('red_light_probability, overall_score')
    .eq('trafico_id', trafico)
    .single()

  const probability = riskData?.red_light_probability ?? null
  const factors: string[] = []

  if (probability !== null) {
    if (probability > 0.3) factors.push('Carrier con historial elevado')
    if (new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short' }) === 'Fri') factors.push('Viernes — tasa mayor')
    if ((riskData?.overall_score || 0) > 50) factors.push('Risk score alto')
  }

  const recommendation = probability === null ? 'Sin datos suficientes'
    : probability > 0.4 ? 'ALTO — Preparar documentación completa para reconocimiento'
    : probability > 0.2 ? 'MODERADO — Documentos en orden'
    : 'BAJO — Tráfico normal'

  return NextResponse.json({
    trafico,
    probability,
    factors,
    recommendation,
  })
}
