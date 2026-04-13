import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST — Twilio WhatsApp webhook for carrier responses
// Twilio sends form-encoded data
export async function POST(request: Request) {
  const formData = await request.formData()
  const from = formData.get('From')?.toString() || ''
  const body = (formData.get('Body')?.toString() || '').trim().toUpperCase()

  if (!from || !body) {
    return new NextResponse('OK', { status: 200 })
  }

  // Normalize phone (remove whatsapp: prefix)
  const phone = from.replace('whatsapp:', '')

  // Find the most recent dispatched message to this carrier
  const { data: dispatch } = await supabase
    .from('carrier_dispatches')
    .select('id, trafico_id, carrier_name, company_id')
    .eq('carrier_phone', phone)
    .eq('status', 'dispatched')
    .order('dispatched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!dispatch) {
    // Unknown carrier or no pending dispatch — ignore
    return new NextResponse('OK', { status: 200 })
  }

  const isConfirmed = ['SÍ', 'SI', 'YES', 'CONFIRMO', 'DISPONIBLE'].includes(body)
  const isDeclined = ['NO', 'NEGATIVO', 'NO DISPONIBLE'].includes(body)

  if (isConfirmed) {
    // Confirm this carrier
    await supabase
      .from('carrier_dispatches')
      .update({
        status: 'confirmed',
        response_text: body,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', dispatch.id)

    // Cancel other dispatches for the same embarque
    await supabase
      .from('carrier_dispatches')
      .update({ status: 'cancelled' })
      .eq('trafico_id', dispatch.trafico_id)
      .neq('id', dispatch.id)
      .eq('status', 'dispatched')

    // Update embarque with carrier info
    await supabase
      .from('traficos')
      .update({ transportista_mexicano: dispatch.carrier_name })
      .eq('trafico', dispatch.trafico_id)
      .eq('company_id', dispatch.company_id)

    // Notify via Telegram
    const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    if (TELEGRAM_TOKEN) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: '-5085543275',
          text: `🚛 <b>Transportista confirmado</b>\n${dispatch.carrier_name} aceptó ${dispatch.trafico_id}`,
          parse_mode: 'HTML',
        }),
      }).catch((err) => console.error('[carrier] telegram notify:', err.message))
    }
  } else if (isDeclined) {
    await supabase
      .from('carrier_dispatches')
      .update({ status: 'declined', response_text: body })
      .eq('id', dispatch.id)
  } else {
    // Unknown response — log it
    await supabase
      .from('carrier_dispatches')
      .update({ response_text: body })
      .eq('id', dispatch.id)
  }

  // Twilio expects 200 OK
  return new NextResponse('OK', { status: 200 })
}
