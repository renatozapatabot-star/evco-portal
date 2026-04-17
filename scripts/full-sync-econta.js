#!/usr/bin/env node
/**
 * Full e-Conta sync from MySQL port 33035
 * Pulls all tables into Supabase econta_* tables
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { safeUpsert, safeInsert } = require('./lib/safe-write')
const { withSyncLog } = require('./lib/sync-log')
const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'
async function tg(msg) { if (!TG) return; await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' }) }).catch(() => {}) }
  if (process.env.TELEGRAM_SILENT === 'true') return

// Map e-Conta MySQL tables to Supabase tables
const TABLE_MAP = [
  { mysql: 'cg_polizas_contables', supabase: 'econta_polizas', key: 'consecutivo' },
  { mysql: 'cl_cartera', supabase: 'econta_cartera', key: 'consecutivo' },
]

// New tables to sync fresh (may need Supabase tables created)
const NEW_TABLES = [
  { mysql: 'ba_anticipos', key: 'consecutivo' },
  { mysql: 'ba_egresos', key: 'consecutivo' },
  { mysql: 'ba_ingresos', key: 'consecutivo' },
  { mysql: 'cl_aplicaciones', key: 'consecutivo' },
  { mysql: 'cg_poliza_contable_detalle', key: 'consecutivo' },
  { mysql: 'factura_aa', key: 'consecutivo' },
  { mysql: 'factura_detalle_aa', key: 'consecutivo' },
]

async function syncTable(conn, mysqlTable, supabaseTable, keyCol) {
  const [countRes] = await conn.execute(`SELECT COUNT(*) as c FROM ${mysqlTable}`)
  const totalRows = countRes[0].c
  console.log(`  ${mysqlTable} → ${supabaseTable}: ${totalRows.toLocaleString()} rows`)

  if (totalRows === 0) return 0

  // Get existing count in Supabase
  const { count: existing } = await supabase.from(supabaseTable).select('*', { count: 'exact', head: true })

  // Get column names
  const [cols] = await conn.execute(`SHOW COLUMNS FROM ${mysqlTable}`)
  const colNames = cols.map(c => c.Field)

  const BATCH = 5000
  let offset = 0, total = 0

  while (true) {
    const [rows] = await conn.execute(`SELECT * FROM ${mysqlTable} LIMIT ${BATCH} OFFSET ${offset}`)
    if (!rows.length) break

    // Map rows - lowercase all column names for Supabase
    const batch = rows.map(r => {
      const mapped = {}
      for (const [k, v] of Object.entries(r)) {
        mapped[k.toLowerCase()] = v
      }
      return mapped
    })

    // safeUpsert with ignoreDuplicates:true preserves the original
    // "idempotent backfill" semantic — no fallback-insert needed because
    // the wrapper already destructures error and alerts on real failures
    // (the old fallback-insert was swallowing non-dup errors silently).
    for (let i = 0; i < batch.length; i += 500) {
      const slice = batch.slice(i, i + 500)
      await safeUpsert(supabase, supabaseTable, slice, {
        onConflict: keyCol.toLowerCase(),
        ignoreDuplicates: true,
        scriptName: 'full-sync-econta',
      })
    }

    total += rows.length
    offset += BATCH
    process.stdout.write(`\r    ${total.toLocaleString()} / ${totalRows.toLocaleString()}`)
  }

  console.log('')
  return total
}

async function run() {
  console.log('\n💰 FULL E-CONTA SYNC')
  console.log('═'.repeat(40))

  const conn = await mysql.createConnection({
    host: process.env.ECONTA_DB_HOST,
    port: parseInt(process.env.ECONTA_DB_PORT),
    user: process.env.ECONTA_DB_USER,
    password: process.env.ECONTA_DB_PASS,
    database: process.env.ECONTA_DB_NAME,
    connectTimeout: 15000
  })

  console.log('✅ e-Conta connected\n')
  await tg('💰 <b>e-Conta sync iniciado</b>\n14 tablas\n— CRUZ 🦀')

  let totalSynced = 0

  // Sync mapped tables (polizas, cartera)
  for (const { mysql: mt, supabase: st, key } of TABLE_MAP) {
    const count = await syncTable(conn, mt, st, key)
    totalSynced += count
  }

  // Sync new tables if they exist in Supabase
  for (const { mysql: mt, key } of NEW_TABLES) {
    const supabaseTable = 'econta_' + mt
    const { error } = await supabase.from(supabaseTable).select('id').limit(1)
    if (error) {
      console.log(`  ${supabaseTable}: table doesn't exist in Supabase — skipping`)
      continue
    }
    const count = await syncTable(conn, mt, supabaseTable, key)
    totalSynced += count
  }

  await conn.end()
  console.log(`\n✅ e-Conta sync complete: ${totalSynced.toLocaleString()} rows`)
  await tg(`✅ <b>e-Conta sync completo</b>\n${totalSynced.toLocaleString()} registros\n— CRUZ 🦀`)

  // Telemetry — safeInsert surfaces schema mismatches (scrape_runs columns
  // may not match this payload) instead of the old silent swallow.
  try {
    await safeInsert(supabase, 'scrape_runs', {
      source: 'econta_full',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      records_found: totalSynced,
      records_new: totalSynced,
      status: 'success'
    }, { scriptName: 'full-sync-econta' })
  } catch { /* telemetry — safeInsert already alerted */ }
}

withSyncLog(supabase, { sync_type: 'econta_full', company_id: null }, run).catch(e => { console.error(e); process.exit(1) })
