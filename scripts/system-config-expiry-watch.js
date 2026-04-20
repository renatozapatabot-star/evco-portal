#!/usr/bin/env node
/**
 * system-config-expiry-watch · daily proactive alert for stale rates.
 *
 * Cron: `0 7 * * *` (07:00 CT, runs BEFORE tito-daily-briefing at 06:30
 *       — wait, actually AFTER. Kept at 07:00 because the briefing
 *       consumes rates too; any expiry alert shows up in the next day's
 *       briefing and gives the broker a full business day to refresh.)
 *
 * Reads every row in system_config with a non-null valid_to. For each:
 *   · past expiry         → 🔴 SEV-2 — pipelines already refusing
 *   · expires ≤ 3 days    → 🟡 warning — take action this week
 *   · expires ≤ 7 days    → 🟢 heads-up — nothing urgent
 *
 * Connected to the rate-sweep hardening on 2026-04-20 (74b67db): with
 * silent-fallback to 0.16 removed, expired rates now loudly refuse to
 * calculate. This watch gives the broker 7 days of warning so that
 * refuse-path never actually fires in production.
 *
 * Fix: update the expiring row via SQL
 *   UPDATE system_config
 *      SET value = '{...}'::jsonb, valid_to = '<future date>'
 *      WHERE key = '<key>';
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { sendTelegram } = require('./lib/telegram')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const DRY_RUN = process.argv.includes('--dry-run')
const SCRIPT_NAME = 'system-config-expiry-watch'

const DAY_MS = 86_400_000
const WARN_DAYS = 7
const URGENT_DAYS = 3

function daysBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS)
}

async function main() {
  const startedAt = new Date()
  console.log(`🔔 ${SCRIPT_NAME} — ${DRY_RUN ? 'DRY RUN' : 'LIVE'} @ ${startedAt.toISOString()}`)

  const { data, error } = await supabase
    .from('system_config')
    .select('key, value, valid_to')
    .not('valid_to', 'is', null)

  if (error) {
    const msg = `🔴 <b>${SCRIPT_NAME}</b> query failed: ${error.message}`
    console.error(msg)
    await sendTelegram(msg)
    process.exit(1)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expired = []
  const urgent = []
  const heads_up = []

  for (const row of data || []) {
    const validTo = new Date(row.valid_to)
    if (isNaN(validTo.getTime())) continue
    validTo.setHours(0, 0, 0, 0)
    const days = daysBetween(today, validTo)

    if (days < 0) {
      expired.push({ key: row.key, days_overdue: -days, valid_to: row.valid_to })
    } else if (days <= URGENT_DAYS) {
      urgent.push({ key: row.key, days, valid_to: row.valid_to })
    } else if (days <= WARN_DAYS) {
      heads_up.push({ key: row.key, days, valid_to: row.valid_to })
    }
  }

  const totalAlerts = expired.length + urgent.length + heads_up.length

  if (totalAlerts === 0) {
    console.log('✅ All system_config rows with valid_to are fresh (> 7 days).')
    if (!DRY_RUN) {
      await supabase.from('heartbeat_log').insert({
        script: SCRIPT_NAME,
        status: 'success',
        details: { rows_checked: (data || []).length, alerts: 0 },
      }).catch((e) => {
        console.warn(`[heartbeat skip] ${e?.message || e}`)
      })
    }
    return
  }

  // Build the Telegram message tiered by urgency
  const lines = []
  if (expired.length > 0) {
    lines.push(`🔴 <b>system_config EXPIRED — ${expired.length} row(s)</b>`)
    lines.push(`<i>Pipelines are refusing to calculate. Fix today.</i>`)
    for (const e of expired) {
      lines.push(`  • <code>${e.key}</code> — expired ${e.days_overdue} day${e.days_overdue === 1 ? '' : 's'} ago (valid_to ${e.valid_to})`)
    }
    lines.push('')
  }
  if (urgent.length > 0) {
    lines.push(`🟡 <b>Expires ≤ ${URGENT_DAYS} days — ${urgent.length} row(s)</b>`)
    for (const u of urgent) {
      lines.push(`  • <code>${u.key}</code> — expires in ${u.days} day${u.days === 1 ? '' : 's'} (${u.valid_to})`)
    }
    lines.push('')
  }
  if (heads_up.length > 0) {
    lines.push(`🟢 <b>Heads-up (${URGENT_DAYS} < days ≤ ${WARN_DAYS}) — ${heads_up.length} row(s)</b>`)
    for (const h of heads_up) {
      lines.push(`  • <code>${h.key}</code> — expires in ${h.days} days (${h.valid_to})`)
    }
    lines.push('')
  }
  lines.push(`<i>Fix: UPDATE system_config SET valid_to = '&lt;date&gt;' WHERE key = '&lt;key&gt;';</i>`)

  const telegramMsg = lines.join('\n')
  console.log(telegramMsg.replace(/<[^>]+>/g, ''))

  if (!DRY_RUN) {
    await sendTelegram(telegramMsg)
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME,
      status: expired.length > 0 ? 'alerted' : 'success',
      details: {
        rows_checked: (data || []).length,
        expired: expired.length,
        urgent: urgent.length,
        heads_up: heads_up.length,
        expired_keys: expired.map(e => e.key),
      },
    }).catch((e) => {
      console.warn(`[heartbeat skip] ${e?.message || e}`)
    })
  }

  // Exit 1 only if something is already expired — surfaces as cron
  // failure in pipeline-postmortem and keeps the alert loud.
  process.exit(expired.length > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME}</b> fatal: ${err.message}`)
  process.exit(1)
})
