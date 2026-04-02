#!/usr/bin/env node
/**
 * CRUZ Risk Scorer
 * No AI needed — pure logic from traficos data.
 *
 * Runs every 2 hours via pm2. Scores active tráficos by age, value, and semáforo.
 *
 * Risk levels:
 *   0-20:  low
 *   21-40: elevated
 *   41-70: high
 *   71+:   critical
 *
 * Usage: node scripts/risk-scorer.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'risk-scorer'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'
// EVCO-specific — not a multi-client pattern
const COMPANY_ID = 'evco'
const PORTAL_DATE_FROM = '2024-01-01'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── Helpers ────────────────────────────────────────────────

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', msg.replace(/<[^>]+>/g, '')); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
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

function daysSince(dateStr) {
  if (!dateStr) return 0
  return (Date.now() - new Date(dateStr).getTime()) / 86400000
}

function riskLevel(score) {
  if (score >= 71) return 'critical'
  if (score >= 41) return 'high'
  if (score >= 21) return 'elevated'
  return 'low'
}

// ─── Scoring ────────────────────────────────────────────────

function scoreTrafico(t) {
  const days = daysSince(t.fecha_llegada)
  let score = 0
  const reasons = []

  // Age-based scoring (highest tier only — they're cumulative tiers)
  if (days > 30) {
    score += 40
    reasons.push(`+40 — ${Math.floor(days)} días (>30)`)
  } else if (days > 14) {
    score += 30
    reasons.push(`+30 — ${Math.floor(days)} días (>14)`)
  } else if (days > 7) {
    score += 20
    reasons.push(`+20 — ${Math.floor(days)} días (>7)`)
  }

  // High value
  if ((t.importe_total || 0) > 50000) {
    score += 20
    reasons.push(`+20 — importe $${(t.importe_total).toLocaleString()}`)
  }

  // Semáforo rojo (semaforo = 1 means rojo in the DB)
  if (Number(t.semaforo) === 1) {
    score += 10
    reasons.push('+10 — semáforo rojo')
  }

  // No pedimento and >5 days
  if (!t.pedimento && days > 5) {
    score += 10
    reasons.push(`+10 — sin pedimento, ${Math.floor(days)} días`)
  }

  return {
    score: Math.min(score, 100),
    level: riskLevel(score),
    reasons,
    days: Math.floor(days)
  }
}

// ─── Main ───────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`\n🎯 CRUZ Risk Scorer`)
  console.log(`   Company: ${COMPANY_ID}`)
  console.log('═'.repeat(50))

  // 1. Fetch active tráficos
  const { data: traficos, error: fetchErr } = await supabase
    .from('traficos')
    .select('id, trafico, estatus, pedimento, fecha_llegada, importe_total, semaforo, score_reasons')
    .eq('company_id', COMPANY_ID)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .not('estatus', 'in', '("Cruzado","Entregado")')

  if (fetchErr) throw new Error(`Failed to fetch traficos: ${fetchErr.message}`)

  if (!traficos?.length) {
    console.log('   No active tráficos found')
    await logPipeline('run', 'success', { scored: 0 }, Date.now() - startTime)
    return
  }

  console.log(`   Active tráficos: ${traficos.length}`)

  // 2. Score each tráfico
  const results = []
  let newCritical = 0
  let highOver3Days = 0
  const criticalLines = []

  for (const t of traficos) {
    const { score, level, reasons, days } = scoreTrafico(t)
    const prevReasons = t.score_reasons || {}
    const prevLevel = prevReasons.level || 'low'

    results.push({
      id: t.id,
      trafico: t.trafico,
      score,
      level,
      reasons,
      days,
      importe_total: t.importe_total,
      justBecameCritical: level === 'critical' && prevLevel !== 'critical',
      highOver3Days: level === 'high' && prevReasons.level === 'high' && (prevReasons.high_since ? daysSince(prevReasons.high_since) > 3 : false)
    })

    if (results[results.length - 1].justBecameCritical) newCritical++
    if (results[results.length - 1].highOver3Days) highOver3Days++
  }

  // 3. Update traficos table
  let updateErrors = 0
  for (const r of results) {
    const scoreReasons = {
      score: r.score,
      level: r.level,
      reasons: r.reasons,
      scored_at: new Date().toISOString(),
      ...(r.level === 'high' && {
        high_since: (r.level === 'high' && r.highOver3Days) ? undefined : new Date().toISOString()
      })
    }

    // Preserve high_since if already high
    const existing = traficos.find(t => t.id === r.id)
    if (existing?.score_reasons?.high_since && r.level === 'high') {
      scoreReasons.high_since = existing.score_reasons.high_since
    }

    const { error } = await supabase
      .from('traficos')
      .update({ score_reasons: scoreReasons })
      .eq('id', r.id)

    if (error) {
      console.error(`   ⚠️  Update failed for ${r.trafico}: ${error.message}`)
      updateErrors++
    }
  }

  // 4. Insert notifications for new critical or prolonged high
  const notifyBatch = []

  for (const r of results) {
    if (r.justBecameCritical) {
      notifyBatch.push({
        company_id: COMPANY_ID,
        type: 'risk_critical',
        severity: 'critical',
        title: `Riesgo crítico — ${r.trafico}`,
        description: `Score ${r.score}/100 · ${r.days} días · ${r.reasons.join(', ')}`,
        trafico_id: r.trafico,
        action_url: `/traficos/${r.id}`,
        read: false
      })
      criticalLines.push(`<b>${r.trafico}</b> — ${r.days} días — $${(r.importe_total || 0).toLocaleString()}`)
    }

    if (r.highOver3Days) {
      notifyBatch.push({
        company_id: COMPANY_ID,
        type: 'risk_high_prolonged',
        severity: 'warning',
        title: `Riesgo alto sostenido — ${r.trafico}`,
        description: `Score ${r.score}/100 · ${r.days} días · alto por >3 días`,
        trafico_id: r.trafico,
        action_url: `/traficos/${r.id}`,
        read: false
      })
    }
  }

  if (notifyBatch.length > 0) {
    const { error: notifErr } = await supabase.from('notifications').insert(notifyBatch)
    if (notifErr) console.error(`   ⚠️  Notification insert error: ${notifErr.message}`)
    else console.log(`   📬 Notifications inserted: ${notifyBatch.length}`)
  }

  // 5. Telegram alert for critical tráficos
  const allCritical = results.filter(r => r.level === 'critical')
  if (allCritical.length > 0) {
    const lines = allCritical.map(r =>
      `<b>${r.trafico}</b> — ${r.days} días — $${(r.importe_total || 0).toLocaleString()}\nVer: evco-portal.vercel.app/traficos/${r.id}`
    )
    await tg(`🚨 <b>Tráficos críticos: ${allCritical.length}</b>\n\n${lines.join('\n\n')}\n\n— CRUZ 🦀`)
  }

  // 6. Summary
  const byLevel = { low: 0, elevated: 0, high: 0, critical: 0 }
  for (const r of results) byLevel[r.level]++

  const durationMs = Date.now() - startTime
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`📊 RISK SUMMARY`)
  console.log(`   Scored:    ${results.length}`)
  console.log(`   Low:       ${byLevel.low}`)
  console.log(`   Elevated:  ${byLevel.elevated}`)
  console.log(`   High:      ${byLevel.high}`)
  console.log(`   Critical:  ${byLevel.critical}`)
  if (newCritical > 0) console.log(`   🆕 New critical: ${newCritical}`)
  if (highOver3Days > 0) console.log(`   ⏳ High >3 days: ${highOver3Days}`)
  console.log(`   Errors:    ${updateErrors}`)
  console.log(`   Duration:  ${durationMs}ms`)

  await logPipeline('run', updateErrors > 0 ? 'partial' : 'success', {
    scored: results.length,
    low: byLevel.low,
    elevated: byLevel.elevated,
    high: byLevel.high,
    critical: byLevel.critical,
    new_critical: newCritical,
    high_over_3d: highOver3Days,
    update_errors: updateErrors
  }, durationMs)
}

run().catch(async (err) => {
  console.error('Fatal error:', err)
  await logPipeline('fatal', 'error', { error: err.message })
  await tg(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
