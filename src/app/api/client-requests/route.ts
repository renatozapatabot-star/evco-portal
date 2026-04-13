import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

/**
 * POST /api/client-requests
 * Body: { type: 'quote' | 'change', ...fields }
 *
 * Creates a quote or change request. Available to all authenticated users.
 * Sends Telegram notification to Tito for approval.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendTelegram(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID || '-5085543275'
  if (!token || process.env.TELEGRAM_SILENT === 'true') return

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    })
  } catch (e) { console.error('[client-requests] telegram send:', (e as Error).message) }
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type } = body

    if (type === 'quote') {
      const { product_description, fraccion, origin_country, estimated_value_usd, incoterm, notes } = body

      if (!product_description) {
        return NextResponse.json({ error: 'product_description required' }, { status: 400 })
      }

      const { data, error } = await supabase.from('quote_requests').insert({
        company_id: session.companyId,
        product_description,
        fraccion: fraccion || null,
        origin_country: origin_country || 'US',
        estimated_value_usd: estimated_value_usd || null,
        incoterm: incoterm || 'EXW',
        notes: notes || null,
      }).select().single()

      if (error) throw new Error(error.message)

      await sendTelegram(
        `📋 <b>Nueva solicitud de cotización</b>\n` +
        `Cliente: ${session.companyId}\n` +
        `Producto: ${product_description}\n` +
        `Fracción: ${fraccion || 'N/A'}\n` +
        `Valor est.: $${estimated_value_usd || 'N/A'} USD\n` +
        `Incoterm: ${incoterm || 'EXW'}`
      )

      return NextResponse.json({ data })
    }

    if (type === 'change') {
      const { trafico_id, change_type, description } = body

      if (!description || !change_type) {
        return NextResponse.json({ error: 'change_type and description required' }, { status: 400 })
      }

      const { data, error } = await supabase.from('change_requests').insert({
        company_id: session.companyId,
        trafico_id: trafico_id || null,
        change_type,
        description,
      }).select().single()

      if (error) throw new Error(error.message)

      await sendTelegram(
        `🔄 <b>Solicitud de cambio</b>\n` +
        `Cliente: ${session.companyId}\n` +
        `Embarque: ${trafico_id || 'General'}\n` +
        `Tipo: ${change_type}\n` +
        `${description}`
      )

      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Invalid type. Use: quote, change' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
