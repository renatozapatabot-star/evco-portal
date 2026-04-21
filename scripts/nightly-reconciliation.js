#!/usr/bin/env node

// ============================================================================
// CRUZ · Nightly Reconciliation — Supabase vs GlobalPC drift detector
//
// For each active company, compares row counts in Supabase's globalpc_*
// mirror against the live GlobalPC MySQL source. Flags any table whose
// drift exceeds 1% (operational-resilience rule #6). Drift happens when
// a sync partially failed, when GlobalPC received rows after the last
// nightly sync but the delta-sync skipped them, or when an orphaned
// company_id crept in.
//
// Output: one Telegram summary per run + one sync_log row.
// Exits 1 on any table drift > 5% (SEV-2 threshold).
//
// Usage:
//   node scripts/nightly-reconciliation.js            # live run
//   node scripts/nightly-reconciliation.js --dry-run  # print only, no Telegram, no log write
//
// NOT YET IN PM2 as of 2026-04-20 — verify a dry-run passes on Throne
// before registering in ecosystem.config.js with `cron_restart: '0 3 * * *'`.
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')
const { withSyncLog } = require('./lib/sync-log')
const { sendTelegram } = require('./lib/telegram')

const DRY_RUN = process.argv.includes('--dry-run')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Tables reconciled. Each entry: { supa_table, mysql_table, key_column }.
// key_column is the GlobalPC column that maps to cve_cliente.
const CHAIN = [
  { supa: 'globalpc_productos',   mysql: 'tglproductos',        key: 'scvecliente' },
  { supa: 'globalpc_partidas',    mysql: 'tglpartidas',         key: 'scvecliente' },
  { supa: 'globalpc_facturas',    mysql: 'tglfacturas',         key: 'scvecliente' },
  { supa: 'globalpc_proveedores', mysql: 'tglproveedores',      key: 'scvecliente' },
]

// Drift thresholds (per operational-resilience.md rule #6 + sync-contract.md §2.5):
//   < 1%   — green (no action)
//   1–5%   — amber (Telegram warning)
//   > 5%   — red (Telegram alert + exit 1)
const DRIFT_AMBER = 0.01
const DRIFT_RED = 0.05

function pct(n) { return (n * 100).toFixed(2) + '%' }

