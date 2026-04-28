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
const { withSyncLog } = require('./lib/sync-log')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')
const SCRIPT_NAME = 'system-config-expiry-watch'

const DAY_MS = 86_400_000
const WARN_DAYS = 7
const URGENT_DAYS = 3

function daysBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS)
}

async function checkExpiry() {
  const startedAt = new Date()
  console.log(`🔔 ${SCRIPT_NAME} — ${DRY_RUN ? 'DRY RUN' : 'LIVE'} @ ${startedAt.toISOString()}`)

  // No `.not('valid_to', 'is', null)` filter — we want to surface
  // rows with NULL valid_to as "unguarded" so the broker can opt a
  // critical key (iva_rate, dta_rates, banxico_exchange_rate) into
  // expiry tracking. Silent NULL is the failure mode this watch is
  // supposed to prevent.
  const { data, error } = await supabase
    .from('system_config')
    .select('key, value, valid_to')

  if (error) throw new Error(`query failed: ${error.message}`)

  if (VERBOSE) {
    console.log(`\n--- system_config snapshot (${(data || []).length} rows) ---`)
    for (const row of (data || []).sort((a, b) => a.key.localeCompare(b.key))) {
      const vt = row.valid_to ?? '(null — unguarded)'
      console.log(`  ${row.key.padEnd(32)} valid_to=${vt}`)
    }
    console.log('---')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Critical keys that MUST have valid_to set (regulatory rates the
  // broker needs to refresh annually). Not exhaustive — any key can
  // carry valid_to, this list is just which ones trigger an "unguarded"
  // warning when valid_to is NULL.
  const CRITICAL_KEYS_REQUIRING_EXPIRY = [
    'iva_rate',
    'dta_rates',
    'banxico_exchange_rate',
  ]

  const expired = []
  const urgent = []
  const heads_up = []
  const unguarded = []

  for (const row of data || []) {
    if (row.valid_to == null) {
      if (CRITICAL_KEYS_REQUIRING_EXPIRY.includes(row.key)) {
        unguarded.push({ key: row.key })
      }
      continue
    }
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

  const totalAlerts = expired.length + urgent.length + heads_up.length + unguarded.length

  if (totalAlerts === 0) {
    console.log('✅ All system_config rows with valid_to are fresh (> 7 days).')
    return { rows_synced: 0, expired: 0 }
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
  if (unguarded.length > 0) {
    lines.push(`⚠️ <b>Unguarded critical rate(s) — ${unguarded.length} key(s)</b>`)
    lines.push(`<i>These rates have no valid_to — silent staleness risk. Opt in:</i>`)
    for (const u of unguarded) {
      lines.push(`  • <code>${u.key}</code> — set valid_to to enable expiry tracking`)
    }
    lines.push('')
  }
  lines.push(`<i>Fix: UPDATE system_config SET valid_to = '&lt;date&gt;' WHERE key = '&lt;key&gt;';</i>`)

  const telegramMsg = lines.join('\n')
  console.log(telegramMsg.replace(/<[^>]+>/g, ''))

  if (!DRY_RUN) {
    await sendTelegram(telegramMsg)
  }

  // Successful run that raised an alert is still a successful run for
  // sync_log. Loud-exit on expired keys is signalled to pipeline-postmortem
  // via the outer process.exit on `expired > 0`.
  return {
    rows_synced: (data || []).length,
    expired: expired.length,
  }
}

// withSyncLog opens a sync_log row, runs checkExpiry(), closes the row
// with status='success' (rows_synced from the return) or status='failed'
// (auto-fires Telegram via scripts/lib/sync-log.js's dispatch). Exit 1
// only when there are EXPIRED keys — those mean the rate refuse-path has
// fired and pipeline-postmortem must surface it. heads_up + urgent ran
// successfully, no exit-1 needed.
async function main() {
  const result = await withSyncLog(supabase, { sync_type: SCRIPT_NAME }, checkExpiry)
  if (!DRY_RUN && result?.expired > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
