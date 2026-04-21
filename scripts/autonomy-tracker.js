#!/usr/bin/env node

// ============================================================
// CRUZ Autonomy Tracker — promotes/demotes action autonomy levels
// Based on accuracy over time. The boundary moves but never disappears.
// Cron: 0 22 * * * (daily 10 PM)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const { withSyncLog } = require('./lib/sync-log')

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'

const LEVEL_NAMES = ['Manual', 'Sugerencia', 'Actúa+Notifica', 'Autónomo']
const LEVEL_ICONS = ['⬜', '🟡', '🟢', '⚡']

// Promotion thresholds
const PROMOTE = {
  0: { to: 1, minPrecedents: 50 },
  1: { to: 2, minAccuracy: 0.95, minDays: 30 },
  2: { to: 3, minAccuracy: 0.99, minDays: 60 },
}

// Demotion: 2+ errors in 7 days
const DEMOTE_ERRORS = 2

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

async function main() {
  console.log(`🤖 CRUZ Autonomy Tracker — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const { data: configs } = await supabase
    .from('autonomy_config')
    .select('*')
    .order('action_type')

  if (!configs || configs.length === 0) {
    console.log('  No autonomy config found — run migration first')
    process.exit(0)
  }

  const changes = []

  for (const config of configs) {
    const { action_type, current_level, accuracy_30d, consecutive_correct, errors_7d, total_actions } = config
    let newLevel = current_level
    let reason = ''

    // pedimento_filing always stays at 0
    if (action_type === 'pedimento_filing') {
      console.log(`  ${LEVEL_ICONS[0]} ${action_type}: Level 0 (locked — no write API)`)
      continue
    }

    // Check demotion first
    if ((errors_7d || 0) >= DEMOTE_ERRORS && current_level > 0) {
      newLevel = current_level - 1
      reason = `${errors_7d} errores en 7 días → demoted`
    }
    // Check promotion
    else if (current_level === 0 && (total_actions || 0) >= 50) {
      newLevel = 1
      reason = `${total_actions} precedentes → promoted`
    } else if (current_level === 1 && (accuracy_30d || 0) >= 0.95 && (consecutive_correct || 0) >= 30) {
      newLevel = 2
      reason = `${Math.round((accuracy_30d || 0) * 100)}% accuracy, ${consecutive_correct}d consecutive → promoted`
    } else if (current_level === 2 && (accuracy_30d || 0) >= 0.99 && (consecutive_correct || 0) >= 60) {
      newLevel = 3
      reason = `${Math.round((accuracy_30d || 0) * 100)}% accuracy, ${consecutive_correct}d consecutive → promoted`
    }

    const icon = LEVEL_ICONS[newLevel] || '⬜'
    const changed = newLevel !== current_level

    if (changed) {
      changes.push({ action_type, from: current_level, to: newLevel, reason })
      if (!DRY_RUN) {
        await supabase.from('autonomy_config').update({
          current_level: newLevel,
          ...(newLevel > current_level ? { last_promotion: new Date().toISOString() } : { last_demotion: new Date().toISOString() }),
          updated_at: new Date().toISOString(),
        }).eq('action_type', action_type)
      }
    }

    const acc = accuracy_30d ? `${Math.round(accuracy_30d * 100)}%` : '—'
    console.log(`  ${icon} ${action_type.padEnd(25)} Level ${newLevel} · ${acc} accuracy · ${total_actions || 0} actions${changed ? ` ← ${reason}` : ''}`)
  }

  // Telegram
  const lines = [
    `🤖 <b>Autonomía CRUZ</b>`,
    ``,
    ...configs.map(c => {
      const icon = LEVEL_ICONS[c.current_level] || '⬜'
      return `${icon} ${c.action_type}: <b>${LEVEL_NAMES[c.current_level]}</b>`
    }),
  ]

  if (changes.length > 0) {
    lines.push(``, `📊 <b>${changes.length} cambio(s):</b>`)
    changes.forEach(c => lines.push(`  ${c.action_type}: ${LEVEL_NAMES[c.from]} → ${LEVEL_NAMES[c.to]}`))
  }

  lines.push(``, `— CRUZ 🦀`)
  await sendTelegram(lines.join('\n'))

  console.log(`\n✅ ${changes.length} level changes`)
  process.exit(0)
}

withSyncLog(supabase, { sync_type: 'autonomy_tracker', company_id: null }, main).catch(err => { console.error('Fatal:', err.message); process.exit(1) })
