import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })
  }

  const companyId = request.cookies.get('company_id')?.value || session.companyId
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ data: { insight: null }, error: null })
  }

  // Gather cockpit metrics from DB
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const isInternal = companyId === 'admin' || companyId === 'internal'

  let trafQuery = supabase.from('traficos')
    .select('estatus, pedimento, updated_at, fecha_cruce, company_id')
    .gte('fecha_llegada', '2024-01-01')
  if (!isInternal) trafQuery = trafQuery.eq('company_id', companyId)

  const { data: traficos } = await trafQuery.limit(2000)
  const allT = traficos || []

  const enProceso = allT.filter(t => (t.estatus || '').toLowerCase() === 'en proceso').length
  const cruzadosHoy = allT.filter(t =>
    (t.estatus || '').toLowerCase().includes('cruz') && (t.fecha_cruce || '') >= today
  ).length
  const sinPedimento = allT.filter(t =>
    (t.estatus || '').toLowerCase() === 'en proceso' && !t.pedimento
  ).length

  // Oldest urgent — traficos en proceso without pedimento
  const urgent = allT.filter(t => (t.estatus || '').toLowerCase() === 'en proceso' && !t.pedimento)
  const oldestDays = urgent.length > 0
    ? Math.round((Date.now() - Math.min(...urgent.map(t => new Date(t.updated_at || '').getTime()))) / 86400000)
    : 0

  // Company names for urgent items (broker view)
  const urgentCompanies = isInternal
    ? [...new Set(urgent.slice(0, 5).map(t => t.company_id))].join(', ')
    : ''

  const metricsText = [
    `${enProceso} traficos en proceso`,
    `${cruzadosHoy} cruzados hoy`,
    `${sinPedimento} sin pedimento`,
    oldestDays > 0 ? `el mas antiguo lleva ${oldestDays} dias` : '',
    urgentCompanies ? `clientes con urgentes: ${urgentCompanies}` : '',
  ].filter(Boolean).join('. ')

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        system: 'Eres CRUZ, sistema de inteligencia aduanal. Genera UNA frase en español (maximo 100 caracteres) sobre que debe enfocarse el operador hoy. Se especifico y accionable. Si todo esta bien, di algo positivo y breve. No uses emojis. No uses comillas.',
        messages: [{ role: 'user', content: `Metricas de hoy: ${metricsText}` }],
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return NextResponse.json({ data: { insight: null }, error: null })
    }

    const result = await response.json()
    const insight = result.content?.[0]?.text?.trim() || null

    // Log to cruz_ai_logs
    supabase.from('cruz_ai_logs').insert({
      model: 'claude-haiku-4-5-20251001',
      input_tokens: result.usage?.input_tokens || 0,
      output_tokens: result.usage?.output_tokens || 0,
      action: 'cockpit_insight',
      company_id: companyId,
    }).then(() => {}, () => {})

    return NextResponse.json({ data: { insight }, error: null })
  } catch {
    return NextResponse.json({ data: { insight: null }, error: null })
  }
}
