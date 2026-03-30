#!/usr/bin/env node
/**
 * CRUZ Expedientes Coverage Monitor
 * Runs nightly after sync via cron
 *
 * Checks:
 *   1. Counts active traficos (En Proceso + Cruzado)
 *   2. Counts traficos with at least 1 expediente document
 *   3. Calculates coverage % and compares to yesterday
 *   4. Alerts if coverage drops > 2%
 *
 * On success: logs to expediente_coverage_history
 * On drop:    red Telegram alert with coverage delta
 * On failure: red Telegram alert with error
 *
 * — CRUZ 🦀
 */

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'expedientes-monitor.js'
const COMPANY_ID = 'evco' // Scripts are exempt from hardcode rule per CLAUDE.md

function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN) { console.log('[TG]', message.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
    })
  } catch (e) {
    console.error('Telegram send error:', e.message)
  }
}

async function getYesterdayCoverage() {
  const { data, error } = await supabase
    .from('expediente_coverage_history')
    .select('coverage_pct')
    .order('date', { ascending: false })
    .limit(1)

  if (error) {
    console.warn('No previous coverage data:', error.message)
    return null
  }
  return data && data.length > 0 ? data[0].coverage_pct : null
}

async function run() {
  const timestamp = nowCST()
  console.log(`📁 CRUZ Expedientes Monitor — ${timestamp}`)

  // Step 1: Count active traficos
  const { data: activeTraficos, error: traficoErr } = await supabase
    .from('traficos')
    .select('id', { count: 'exact' })
    .eq('company_id', COMPANY_ID)
    .in('status', ['En Proceso', 'Cruzado'])

  if (traficoErr) throw new Error(`Failed to query traficos: ${traficoErr.message}`)

  const totalTraficos = activeTraficos.length

  if (totalTraficos === 0) {
    console.log('  No active traficos found. Skipping coverage check.')
    await supabase.from('heartbeat_log').insert({
      all_ok: true,
      details: { script: SCRIPT_NAME, message: 'No active traficos — skipped', timestamp }
    })
    process.exit(0)
  }

  // Step 2: Count traficos that have at least 1 expediente document
  const traficoIds = activeTraficos.map(t => t.id)

  const { data: withDocs, error: docErr } = await supabase
    .from('expediente_documentos')
    .select('trafico_id')
    .in('trafico_id', traficoIds)

  if (docErr) throw new Error(`Failed to query expediente_documentos: ${docErr.message}`)

  // Count unique trafico_ids that have documents
  const uniqueWithDocs = new Set(withDocs.map(d => d.trafico_id)).size

  // Step 3: Calculate coverage
  const coveragePct = Math.round((uniqueWithDocs / totalTraficos) * 10000) / 100

  console.log(`  Total active traficos: ${totalTraficos}`)
  console.log(`  With expediente docs:  ${uniqueWithDocs}`)
  console.log(`  Coverage:              ${coveragePct}%`)

  // Step 4: Compare to yesterday
  const yesterdayCoverage = await getYesterdayCoverage()
  const deltaPct = yesterdayCoverage !== null
    ? Math.round((coveragePct - yesterdayCoverage) * 100) / 100
    : null

  if (deltaPct !== null) {
    console.log(`  Yesterday:             ${yesterdayCoverage}%`)
    console.log(`  Delta:                 ${deltaPct > 0 ? '+' : ''}${deltaPct}%`)
  } else {
    console.log('  Yesterday:             (no prior data)')
  }

  // Step 5: Alert if drop > 2%
  if (deltaPct !== null && deltaPct < -2) {
    const msg = [
      `🔴 <b>EXPEDIENTES COVERAGE DROP</b>`,
      `${timestamp}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Coverage: <b>${coveragePct}%</b> (was ${yesterdayCoverage}%)`,
      `Delta: <b>${deltaPct}%</b> ⚠️`,
      `Active traficos: ${totalTraficos}`,
      `With docs: ${uniqueWithDocs}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `— CRUZ 🦀`
    ].join('\n')
    await sendTelegram(msg)
    console.log('  ⚠️  Coverage drop alert sent')
  } else if (deltaPct !== null && deltaPct >= 0) {
    console.log('  ✅ Coverage stable or improved')
  }

  // Step 6: Insert today's coverage record
  const today = new Date().toISOString().split('T')[0]
  const { error: insertErr } = await supabase
    .from('expediente_coverage_history')
    .insert({
      date: today,
      total_traficos: totalTraficos,
      with_expediente: uniqueWithDocs,
      coverage_pct: coveragePct,
      delta_pct: deltaPct
    })

  if (insertErr) {
    console.warn('  Failed to insert coverage history:', insertErr.message)
  } else {
    console.log('  ✅ Coverage logged to expediente_coverage_history')
  }

  // Step 7: Log success to heartbeat_log
  await supabase.from('heartbeat_log').insert({
    all_ok: true,
    details: {
      script: SCRIPT_NAME,
      total_traficos: totalTraficos,
      with_expediente: uniqueWithDocs,
      coverage_pct: coveragePct,
      delta_pct: deltaPct,
      timestamp
    }
  })

  console.log(`✅ ${SCRIPT_NAME} complete`)
  process.exit(0)
}

run().catch(async (err) => {
  console.error(`Fatal ${SCRIPT_NAME} error:`, err)
  try {
    await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>\n${err.message}\n— CRUZ 🦀`)
    await supabase.from('heartbeat_log').insert({
      all_ok: false,
      details: { script: SCRIPT_NAME, fatal: err.message }
    })
  } catch (_) { /* best effort */ }
  process.exit(1)
})
