#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'

async function tg(msg) {
  if (!TG) return
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function run() {
  console.log(`[${new Date().toISOString()}] Solicitud escalation check...`)
  const now = new Date().toISOString()

  const { data: overdue, error } = await supabase
    .from('documento_solicitudes')
    .select('*')
    .eq('status', 'solicitado')
    .lt('escalate_after', now)

  if (error) {
    console.error('Query error:', error.message)
    await tg(`🔴 solicitud-escalation FAILED: ${error.message}`)
    process.exit(1)
  }

  if (!overdue?.length) {
    console.log('No overdue solicitudes ✅')
    process.exit(0)
  }

  console.log(`Found ${overdue.length} overdue`)

  for (const s of overdue) {
    const hrs = Math.round(
      (Date.now() - new Date(s.solicitado_at).getTime()) / 3600000
    )

    await supabase.from('documento_solicitudes')
      .update({ status: 'vencida', escalated_at: now })
      .eq('id', s.id)

    await supabase.from('notifications').insert({
      company_id: s.company_id,
      type: 'solicitud_vencida',
      severity: 'critical',
      title: `Solicitud vencida — ${s.trafico_id}`,
      description: `${s.doc_type ? 1 : 0 || 0} docs sin respuesta · ${hrs}h transcurridas`,
      trafico_id: s.trafico_id,
      action_url: `/traficos/${s.trafico_id}`,
      read: false,
    })

    await tg(
      `🔴 <b>Solicitud vencida</b>\n` +
      `Tráfico: <code>${s.trafico_id}</code>\n` +
      `Docs: ${s.doc_type}\n` +
      `${hrs}h sin respuesta`
    )
  }

  console.log(`✅ ${overdue.length} escalated`)
  process.exit(0)
}

run().catch(err => {
  console.error('Fatal:', err.message)
  tg(`🔴 solicitud-escalation fatal: ${err.message}`).finally(() => process.exit(1))
})
