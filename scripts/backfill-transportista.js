#!/usr/bin/env node
/**
 * CRUZ — Backfill Transportista from GlobalPC MySQL
 *
 * Pulls carrier names from cb_trafico and updates entradas
 * where transportista fields are NULL.
 *
 * Usage:
 *   node scripts/backfill-transportista.js              # Production
 *   node scripts/backfill-transportista.js --dry-run     # Preview only
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const mysql = require('mysql2/promise')
const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')

const SCRIPT_NAME = 'backfill-transportista'
const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function sendTelegram(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function run() {
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''
  console.log(`\n🚛 ${prefix}CRUZ — Backfill Transportista`)
  console.log('═'.repeat(50))

  const conn = await mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST,
    port: Number(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER,
    password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38',
    connectTimeout: 15000,
  })

  console.log('   MySQL connected')

  // Pull carrier data from GlobalPC
  const [rows] = await conn.execute(`
    SELECT sCveTrafico, sTransportistaMexicano, sTransportistaAmericano
    FROM cb_trafico
    WHERE sTransportistaMexicano IS NOT NULL
       OR sTransportistaAmericano IS NOT NULL
  `)

  console.log(`   GlobalPC rows with transportista: ${rows.length}`)

  // Build trafico → carrier map
  const carrierMap = new Map()
  for (const r of rows) {
    carrierMap.set(r.sCveTrafico, {
      mexicano: r.sTransportistaMexicano || null,
      americano: r.sTransportistaAmericano || null,
    })
  }

  // Find entradas missing transportista
  const entradas = await fetchAll(supabase
    .from('entradas')
    .select('id, trafico, transportista_mexicano, transportista_americano')
    .not('trafico', 'is', null)
    .is('transportista_mexicano', null)
    .is('transportista_americano', null))

  console.log(`   Entradas without transportista: ${entradas.length}`)

  let updated = 0
  for (const e of entradas) {
    const carrier = carrierMap.get(e.trafico)
    if (!carrier) continue
    if (!carrier.mexicano && !carrier.americano) continue

    if (!DRY_RUN) {
      const update = {}
      if (carrier.mexicano) update.transportista_mexicano = carrier.mexicano
      if (carrier.americano) update.transportista_americano = carrier.americano
      await supabase.from('entradas').update(update).eq('id', e.id)
    }
    updated++
  }

  await conn.end()

  console.log(`\n   ${prefix}Updated: ${updated} entradas with carrier info`)

  if (updated > 0) {
    await sendTelegram(
      `🚛 <b>BACKFILL TRANSPORTISTA</b>\n${updated} entradas actualizadas con transportista\n— CRUZ 🦀`
    )
  }

  await supabase.from('pipeline_log').insert({
    step: `${SCRIPT_NAME}:complete`,
    status: updated > 0 ? 'success' : 'noop',
    input_summary: JSON.stringify({ mysql_rows: rows.length, entradas_missing: entradas.length, updated }),
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
