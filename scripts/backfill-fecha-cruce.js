#!/usr/bin/env node
/**
 * CRUZ — Backfill fecha_cruce from GlobalPC MySQL
 *
 * Pulls crossing dates from cb_trafico.dFechaCruce and updates
 * Supabase traficos where fecha_cruce is NULL.
 * Also advances estatus to 'Cruzado' when fecha_cruce is set.
 *
 * Usage:
 *   node scripts/backfill-fecha-cruce.js              # Production
 *   node scripts/backfill-fecha-cruce.js --dry-run     # Preview only
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const mysql = require('mysql2/promise')
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'backfill-fecha-cruce'
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
  console.log(`\n📅 ${prefix}CRUZ — Backfill fecha_cruce`)
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

  // Pull all traficos with crossing dates from GlobalPC
  const [rows] = await conn.execute(
    'SELECT sCveTrafico, dFechaCruce FROM cb_trafico WHERE dFechaCruce IS NOT NULL AND dFechaCruce > "2020-01-01"'
  )

  console.log(`   GlobalPC rows with fecha_cruce: ${rows.length}`)

  // Find Supabase traficos missing fecha_cruce
  const { data: missing } = await supabase
    .from('traficos')
    .select('trafico')
    .is('fecha_cruce', null)
    .limit(10000)

  const missingSet = new Set((missing || []).map(t => t.trafico))
  console.log(`   Supabase traficos without fecha_cruce: ${missingSet.size}`)

  // Match and update
  let updated = 0
  for (const row of rows) {
    const traficoId = row.sCveTrafico
    if (!missingSet.has(traficoId)) continue

    if (!DRY_RUN) {
      await supabase.from('traficos').update({
        fecha_cruce: row.dFechaCruce,
        estatus: 'Cruzado',
        updated_at: new Date().toISOString(),
      }).eq('trafico', traficoId)
    }
    updated++
  }

  await conn.end()

  console.log(`\n   ${prefix}Updated: ${updated} traficos`)

  if (updated > 0) {
    await sendTelegram(
      `📅 <b>BACKFILL fecha_cruce</b>\n${updated} traficos actualizados con fecha de cruce\n— CRUZ 🦀`
    )
  }

  await supabase.from('pipeline_log').insert({
    step: `${SCRIPT_NAME}:complete`,
    status: updated > 0 ? 'success' : 'noop',
    input_summary: JSON.stringify({ updated, mysql_rows: rows.length, missing: missingSet.size }),
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
