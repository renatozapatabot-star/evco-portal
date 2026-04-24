#!/usr/bin/env node
/**
 * CRUZ · Daily Workflows runner.
 *
 * Standalone PM2 / cron-friendly runner for the 3 Killer Daily Driver
 * Workflows (missing NOM · high-value risk · duplicate shipment).
 *
 * Runs the same code path as the /api/cron/daily-workflows endpoint
 * but from Node so it can be chained at the end of
 * scripts/globalpc-delta-sync.js (every 5 minutes) and also run
 * independently by a dedicated PM2 process.
 *
 * Fires a Telegram alert on failure via the shared sync-log helper.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const { withSyncLog } = require('./lib/sync-log')

const SCRIPT_NAME = 'daily-workflows'

const SHADOW_MODE_COMPANIES = ['evco', 'mafesa']

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function runViaEndpoint() {
  // Prefer calling the Next.js cron endpoint so detector logic stays in
  // one place (src/lib/workflows). The endpoint requires CRON_SECRET.
  const base = (process.env.PORTAL_BASE_URL || 'https://portal.renatozapata.com').replace(/\/$/, '')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    throw new Error('CRON_SECRET env var is required')
  }

  const url = `${base}/api/cron/daily-workflows`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': secret,
    },
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Endpoint ${url} returned ${res.status}: ${text.slice(0, 400)}`)
  }

  const payload = await res.json().catch(() => null)
  return payload?.data ?? { ran_for: SHADOW_MODE_COMPANIES }
}

async function run() {
  const summary = await runViaEndpoint()
  const tally = Array.isArray(summary?.results)
    ? summary.results.reduce((acc, r) => acc + (r.upserts || 0), 0)
    : 0
  console.log(`[${SCRIPT_NAME}] completed · upserts=${tally} · tenants=${SHADOW_MODE_COMPANIES.join(',')}`)
  return { upserts: tally }
}

withSyncLog(
  supabase,
  { sync_type: 'daily_workflows', company_id: null },
  run,
).catch((err) => {
  console.error(`[${SCRIPT_NAME}] failure:`, err.message)
  process.exit(1)
})
