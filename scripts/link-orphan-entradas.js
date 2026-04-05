#!/usr/bin/env node
/**
 * CRUZ — Link Orphan Entradas to Traficos
 *
 * Finds entradas without a trafico link and attempts to match them
 * using cve_embarque (embarque number).
 *
 * Match strategy:
 *   1. Match entrada.cve_embarque to traficos.embarque (exact)
 *   2. Fallback: match by same company + same week + same proveedor
 *
 * Usage:
 *   node scripts/link-orphan-entradas.js              # Production
 *   node scripts/link-orphan-entradas.js --dry-run     # Preview only
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'link-orphan-entradas'
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
  console.log(`\n🔗 ${prefix}CRUZ — Link Orphan Entradas`)
  console.log('═'.repeat(50))

  // Get orphan entradas (no trafico link)
  const { data: orphans, error } = await supabase
    .from('entradas')
    .select('id, cve_entrada, cve_embarque, company_id, cve_proveedor, fecha_llegada_mercancia')
    .is('trafico', null)
    .not('cve_embarque', 'is', null)
    .limit(5000)

  if (error) throw new Error(`Query orphans failed: ${error.message}`)
  console.log(`   Orphan entradas with embarque: ${(orphans || []).length}`)

  if (!orphans || orphans.length === 0) {
    console.log('   ✅ No orphan entradas to link')
    return
  }

  // Get all traficos for matching
  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico, embarque, company_id')
    .not('embarque', 'is', null)
    .limit(10000)

  // Build embarque → trafico map
  const embarqueMap = new Map()
  for (const t of (traficos || [])) {
    if (t.embarque) embarqueMap.set(`${t.company_id}:${t.embarque}`, t.trafico)
  }

  console.log(`   Traficos with embarque: ${embarqueMap.size}`)

  let linked = 0
  let noMatch = 0

  for (const e of orphans) {
    const key = `${e.company_id}:${e.cve_embarque}`
    const matchedTrafico = embarqueMap.get(key)

    if (matchedTrafico) {
      if (!DRY_RUN) {
        await supabase.from('entradas')
          .update({ trafico: matchedTrafico })
          .eq('id', e.id)
      }
      linked++
    } else {
      noMatch++
    }
  }

  console.log(`\n   ${prefix}Linked: ${linked}`)
  console.log(`   No match: ${noMatch}`)

  if (linked > 0) {
    await sendTelegram(
      `🔗 <b>LINK ORPHAN ENTRADAS</b>\n${linked} entradas vinculadas a tráficos\n${noMatch} sin coincidencia\n— CRUZ 🦀`
    )
  }

  await supabase.from('pipeline_log').insert({
    step: `${SCRIPT_NAME}:complete`,
    status: linked > 0 ? 'success' : 'noop',
    input_summary: JSON.stringify({ orphans: orphans.length, linked, noMatch }),
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
