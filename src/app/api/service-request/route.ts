import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function sendTG(msg: string) {
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  })
}

export async function POST(request: NextRequest) {
  const companyId = request.cookies.get('company_id')?.value
  const userRole = request.cookies.get('user_role')?.value
  if (!userRole) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { request_type, description } = await request.json()
  if (!request_type) return NextResponse.json({ error: 'request_type required' }, { status: 400 })

  const { data, error } = await supabase.from('service_requests').insert({
    company_id: companyId, request_type, description: description || '', status: 'recibido',
  }).select().single()

  if (!error) {
    await sendTG(`🔔 <b>NUEVA SOLICITUD</b>\nTipo: ${request_type}\n${description ? `Detalle: ${description.substring(0, 200)}` : ''}\nCliente: ${companyId}\n— Portal CRUZ`)
  }

  return NextResponse.json({ success: !error, id: data?.id })
}

export async function GET(request: NextRequest) {
  const companyId = request.cookies.get('company_id')?.value
  const userRole = request.cookies.get('user_role')?.value
  if (!userRole) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('service_requests')
    .select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(50)
  return NextResponse.json({ requests: data || [] })
}
