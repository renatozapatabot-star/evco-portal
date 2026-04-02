import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

const NotifySchema = z.object({
  message: z.string().min(1).max(2000),
  trafico_id: z.string().min(1),
  type: z.enum(['semaforo_rojo', 'urgente', 'documento', 'general']),
})

async function sendTG(text: string): Promise<boolean> {
  if (!TELEGRAM_TOKEN) return false
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text, parse_mode: 'HTML' }),
  })
  return res.ok
}

export async function POST(request: NextRequest) {
  // 1. Auth — broker or admin only
  const userRole = request.cookies.get('user_role')?.value
  if (!userRole) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 })
  }
  if (userRole !== 'broker' && userRole !== 'admin') {
    return NextResponse.json({ data: null, error: { code: 'FORBIDDEN', message: 'Solo brokers pueden enviar notificaciones' } }, { status: 403 })
  }

  // 2. Validate input
  const body = await request.json()
  const parsed = NotifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
    }, { status: 400 })
  }

  const { message, trafico_id, type } = parsed.data
  const companyId = request.cookies.get('company_id')?.value ?? ''

  // 3. Build Telegram message with context
  const typeLabels: Record<string, string> = {
    semaforo_rojo: '🔴 SEMÁFORO ROJO',
    urgente: '🚨 URGENTE',
    documento: '📄 DOCUMENTO',
    general: '📢 NOTIFICACIÓN',
  }
  const tgMessage = `${typeLabels[type]}\n<b>Tráfico:</b> ${trafico_id}\n<b>Cliente:</b> ${companyId}\n\n${message}\n\n— Portal CRUZ`

  // 4. Send
  const sent = await sendTG(tgMessage)

  // 5. Audit log
  await supabase.from('audit_log').insert({
    action: 'notify_telegram_sent',
    details: {
      trafico_id,
      type,
      message: message.substring(0, 500),
      company_id: companyId,
      telegram_sent: sent,
      channel: 'telegram',
    },
    actor: userRole,
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})

  if (!sent) {
    return NextResponse.json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'No se pudo enviar la notificación por Telegram' },
    }, { status: 500 })
  }

  return NextResponse.json({ data: { sent: true, trafico_id, type }, error: null })
}
