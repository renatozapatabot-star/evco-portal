import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

async function answerCallback(callbackQueryId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const callbackQuery = body.callback_query
    if (!callbackQuery?.data) return NextResponse.json({ ok: true })

    const [action, traficoId] = callbackQuery.data.split(':')
    const callbackQueryId = callbackQuery.id

    if (action === 'approve' && traficoId) {
      // Update pedimento_drafts status
      const { error } = await supabase
        .from('pedimento_drafts')
        .update({ status: 'aprobado', reviewed_by: 'tito', reviewed_at: new Date().toISOString() })
        .eq('trafico_id', traficoId)
        .eq('status', 'borrador')

      if (error) {
        await answerCallback(callbackQueryId, 'Error al aprobar — revise en portal')
        return NextResponse.json({ ok: false, error: error.message })
      }

      // Emit workflow event
      await supabase.from('workflow_events').insert({
        workflow: 'pedimento',
        event_type: 'pedimento.approved',
        status: 'completed',
        trigger_id: traficoId,
        company_id: 'system',
        payload: { approved_by: 'tito', source: 'telegram' },
      })

      // Log decision
      await supabase.from('operational_decisions').insert({
        decision_type: 'pedimento_approval',
        description: `Pedimento aprobado vía Telegram para tráfico ${traficoId}`,
        trafico_id: traficoId,
        decided_by: 'tito',
      })

      await answerCallback(callbackQueryId, `Pedimento aprobado para ${traficoId}`)
      return NextResponse.json({ ok: true, action: 'approved', traficoId })
    }

    if (action === 'reject' && traficoId) {
      await supabase
        .from('pedimento_drafts')
        .update({ status: 'rechazado', reviewed_by: 'tito', reviewed_at: new Date().toISOString() })
        .eq('trafico_id', traficoId)
        .eq('status', 'borrador')

      await supabase.from('workflow_events').insert({
        workflow: 'pedimento',
        event_type: 'pedimento.rejected',
        status: 'completed',
        trigger_id: traficoId,
        company_id: 'system',
        payload: { rejected_by: 'tito', source: 'telegram' },
      })

      await answerCallback(callbackQueryId, `Pedimento rechazado — revise en portal`)
      return NextResponse.json({ ok: true, action: 'rejected', traficoId })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
