#!/usr/bin/env node
/**
 * scripts/post-sync-integrity.js — standalone Data Integrity Guard.
 *
 * Re-runs read-back verification against the most recent N traficos +
 * entradas without needing the original sync script's batch context.
 * Use cases:
 *   1. PM2 cron — fires every 30 min, after the delta-sync window, as a
 *      belt-and-suspenders check that the sync writer keeps writing.
 *   2. Manual smoke — `node scripts/post-sync-integrity.js` on demand
 *      when investigating a Telegram amber/red alert.
 *   3. Ship gate — invoked by scripts/ship.sh between gates 2 and 3 to
 *      catch drift introduced by a migration.
 *
 * Exit codes:
 *   0 — green (100% integrity)
 *   1 — red (tenant violation, > 1% missing, or query error)
 *   2 — amber (minor drift, < 1% missing, no tenant violations)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { runPostSyncVerification } = require('./lib/post-sync-verify')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const LOOKBACK_HOURS = parseInt(process.env.POST_SYNC_LOOKBACK_HOURS || '4', 10)
const SAMPLE_PER_TABLE = parseInt(process.env.POST_SYNC_SAMPLE || '500', 10)

async function recentPks(table, pkColumn, timestampColumn, hours, sample) {
  const sinceIso = new Date(Date.now() - hours * 3600 * 1000).toISOString()
  const { data, error } = await supabase
    .from(table)
    .select(pkColumn)
    .gte(timestampColumn, sinceIso)
    .order(timestampColumn, { ascending: false })
    .limit(sample)
  if (error) {
    console.error(`[post-sync] cannot read recent ${table}:`, error.message)
    return []
  }
  return (data || []).map(r => r[pkColumn]).filter(Boolean)
}

async function main() {
  const start = Date.now()
  console.log(`\n🔎 Post-Sync Data Integrity Guard — last ${LOOKBACK_HOURS}h, sample ${SAMPLE_PER_TABLE}/table`)

  const { data: companies, error: companiesErr } = await supabase
    .from('companies')
    .select('company_id')
    .eq('active', true)
  if (companiesErr || !companies) {
    console.error('Cannot load active companies:', companiesErr?.message)
    process.exit(1)
  }
  const companyIds = new Set(companies.map(c => c.company_id).filter(Boolean))
  console.log(`  Active company allowlist: ${companyIds.size}`)

  const [traficoPks, entradaPks] = await Promise.all([
    recentPks('traficos', 'trafico', 'updated_at', LOOKBACK_HOURS, SAMPLE_PER_TABLE),
    recentPks('entradas', 'cve_entrada', 'updated_at', LOOKBACK_HOURS, SAMPLE_PER_TABLE),
  ])
  console.log(`  Sampled traficos: ${traficoPks.length} · entradas: ${entradaPks.length}`)

  if (traficoPks.length === 0 && entradaPks.length === 0) {
    console.log('  No recent rows to verify — nothing to do.')
    process.exit(0)
  }

  const result = await runPostSyncVerification(supabase, {
    syncType: 'post_sync_guard',
    batches: [
      ...(traficoPks.length > 0 ? [{ table: 'traficos', pkColumn: 'trafico', expectedPks: traficoPks }] : []),
      ...(entradaPks.length > 0 ? [{ table: 'entradas', pkColumn: 'cve_entrada', expectedPks: entradaPks }] : []),
    ],
    scriptName: 'post-sync-integrity',
    companyIds,
  })

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n${verdictIcon(result.verdict)} Verdict: ${result.verdict.toUpperCase()} · ${result.summary.integrity_pct}% · ${elapsed}s`)
  console.log(`   Expected: ${result.summary.expected} · Found: ${result.summary.found} · Missing: ${result.summary.missing} · Violation rows: ${result.summary.violation_rows}`)
  if (Object.keys(result.summary.violations).length > 0) {
    console.log(`   Violations: ${JSON.stringify(result.summary.violations)}`)
  }

  if (result.verdict === 'red') process.exit(1)
  if (result.verdict === 'amber') process.exit(2)
  process.exit(0)
}

function verdictIcon(v) {
  return v === 'green' ? '🟢' : v === 'amber' ? '🟡' : '🔴'
}

main().catch(err => {
  console.error('post-sync-integrity crashed:', err)
  process.exit(1)
})
