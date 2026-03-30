#!/usr/bin/env node
/**
 * CRUZ Status Flow Engine
 * Automatically advances tráfico status based on events
 * Flow: En Proceso → En Bodega → Pedimento Pagado → Cruzado
 * Runs every 30 minutes
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function advanceStatuses() {
  const updates = []

  // Rule 1: Has fecha_cruce → Cruzado
  const { data: canCross } = await supabase
    .from('traficos')
    .select('trafico, estatus, fecha_cruce')
    .neq('estatus', 'Cruzado')
    .not('fecha_cruce', 'is', null)
    .limit(200)

  for (const t of canCross || []) {
    await supabase.from('traficos')
      .update({ estatus: 'Cruzado', updated_at: new Date().toISOString() })
      .eq('trafico', t.trafico)
    updates.push({ trafico: t.trafico, to: 'Cruzado' })
  }

  // Rule 2: Has pedimento + fecha_pago → Pedimento Pagado
  const { data: canPay } = await supabase
    .from('traficos')
    .select('trafico, estatus')
    .not('pedimento', 'is', null)
    .not('fecha_pago', 'is', null)
    .neq('estatus', 'Cruzado')
    .neq('estatus', 'Pedimento Pagado')
    .limit(200)

  for (const t of canPay || []) {
    await supabase.from('traficos')
      .update({ estatus: 'Pedimento Pagado', updated_at: new Date().toISOString() })
      .eq('trafico', t.trafico)
    updates.push({ trafico: t.trafico, to: 'Pedimento Pagado' })
  }

  return updates
}

async function linkEntradaCompanyIds() {
  const { data: unlinked } = await supabase
    .from('entradas')
    .select('entrada_id, cve_cliente')
    .is('company_id', null)
    .limit(500)

  if (!unlinked?.length) return 0

  const { data: companies } = await supabase
    .from('companies').select('company_id, clave_cliente')
  const claveMap = {}
  ;(companies || []).forEach(c => { claveMap[c.clave_cliente] = c.company_id })

  let linked = 0
  for (const e of unlinked) {
    const companyId = claveMap[e.cve_cliente]
    if (companyId) {
      await supabase.from('entradas')
        .update({ company_id: companyId })
        .eq('entrada_id', e.entrada_id)
      linked++
    }
  }
  return linked
}

async function run() {
  console.log('\n🔄 STATUS FLOW ENGINE')

  const [updates, linked] = await Promise.all([
    advanceStatuses(),
    linkEntradaCompanyIds()
  ])

  const crossed = updates.filter(u => u.to === 'Cruzado')
  const paid = updates.filter(u => u.to === 'Pedimento Pagado')

  console.log(`Advanced: ${updates.length} (${crossed.length} cruzados, ${paid.length} pagados)`)
  console.log(`Linked entradas: ${linked}`)

  if (crossed.length > 0) {
    await tg(
      `✅ <b>${crossed.length} tráfico(s) cruzado(s)</b>\n` +
      crossed.slice(0, 5).map(u => `• ${u.trafico}`).join('\n') +
      (crossed.length > 5 ? `\n...y ${crossed.length - 5} más` : '') +
      `\n— CRUZ 🦀`
    )
  }
}

run().catch(console.error)
