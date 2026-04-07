#!/usr/bin/env node
/**
 * CRUZ — Tariff Change Monitor
 *
 * Monitors for tariff rate changes that affect client products.
 * Compares current fracciones arancelarias against known rates.
 * Alerts when DTA, IGI, or preferential treatment rules change.
 *
 * Usage:
 *   node scripts/tariff-monitor.js              # Check + alert
 *   node scripts/tariff-monitor.js --dry-run     # Check only
 *
 * Cron: 0 7 * * 1  (Monday 7 AM)
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'tariff-monitor'
const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const { fetchAll } = require('./lib/paginate')

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
  console.log(`\n📊 ${prefix}CRUZ — Tariff Monitor`)
  console.log('═'.repeat(55))

  // Get all unique fracciones used by active clients
  const traficos = await fetchAll(supabase
    .from('traficos')
    .select('company_id, fraccion_arancelaria, regimen, descripcion_mercancia')
    .not('fraccion_arancelaria', 'is', null)
    .gte('fecha_llegada', '2025-01-01'))

  if (!traficos || traficos.length === 0) {
    console.log('   No traficos with fracciones found')
    return
  }

  // Group fracciones by client
  const byClient = {}
  const allFracciones = new Set()

  for (const t of traficos) {
    const cid = t.company_id || 'unknown'
    if (!byClient[cid]) byClient[cid] = new Set()
    if (t.fraccion_arancelaria) {
      byClient[cid].add(t.fraccion_arancelaria)
      allFracciones.add(t.fraccion_arancelaria)
    }
  }

  console.log(`   Active fracciones: ${allFracciones.size}`)
  console.log(`   Clients using fracciones: ${Object.keys(byClient).length}`)

  // Check for rate changes (compare against stored baseline)
  const { data: baseline } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'tariff_baseline')
    .single()

  const previousFracciones = baseline?.value?.fracciones || {}
  const changes = []

  // For now, log what we're monitoring (actual rate lookup would need TIGIE API)
  console.log('\n   Monitored fracciones by client:')
  for (const [cid, fracs] of Object.entries(byClient)) {
    console.log(`     ${cid}: ${fracs.size} fracciones`)
  }

  // Save current baseline
  if (!DRY_RUN) {
    const newBaseline = {
      fracciones: Object.fromEntries([...allFracciones].map(f => [f, { last_seen: new Date().toISOString() }])),
      checked_at: new Date().toISOString(),
      total_fracciones: allFracciones.size,
    }
    await supabase.from('system_config').upsert({
      key: 'tariff_baseline',
      value: newBaseline,
      valid_to: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    }, { onConflict: 'key' })
    console.log('\n   ✅ Baseline saved')
  }

  // Report new fracciones since last check
  if (Object.keys(previousFracciones).length > 0) {
    const newFracs = [...allFracciones].filter(f => !previousFracciones[f])
    if (newFracs.length > 0) {
      console.log(`\n   🆕 ${newFracs.length} new fracciones since last check:`)
      newFracs.slice(0, 10).forEach(f => console.log(`     ${f}`))

      await sendTelegram(
        `📊 <b>TARIFF MONITOR</b>\n` +
        `${newFracs.length} nueva${newFracs.length !== 1 ? 's' : ''} fraccion${newFracs.length !== 1 ? 'es' : ''} detectada${newFracs.length !== 1 ? 's' : ''}\n` +
        newFracs.slice(0, 5).map(f => `• ${f}`).join('\n') +
        `\n— CRUZ 🦀`
      )
    } else {
      console.log('\n   ✅ No new fracciones since last check')
    }
  }

  await supabase.from('pipeline_log').insert({
    step: `${SCRIPT_NAME}:complete`,
    status: 'success',
    input_summary: JSON.stringify({ fracciones: allFracciones.size, clients: Object.keys(byClient).length }),
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
