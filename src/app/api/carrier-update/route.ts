import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const VALID_STATUSES = ['recogido', 'en_ruta', 'en_puente', 'cruzando', 'cruzado', 'entregado'] as const

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Handle Telegram callback format
    const callbackData = body.callback_query?.data
    if (callbackData) {
      const [status, traficoId] = callbackData.split(':')
      if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number]) || !traficoId) {
        return NextResponse.json({ ok: true })
      }

      // Write carrier update
      await supabase.from('carrier_updates').insert({
        trafico_id: traficoId,
        company_id: 'system',
        status,
        carrier_name: body.callback_query?.from?.first_name || 'Transportista',
        source: 'telegram',
        reported_at: new Date().toISOString(),
      })

      // Emit workflow event
      const workflow = status === 'cruzado' ? 'crossing' : status === 'entregado' ? 'post_op' : 'crossing'
      await supabase.from('workflow_events').insert({
        workflow,
        event_type: `carrier.${status}`,
        status: 'completed',
        trigger_id: traficoId,
        company_id: 'system',
        payload: { carrier_status: status, source: 'telegram' },
      })

      return NextResponse.json({ ok: true, status, traficoId })
    }

    // Handle direct API call format
    const { trafico_id, status, carrier_name, company_id } = body
    if (!trafico_id || !status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    await supabase.from('carrier_updates').insert({
      trafico_id,
      company_id: company_id || 'system',
      status,
      carrier_name: carrier_name || 'API',
      source: 'api',
      reported_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
