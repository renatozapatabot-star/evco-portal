#!/usr/bin/env node
/**
 * CRUZ — Fix Stale Estatus
 *
 * Repairs traficos stuck as "En Proceso" that already have a pedimento number.
 * Having a pedimento means the customs declaration was filed — the operation
 * is at minimum "Pedimento Pagado", not "En Proceso".
 *
 * Rules:
 *   1. Has fecha_cruce                      → 'Cruzado'
 *   2. Has pedimento (no fecha_cruce)        → 'Pedimento Pagado'
 *
 * Safe to run repeatedly — only updates rows that need it.
 *
 * Usage:
 *   node scripts/fix-stale-estatus.js              # Production
 *   node scripts/fix-stale-estatus.js --dry-run     # Preview only
 *
 * Cron: 0 4 * * *  (4 AM nightly, after sync)
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')

const SCRIPT_NAME = 'fix-stale-estatus'
const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function sendTelegram(message) {
  if (DRY_RUN) { console.log('[TG dry-run]', message.replace(/<[^>]+>/g, '')); return }
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', message.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' }),
    })
  } catch (e) {
    console.error('Telegram error:', e.message)
  }
}

async function logPipeline(step, status, details) {
  if (DRY_RUN) return
  await supabase.from('pipeline_log').insert({
    step: `${SCRIPT_NAME}:${step}`,
    status,
    input_summary: JSON.stringify(details),
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})
}

async function run() {
  const startTime = Date.now()
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''

  console.log(`\n🔧 ${prefix}CRUZ — Fix Stale Estatus`)
  console.log('═'.repeat(55))

  let toCruzado = 0
  let toPagado = 0
  const byClient = {}

  // Rule 1: Has fecha_cruce but not Cruzado → Cruzado
  let withCruce
  try {
    withCruce = await fetchAll(supabase
      .from('traficos')
      .select('trafico, company_id, estatus, fecha_cruce')
      .not('fecha_cruce', 'is', null)
      .neq('estatus', 'Cruzado'))
  } catch (err1) {
    throw new Error(`Query 1 failed: ${err1.message}`)
  }

  for (const t of (withCruce || [])) {
    if (!DRY_RUN) {
      await supabase.from('traficos')
        .update({ estatus: 'Cruzado', updated_at: new Date().toISOString() })
        .eq('trafico', t.trafico)
    }
    toCruzado++
    byClient[t.company_id] = (byClient[t.company_id] || { cruzado: 0, pagado: 0 })
    byClient[t.company_id].cruzado++
  }

  console.log(`\n── Rule 1: fecha_cruce → Cruzado: ${toCruzado}`)

  // Rule 2: Has pedimento but still En Proceso (no fecha_cruce) → Pedimento Pagado
  // Process in batches of 1000 to handle large volumes
  let hasMore = true
  while (hasMore) {
    const { data: withPedimento, error: err2 } = await supabase
      .from('traficos')
      .select('trafico, company_id, estatus, pedimento')
      .eq('estatus', 'En Proceso')
      .not('pedimento', 'is', null)
      .is('fecha_cruce', null)
      .limit(1000)

    if (err2) throw new Error(`Query 2 failed: ${err2.message}`)
    if (!withPedimento || withPedimento.length === 0) { hasMore = false; break }

    for (const t of withPedimento) {
      if (!DRY_RUN) {
        await supabase.from('traficos')
          .update({ estatus: 'Pedimento Pagado', updated_at: new Date().toISOString() })
          .eq('trafico', t.trafico)
      }
      toPagado++
      byClient[t.company_id] = (byClient[t.company_id] || { cruzado: 0, pagado: 0 })
      byClient[t.company_id].pagado++
    }

    console.log(`   ... batch processed: ${withPedimento.length} (total so far: ${toPagado})`)
    if (DRY_RUN || withPedimento.length < 1000) hasMore = false
  }

  console.log(`── Rule 2: pedimento → Pedimento Pagado: ${toPagado}`)

  // Summary
  const total = toCruzado + toPagado
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n' + '═'.repeat(55))
  console.log(`📊 ${prefix}RESUMEN`)
  console.log(`   → Cruzado: ${toCruzado}`)
  console.log(`   → Pedimento Pagado: ${toPagado}`)
  console.log(`   Total corregidos: ${total}`)
  console.log(`   Duración: ${elapsed}s`)

  if (Object.keys(byClient).length > 0) {
    console.log('\n   Por cliente:')
    for (const [cid, counts] of Object.entries(byClient)) {
      console.log(`     ${cid}: ${counts.cruzado} cruzados, ${counts.pagado} pagados`)
    }
  }

  await logPipeline('complete', total > 0 ? 'success' : 'noop', {
    to_cruzado: toCruzado,
    to_pagado: toPagado,
    by_client: byClient,
    duration_s: parseFloat(elapsed),
  })

  if (total > 0) {
    const clientLines = Object.entries(byClient)
      .map(([cid, c]) => `  ${cid}: ${c.cruzado + c.pagado} corregidos`)
      .join('\n')

    await sendTelegram(
      `🔧 <b>FIX STALE ESTATUS</b>\n` +
      `${total} tráficos corregidos\n` +
      `→ Cruzado: ${toCruzado}\n` +
      `→ Pedimento Pagado: ${toPagado}\n` +
      clientLines +
      `\n— CRUZ 🦀`
    )
  } else {
    console.log('\n✅ Sin correcciones necesarias')
  }
}

run().catch(async (err) => {
  console.error('Fatal:', err)
  await logPipeline('fatal', 'error', { error: err.message })
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
