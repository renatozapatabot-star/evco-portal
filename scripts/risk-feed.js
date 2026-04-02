#!/usr/bin/env node
/**
 * CRUZ Risk Feed
 * Hourly cron — detects risk escalations in active tráficos.
 *
 * Reads score_reasons JSONB from traficos, compares against risk_history,
 * and fires notifications + Telegram on escalation (elevated→high, high→critical).
 *
 * Logs to pipeline_log. Telegram on failure.
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'risk-feed'
const COMPANY_ID = process.env.COMPANY_ID || 'evco'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Helpers ──────────────────────────────────────────────────

const LEVEL_ORDER = { low: 0, elevated: 1, high: 2, critical: 3 }

function isEscalation(prev, current) {
  const p = LEVEL_ORDER[prev] ?? 0
  const c = LEVEL_ORDER[current] ?? 0
  // Only flag elevated→high and high→critical
  return (prev === 'elevated' && current === 'high') ||
         (prev === 'high' && current === 'critical')
}

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
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

async function logPipeline(step, status, details, durationMs) {
  const entry = {
    step: `${SCRIPT_NAME}:${step}`,
    status,
    input_summary: typeof details === 'string' ? details : JSON.stringify(details),
    timestamp: new Date().toISOString(),
    ...(durationMs != null && { duration_ms: durationMs }),
    ...(status === 'error' && {
      error_message: typeof details === 'object' ? (details.error || JSON.stringify(details)) : details
    })
  }
  await supabase.from('pipeline_log').insert(entry).then(({ error }) => {
    if (error) console.error('pipeline_log insert error:', error.message)
  })
}

// ── Main ─────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`\n🔍 CRUZ Risk Feed — ${new Date().toISOString()}`)
  console.log(`   Company: ${COMPANY_ID}`)

  // 1. Fetch active tráficos with score_reasons
  const { data: traficos, error: fetchErr } = await supabase
    .from('traficos')
    .select('id, trafico, score_reasons')
    .eq('company_id', COMPANY_ID)
    .not('score_reasons', 'is', null)
    .not('estatus', 'in', '("Cruzado","Entregado")')

  if (fetchErr) throw new Error(`Fetch traficos: ${fetchErr.message}`)
  console.log(`   Active tráficos with scores: ${traficos.length}`)

  if (traficos.length === 0) {
    console.log('   Nothing to process.')
    await logPipeline('run', 'success', { traficos: 0 }, Date.now() - startTime)
    return
  }

  // 2. Fetch latest risk_history for each tráfico (batch)
  const traficoNumbers = traficos.map(t => t.trafico)
  const { data: historyRows, error: histErr } = await supabase
    .from('risk_history')
    .select('trafico, risk_level, recorded_at')
    .eq('company_id', COMPANY_ID)
    .in('trafico', traficoNumbers)
    .order('recorded_at', { ascending: false })

  if (histErr) throw new Error(`Fetch risk_history: ${histErr.message}`)

  // Build map: trafico → most recent risk_level
  const prevLevels = {}
  for (const row of (historyRows || [])) {
    if (!prevLevels[row.trafico]) {
      prevLevels[row.trafico] = row.risk_level
    }
  }

  // 3. Detect escalations and update history
  let escalations = 0
  let criticalCount = 0
  const notifyBatch = []
  const historyBatch = []
  const criticalLines = []

  for (const t of traficos) {
    const currentLevel = t.score_reasons?.level || 'low'
    const prevLevel = prevLevels[t.trafico] || 'low'

    // Always record current level
    historyBatch.push({
      company_id: COMPANY_ID,
      trafico: t.trafico,
      risk_level: currentLevel,
      recorded_at: new Date().toISOString()
    })

    // Check for escalation
    if (isEscalation(prevLevel, currentLevel)) {
      escalations++
      console.log(`   ⬆️  ${t.trafico}: ${prevLevel} → ${currentLevel}`)

      notifyBatch.push({
        company_id: COMPANY_ID,
        type: 'risk_escalation',
        severity: 'high',
        title: `Riesgo escalado: ${t.trafico} → ${currentLevel}`,
        description: `Nivel anterior: ${prevLevel} · Score: ${t.score_reasons?.score || '?'}/100`,
        trafico_id: t.trafico,
        action_url: `/traficos/${t.id}`,
        read: false
      })

      if (currentLevel === 'critical') {
        criticalCount++
        criticalLines.push(
          `<b>${t.trafico}</b> — ${prevLevel} → critical\nScore: ${t.score_reasons?.score || '?'}/100`
        )
      }
    }
  }

  // 4. Insert risk_history (batch, chunks of 500)
  let historyInserted = 0
  for (let i = 0; i < historyBatch.length; i += 500) {
    const chunk = historyBatch.slice(i, i + 500)
    const { error: insErr } = await supabase.from('risk_history').upsert(chunk, { onConflict: 'company_id,trafico' })
    if (insErr) {
      console.error(`   ⚠️  risk_history insert error: ${insErr.message}`)
    } else {
      historyInserted += chunk.length
    }
  }

  // 5. Insert notifications
  if (notifyBatch.length > 0) {
    const { error: notifErr } = await supabase.from('notifications').insert(notifyBatch)
    if (notifErr) console.error(`   ⚠️  Notification insert error: ${notifErr.message}`)
    else console.log(`   📬 Notifications inserted: ${notifyBatch.length}`)
  }

  // 6. Telegram for critical escalations
  if (criticalLines.length > 0) {
    await sendTelegram(
      `🚨 <b>Escalación crítica: ${criticalLines.length} tráfico(s)</b>\n\n` +
      criticalLines.join('\n\n') +
      `\n\n— CRUZ Risk Feed 🦀`
    )
  }

  // 7. Summary
  const elapsed = Date.now() - startTime
  console.log(`\n   ✅ Done in ${elapsed}ms`)
  console.log(`   History records: ${historyInserted}`)
  console.log(`   Escalations: ${escalations}`)
  console.log(`   Critical alerts: ${criticalCount}`)

  await logPipeline('run', 'success', {
    traficos: traficos.length,
    history_inserted: historyInserted,
    escalations,
    critical: criticalCount,
    ms: elapsed
  }, elapsed)
}

run().catch(async (err) => {
  console.error('Fatal error:', err)
  await logPipeline('fatal', 'error', { error: err.message })
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