async function run() {
  // Load active companies (clave_cliente → company_id mapping).
  const { data: companies, error: coErr } = await supabase
    .from('companies')
    .select('company_id, clave_cliente, name, active')
    .eq('active', true)
    .not('clave_cliente', 'is', null)
    .limit(200)
  if (coErr) throw new Error('companies load failed: ' + coErr.message)

  const mysqlConn = await mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST,
    port: Number(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER,
    password: process.env.GLOBALPC_DB_PASS,
    database: process.env.GLOBALPC_DB_NAME,
  })

  const findings = [] // { company, supa, mysql, drift, severity, table }
  let rowsChecked = 0

  for (const c of companies) {
    for (const t of CHAIN) {
      // Supabase count
      const { count: supaCount, error: supaErr } = await supabase
        .from(t.supa)
        .select('id', { count: 'exact', head: true })
        .eq('company_id', c.company_id)
      if (supaErr) {
        console.error(`[${c.company_id}/${t.supa}] supabase count failed:`, supaErr.message)
        continue
      }

      // GlobalPC count
      let mysqlCount = 0
      try {
        const [rows] = await mysqlConn.execute(
          `SELECT COUNT(*) AS n FROM ${t.mysql} WHERE ${t.key} = ?`,
          [c.clave_cliente],
        )
        mysqlCount = Number(rows?.[0]?.n ?? 0)
      } catch (e) {
        console.error(`[${c.company_id}/${t.mysql}] mysql count failed:`, e.message)
        continue
      }

      rowsChecked++
      if (mysqlCount === 0 && supaCount === 0) continue // both empty, no drift

      const drift = mysqlCount > 0
        ? Math.abs(supaCount - mysqlCount) / mysqlCount
        : supaCount > 0 ? 1 : 0

      let severity = 'green'
      if (drift >= DRIFT_RED) severity = 'red'
      else if (drift >= DRIFT_AMBER) severity = 'amber'

      if (severity !== 'green') {
        findings.push({
          company: c.company_id,
          company_name: c.name,
          table: t.supa,
          supa: supaCount ?? 0,
          mysql: mysqlCount,
          drift,
          severity,
        })
      }
    }
  }

  await mysqlConn.end()

  const amber = findings.filter((f) => f.severity === 'amber')
  const red = findings.filter((f) => f.severity === 'red')

  console.log(`\n=== Nightly Reconciliation ===`)
  console.log(`Checked: ${rowsChecked} (company × table) pairs across ${companies.length} active companies`)
  console.log(`Green:   ${rowsChecked - findings.length}`)
  console.log(`Amber:   ${amber.length}`)
  console.log(`Red:     ${red.length}`)

  if (findings.length > 0) {
    console.log(`\nFindings:`)
    for (const f of findings) {
      console.log(
        `  [${f.severity.toUpperCase()}] ${f.company} / ${f.table}: ` +
        `supa=${f.supa} mysql=${f.mysql} drift=${pct(f.drift)}`,
      )
    }
  }

  // Telegram summary — every run, even green, so silence means the job
  // actually ran (vs dying silently which is the failure mode Phase 8 prevents).
  const summary =
    red.length > 0
      ? `🔴 <b>Nightly reconciliation — ${red.length} RED</b>\n\n` +
        red.slice(0, 10).map((f) =>
          `<code>${f.company}/${f.table.replace('globalpc_', '')}</code>: supa=${f.supa} mysql=${f.mysql} drift=${pct(f.drift)}`,
        ).join('\n')
      : amber.length > 0
      ? `🟡 <b>Nightly reconciliation — ${amber.length} amber</b>\n\n` +
        amber.slice(0, 10).map((f) =>
          `<code>${f.company}/${f.table.replace('globalpc_', '')}</code>: drift=${pct(f.drift)}`,
        ).join('\n')
      : `✅ <b>Nightly reconciliation — clean</b>\n\n${rowsChecked} pairs checked, zero drift > ${pct(DRIFT_AMBER)}`

  if (DRY_RUN) {
    console.log(`\n[dry-run] would send Telegram:\n${summary.replace(/<[^>]+>/g, '')}`)
  } else {
    try { await sendTelegram(summary) } catch (e) { console.error('telegram failed:', e.message) }
  }

  // Exit non-zero on red so pm2 / cron marks the run as failed.
  return { rowsChecked, amber: amber.length, red: red.length, findings }
}

if (DRY_RUN) {
  // Dry-run: skip the withSyncLog write + just print.
  run()
    .then((r) => {
      console.log(`\n[dry-run] summary: checked=${r.rowsChecked} amber=${r.amber} red=${r.red}`)
      process.exit(r.red > 0 ? 1 : 0)
    })
    .catch((e) => {
      console.error('[dry-run] failed:', e.message)
      process.exit(1)
    })
} else {
  withSyncLog(supabase, { sync_type: 'reconciliation', company_id: null }, run)
    .then((r) => { process.exit(r.red > 0 ? 1 : 0) })
    .catch(async (err) => {
      console.error('Fatal error:', err)
      try {
        await sendTelegram(
          `🔴 <b>nightly-reconciliation FAILED</b>\n\n` +
          `<code>${String(err?.message ?? err).slice(0, 500)}</code>\n\n` +
          `Host: ${require('os').hostname()}\n` +
          `Run: ${new Date().toISOString()}`,
        )
      } catch (tgErr) {
        console.error('Telegram alert also failed:', tgErr.message)
      }
      process.exit(1)
    })
}
