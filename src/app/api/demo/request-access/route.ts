import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { full_name, firm_name, patente, phone, email, notes } = body

    if (!full_name || !firm_name || !phone) {
      return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 })
    }

    // Insert lead — use operator_actions as a general log since demo_leads table may not exist
    const { error } = await supabase.from('operator_actions').insert({
      operator_id: '70bbcc9a-0548-4e20-82c9-d2c898edfd9e', // admin operator
      action_type: 'demo_lead_captured',
      payload: {
        full_name,
        firm_name,
        patente: patente || null,
        phone,
        email: email || null,
        notes: notes || null,
        source: 'demo_portal',
        ip: req.headers.get('x-forwarded-for') || null,
        timestamp: new Date().toISOString(),
      },
    })

    if (error) {
      console.error('[demo/request-access] insert failed:', error)
      return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
    }

    // Fire Telegram notification
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN
    const telegramChatId = process.env.TELEGRAM_CHAT_ID || '-5085543275'

    if (telegramToken) {
      const message = [
        '🎯 *Nuevo lead del demo*',
        '',
        `*Nombre:* ${full_name}`,
        `*Firma:* ${firm_name}`,
        patente ? `*Patente:* ${patente}` : null,
        `*WhatsApp:* ${phone}`,
        email ? `*Email:* ${email}` : null,
        notes ? `*Notas:* ${notes}` : null,
        '',
        '🔗 portal.renatozapata.com/admin',
      ].filter(Boolean).join('\n')

      fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramChatId, text: message, parse_mode: 'Markdown' }),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[demo/request-access] error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
