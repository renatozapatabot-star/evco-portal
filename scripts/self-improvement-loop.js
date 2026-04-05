#!/usr/bin/env node

// ============================================================
// CRUZ Self-Improvement Loop — the Karpathy flywheel
//
// Analyzes classification accuracy, learns from corrections,
// generates rules that skip API calls, tracks improvement.
//
// Run: node scripts/self-improvement-loop.js [--dry-run]
// Cron: 0 21 * * 0 (Sunday 9 PM — after shadow weekly report)
// ============================================================

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'
const RULES_PATH = path.resolve(__dirname, 'lib', 'classification-rules.json')
const MIN_CORRECTIONS_FOR_RULE = 3 // Need 3+ corrections on same pattern to create a rule
const HIGH_CONFIDENCE_THRESHOLD = 0.95
const LOW_ACCURACY_THRESHOLD = 0.90

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (DRY_RUN || !token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

function loadRules() {
  try {
    return JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'))
  } catch {
    return { version: 1, updated_at: null, rules: [], meta: { total_rules: 0 } }
  }
}

function saveRules(rulesData) {
  if (DRY_RUN) {
    console.log(`  [DRY] Would save ${rulesData.rules.length} rules`)
    return
  }
  rulesData.updated_at = new Date().toISOString()
  rulesData.meta.total_rules = rulesData.rules.length
  rulesData.meta.last_analysis = new Date().toISOString()
  fs.writeFileSync(RULES_PATH, JSON.stringify(rulesData, null, 2))
}

async function main() {
  console.log(`🧠 CRUZ Self-Improvement Loop — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log('━'.repeat(50))

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const rulesData = loadRules()
  const existingRuleKeys = new Set(rulesData.rules.map(r => r.pattern))

  // ── 1. Analyze shadow_classifications accuracy ──
  console.log('\n1. Shadow classification accuracy...')
  const { data: shadowRecent } = await supabase
    .from('shadow_classifications')
    .select('classification, confidence, staff_action, accuracy')
    .gte('created_at', weekAgo)

  const shadow = shadowRecent || []
  const totalClassified = shadow.length
  const withAccuracy = shadow.filter(s => s.accuracy != null)
  const avgAccuracy = withAccuracy.length > 0
    ? Math.round(withAccuracy.reduce((s, r) => s + (r.accuracy || 0), 0) / withAccuracy.length * 100)
    : null
  const avgConfidence = totalClassified > 0
    ? Math.round(shadow.reduce((s, r) => s + (r.confidence || 0), 0) / totalClassified * 100)
    : 0

  // Accuracy by document type
  const typeStats = {}
  for (const s of shadow) {
    const t = s.classification || 'unknown'
    if (!typeStats[t]) typeStats[t] = { total: 0, accurate: 0, sum_conf: 0 }
    typeStats[t].total++
    typeStats[t].sum_conf += (s.confidence || 0)
    if (s.accuracy != null && s.accuracy >= 0.8) typeStats[t].accurate++
  }

  const readyForAutomation = []
  const needsTraining = []
  for (const [type, stats] of Object.entries(typeStats)) {
    const avgConf = stats.sum_conf / stats.total
    if (avgConf >= HIGH_CONFIDENCE_THRESHOLD && stats.total >= 10) {
      readyForAutomation.push({ type, count: stats.total, confidence: Math.round(avgConf * 100) })
    }
    if (avgConf < LOW_ACCURACY_THRESHOLD && stats.total >= 5) {
      needsTraining.push({ type, count: stats.total, confidence: Math.round(avgConf * 100) })
    }
  }

  console.log(`  Classified: ${totalClassified}`)
  console.log(`  Avg confidence: ${avgConfidence}%`)
  console.log(`  Ready for automation: ${readyForAutomation.length} types`)
  console.log(`  Needs training: ${needsTraining.length} types`)

  // ── 2. Analyze staff corrections ──
  console.log('\n2. Staff corrections analysis...')
  const { data: corrections } = await supabase
    .from('staff_corrections')
    .select('correction_type, original_value, corrected_value, context')
    .gte('created_at', weekAgo)

  const correctionPatterns = {}
  for (const c of (corrections || [])) {
    const key = `${c.correction_type}:${c.original_value}→${c.corrected_value}`
    if (!correctionPatterns[key]) {
      correctionPatterns[key] = { count: 0, type: c.correction_type, from: c.original_value, to: c.corrected_value }
    }
    correctionPatterns[key].count++
  }

  // Generate rules from recurring corrections
  let newRules = 0
  for (const [key, pattern] of Object.entries(correctionPatterns)) {
    if (pattern.count >= MIN_CORRECTIONS_FOR_RULE && !existingRuleKeys.has(key)) {
      rulesData.rules.push({
        pattern: key,
        if_original: pattern.from,
        then_correct: pattern.to,
        correction_type: pattern.type,
        confidence: Math.min(0.99, 0.8 + (pattern.count * 0.02)),
        source: 'staff_correction',
        count: pattern.count,
        created_at: new Date().toISOString(),
      })
      newRules++
      console.log(`  + New rule: "${pattern.from}" → "${pattern.to}" (${pattern.count} corrections)`)
    }
  }

  console.log(`  Corrections this week: ${corrections?.length || 0}`)
  console.log(`  New rules generated: ${newRules}`)

  // ── 3. Cost analysis ──
  console.log('\n3. Cost analysis...')
  const { data: costs } = await supabase
    .from('api_cost_log')
    .select('cost_usd, action')
    .gte('created_at', weekAgo)
    .eq('action', 'shadow_classification')

  const totalCost = (costs || []).reduce((s, c) => s + (c.cost_usd || 0), 0)
  const costPerClassification = totalClassified > 0 ? (totalCost / totalClassified).toFixed(4) : '—'
  const rulesSkipped = rulesData.rules.length // Approximate: each rule could skip 1+ API call
  const estimatedSavings = rulesSkipped * 0.003 // ~$0.003 per skipped Sonnet call

  console.log(`  Total cost: $${totalCost.toFixed(2)}`)
  console.log(`  Cost per classification: $${costPerClassification}`)
  console.log(`  Rules that can skip API: ${rulesData.rules.length}`)
  console.log(`  Estimated monthly savings: $${(estimatedSavings * 4).toFixed(2)}`)

  // ── 4. Save updated rules ──
  if (newRules > 0) {
    rulesData.meta.from_corrections = rulesData.rules.filter(r => r.source === 'staff_correction').length
    rulesData.meta.auto_generated = rulesData.rules.filter(r => r.source === 'auto').length
    rulesData.version++
    saveRules(rulesData)
    console.log(`\n  ✅ Rules saved: ${rulesData.rules.length} total (v${rulesData.version})`)
  }

  // ── 5. Telegram report ──
  const lines = [
    `🧠 <b>CRUZ Self-Improvement — Reporte Semanal</b>`,
    ``,
    `📊 <b>Clasificación</b>`,
    `  Procesados: ${totalClassified}`,
    `  Confianza: ${avgConfidence}%`,
    avgAccuracy != null ? `  Precisión: ${avgAccuracy}%` : '',
    ``,
    readyForAutomation.length > 0 ? `✅ <b>Listos para automatizar:</b>` : '',
    ...readyForAutomation.map(r => `  • ${r.type}: ${r.confidence}% (${r.count} muestras)`),
    needsTraining.length > 0 ? `⚠️ <b>Necesitan entrenamiento:</b>` : '',
    ...needsTraining.map(r => `  • ${r.type}: ${r.confidence}% (${r.count} muestras)`),
    ``,
    `🔧 <b>Reglas</b>`,
    `  Total: ${rulesData.rules.length}`,
    `  Nuevas esta semana: ${newRules}`,
    `  Correcciones: ${corrections?.length || 0}`,
    ``,
    `💰 <b>Costo</b>`,
    `  Semana: $${totalCost.toFixed(2)} USD`,
    `  Por clasificación: $${costPerClassification}`,
    ``,
    `<i>El sistema mejora con cada corrección.</i>`,
    `— CRUZ 🦀`,
  ].filter(Boolean)

  await sendTelegram(lines.join('\n'))

  // Log to heartbeat
  await supabase.from('heartbeat_log').insert({
    script: 'self-improvement-loop',
    status: 'success',
    details: {
      classified: totalClassified,
      avg_confidence: avgConfidence,
      new_rules: newRules,
      total_rules: rulesData.rules.length,
      cost_usd: totalCost,
      dry_run: DRY_RUN,
    },
  }).then(() => {}, () => {})

  console.log(`\n✅ Self-improvement loop complete`)
  process.exit(0)
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 Self-improvement loop failed: ${err.message}`)
  process.exit(1)
})
