#!/usr/bin/env node
/**
 * CRUZ Institutional Memory — weekly knowledge compilation
 *
 * Captures corrections, anomalies, decisions, patterns from last 7 days.
 * Promotes repeated corrections to learned_patterns.
 * Generates weekly learning digest via Telegram.
 *
 * Cron: 0 22 * * 0 (Sunday 10 PM)
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function main() {
  console.log(`🧠 Institutional Memory — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  // CAPTURE from last 7 days
  const [corrections, anomalies, decisions, patterns, agentDecisions] = await Promise.all([
    supabase.from('staff_corrections').select('*').gte('created_at', weekAgo).limit(100).then(r => r.data || []),
    supabase.from('anomaly_log').select('*').gte('created_at', weekAgo).limit(100).then(r => r.data || []),
    supabase.from('operational_decisions').select('*').gte('created_at', weekAgo).limit(200).then(r => r.data || []),
    supabase.from('learned_patterns').select('*').eq('active', true).limit(200).then(r => r.data || []),
    supabase.from('agent_decisions').select('was_correct, workflow').gte('created_at', weekAgo).not('was_correct', 'is', null).limit(500).then(r => r.data || []),
  ])

  console.log(`  Corrections: ${corrections.length}`)
  console.log(`  Anomalies: ${anomalies.length}`)
  console.log(`  Decisions: ${decisions.length}`)
  console.log(`  Active patterns: ${patterns.length}`)
  console.log(`  Agent reviewed: ${agentDecisions.length}`)

  // ORGANIZE: group corrections by pattern
  const correctionCounts = {}
  for (const c of corrections) {
    const key = `${c.correction_type || 'unknown'}:${c.original_value || ''}`
    correctionCounts[key] = (correctionCounts[key] || 0) + 1
  }

  // Promote corrections seen 2+ times to learned_patterns
  let newRules = 0
  for (const [key, count] of Object.entries(correctionCounts)) {
    if (count >= 2) {
      const [type, original] = key.split(':')
      const correction = corrections.find(c => c.original_value === original)
      if (correction && !DRY_RUN) {
        await supabase.from('learned_patterns').upsert({
          pattern_type: 'correction',
          pattern_key: `correction:${original}`,
          pattern_value: `${original} → ${correction.corrected_value} (corregido ${count}x)`,
          confidence: Math.min(0.95, 0.5 + count * 0.15),
          source: 'staff_correction',
          sample_size: count,
          last_confirmed: new Date().toISOString(),
          active: true,
        }, { onConflict: 'pattern_type,pattern_key' }).catch(() => {})
        newRules++
      }
      console.log(`  Promoted: ${original} → ${correction?.corrected_value} (${count}x)`)
    }
  }

  // Auto-confirm patterns seen in decisions with good outcomes
  let confirmedPatterns = 0
  const goodDecisions = decisions.filter(d => d.outcome_score && d.outcome_score >= 80)
  for (const p of patterns) {
    const relevant = goodDecisions.filter(d =>
      d.reasoning && d.reasoning.toLowerCase().includes(p.pattern_key.toLowerCase())
    )
    if (relevant.length >= 5 && p.confidence < 0.99) {
      if (!DRY_RUN) {
        await supabase.from('learned_patterns')
          .update({ confidence: 0.99, last_confirmed: new Date().toISOString(), sample_size: (p.sample_size || 0) + relevant.length })
          .eq('id', p.id)
      }
      confirmedPatterns++
    }
  }

  // Agent accuracy
  const agentCorrect = agentDecisions.filter(d => d.was_correct).length
  const agentAccuracy = agentDecisions.length > 0
    ? Math.round(agentCorrect / agentDecisions.length * 1000) / 10
    : 0

  // Score distribution
  const scored = decisions.filter(d => d.outcome_score !== null)
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, d) => s + (d.outcome_score || 0), 0) / scored.length)
    : 0

  // SURFACE: Telegram digest
  await tg(
    `🧠 <b>CRUZ aprendió esta semana</b>\n\n` +
    `• ${newRules} nueva(s) regla(s) promovidas\n` +
    `• ${confirmedPatterns} patrón(es) confirmado(s)\n` +
    `• ${corrections.length} correcciones humanas\n` +
    `• ${anomalies.length} anomalías detectadas\n` +
    (agentDecisions.length > 0 ? `• Precisión agente: ${agentAccuracy}%\n` : '') +
    (scored.length > 0 ? `• Score promedio: ${avgScore}/100\n` : '') +
    `• ${patterns.length} patrones activos total\n\n` +
    `— CRUZ 🧠`
  )

  console.log(`\n✅ ${newRules} rules promoted · ${confirmedPatterns} confirmed · ${patterns.length} active`)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
