import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
  }

  const { trafico_id } = await request.json()
  if (!trafico_id) return NextResponse.json({ error: 'trafico_id required' }, { status: 400 })

  const { data: trafico } = await supabase
    .from('traficos')
    .select('*')
    .eq('trafico', trafico_id)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .single()

  if (!trafico) return NextResponse.json({ error: 'Tráfico not found' }, { status: 404 })
  if ((trafico.estatus || '').toLowerCase().includes('cruz')) {
    return NextResponse.json({ trafico_id, prediction: null, reason: 'Already crossed' })
  }

  // Get historical crossing data for this carrier
  const carrier = trafico.transportista_extranjero
  const { data: historical } = await supabase
    .from('traficos')
    .select('fecha_llegada, fecha_cruce')
    .eq('transportista_extranjero', carrier)
    .not('fecha_cruce', 'is', null)
    .not('fecha_llegada', 'is', null)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .limit(200)

  // Calculate baseline hours
  const hours = (historical || [])
    .map(t => (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 3600000)
    .filter(h => h > 0 && h < 720)
    .sort((a, b) => a - b)

  const baseline = hours.length > 0
    ? hours[Math.floor(hours.length * 0.5)] // median
    : 48 // default 48h

  // Get current bridge conditions
  const { data: bridge } = await supabase
    .from('bridge_intelligence')
    .select('crossing_hours')
    .eq('day_of_week', new Date().getDay())
    .limit(5)

  const currentConditions = bridge?.length
    ? bridge.reduce((s, b) => s + b.crossing_hours, 0) / bridge.length
    : 1

  // Adjust baseline
  const adjusted = baseline * (currentConditions > 1 ? 1.2 : 0.9)

  // Calculate windows
  const arrivalDate = trafico.fecha_llegada ? new Date(trafico.fecha_llegada) : new Date()
  const bestCase = new Date(arrivalDate.getTime() + adjusted * 0.7 * 3600000)
  const expected = new Date(arrivalDate.getTime() + adjusted * 3600000)
  const worstCase = new Date(arrivalDate.getTime() + adjusted * 1.5 * 3600000)

  const now = Date.now()
  const probToday = expected.getTime() < now + 12 * 3600000 ? 68 : expected.getTime() < now + 24 * 3600000 ? 45 : 20
  const probTomorrow = expected.getTime() < now + 36 * 3600000 ? 82 : 50

  return NextResponse.json({
    trafico_id,
    carrier,
    prediction: {
      best_case: bestCase.toISOString(),
      expected: expected.toISOString(),
      worst_case: worstCase.toISOString(),
      baseline_hours: Math.round(baseline),
      adjusted_hours: Math.round(adjusted),
      probability_today: probToday,
      probability_tomorrow: probTomorrow,
      sample_size: hours.length,
      model_version: 'v1.0'
    }
  })
}
