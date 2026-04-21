#!/usr/bin/env node
/**
 * Full productos sync — plain INSERT, no unique key
 * iFolio is NOT unique in GlobalPC (63K distinct / 315K rows)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { safeInsert } = require('./lib/safe-write')
const { withSyncLog } = require('./lib/sync-log')
// Canonical Telegram helper — handles TELEGRAM_SILENT internally (skips
// the fetch; does NOT exit the module). Previous local tg() + stray
// top-level `return` made this script a silent no-op under
// TELEGRAM_SILENT=true. Both fixed together 2026-04-20 along with the
// Block-EE `|| 'unknown'` tenant fallback (replaced by skip-and-alert).
const { sendTelegram: tg } = require('./lib/telegram')

async function run() {
  console.log('\n📦 FULL PRODUCTOS SYNC (plain insert, no unique key)')

  // Check current count
  const { count: before } = await supabase.from('globalpc_productos').select('*', { count: 'exact', head: true })
  console.log('Current Supabase count:', (before || 0).toLocaleString())

  // If already > 300K, skip
  if ((before || 0) > 300000) {
    console.log('Already synced. Skipping.')
    return
  }

  const conn = await mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST, port: parseInt(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER, password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38', connectTimeout: 15000
  })

  const { data: companies } = await supabase.from('companies').select('company_id, clave_cliente').eq('active', true)
  const claveMap = {}
  ;(companies || []).forEach(c => { claveMap[c.clave_cliente] = c.company_id })

  const [countRes] = await conn.execute('SELECT COUNT(*) as c FROM cb_producto_factura')
  const totalRows = countRes[0].c
  console.log(`GlobalPC total: ${totalRows.toLocaleString()}`)

  // Delete existing productos and re-insert fresh
  // This is cleaner than trying to deduplicate
  console.log('Clearing existing productos...')
  // Delete in batches to avoid timeout
  let deleted = 0
  while (true) {
    const { data, error } = await supabase.from('globalpc_productos').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id').limit(5000)
    if (error) { console.log('Delete error:', error.message); break }
    if (!data || data.length === 0) break
    deleted += data.length
    process.stdout.write(`\r  Deleted ${deleted.toLocaleString()}`)
  }
  console.log(`\nCleared ${deleted.toLocaleString()} rows`)

  await tg(`📦 <b>Productos full sync</b>\nCleared ${deleted.toLocaleString()} old rows\nInserting ${totalRows.toLocaleString()} from GlobalPC\n— CRUZ 🦀`)

  const BATCH = 5000
  let offset = 0, total = 0, inserted = 0, errors = 0, skippedRows = 0
  const skippedClaves = new Set()

  while (true) {
    const [rows] = await conn.execute(`
      SELECT pf.iFolio, pf.sCveCliente, pf.sCveProveedor,
        pf.iPrecioUnitarioProducto, pf.sCveUMC, pf.sCvePais, pf.sMarca
      FROM cb_producto_factura pf
      ORDER BY pf.iFolio LIMIT ${BATCH} OFFSET ${offset}
    `)
    if (!rows.length) break

    // Block EE: skip-and-alert on unknown cve_cliente instead of tagging 'unknown'.
    const batch = rows.map(r => {
      const companyId = claveMap[r.sCveCliente]
      if (!companyId) {
        skippedClaves.add(r.sCveCliente ?? '(null)')
        skippedRows++
        return null
      }
      return {
        globalpc_folio: r.iFolio,
        cve_cliente: r.sCveCliente,
        cve_proveedor: r.sCveProveedor,
        precio_unitario: r.iPrecioUnitarioProducto,
        umt: String(r.sCveUMC || ''),
        pais_origen: r.sCvePais,
        marca: r.sMarca,
        company_id: companyId,
      }
    }).filter(Boolean)

    for (let i = 0; i < batch.length; i += 200) {
      try {
        const { count } = await safeInsert(supabase, 'globalpc_productos', batch.slice(i, i + 200), {
          scriptName: 'full-sync-productos',
        })
        inserted += count
      } catch (e) {
        errors++
        if (errors <= 3) console.error('\n  Insert error:', e.message.substring(0, 100))
      }
    }

    total += rows.length
    offset += BATCH
    process.stdout.write(`\r  ${total.toLocaleString()} / ${totalRows.toLocaleString()} (${Math.round(total / totalRows * 100)}%) · ${inserted.toLocaleString()} inserted`)

    if (total % 100000 < BATCH) {
      await tg(`📦 Productos: ${total.toLocaleString()} / ${totalRows.toLocaleString()} · ${inserted.toLocaleString()} inserted`)
    }
  }

  await conn.end()

  // Wait then verify
  await new Promise(r => setTimeout(r, 3000))
  const { count: after } = await supabase.from('globalpc_productos').select('*', { count: 'exact', head: true })
  console.log(`\n✅ Done. Inserted: ${inserted.toLocaleString()} · Errors: ${errors} · Supabase total: ${(after || 0).toLocaleString()}`)

  if (skippedRows > 0) {
    const sample = Array.from(skippedClaves).slice(0, 10).join(', ')
    console.warn(`⚠ Skipped ${skippedRows} rows · ${skippedClaves.size} unknown cve_cliente: ${sample}`)
    await tg(
      `🟡 <b>Productos full-sync · skipped rows</b>\n` +
      `${skippedRows.toLocaleString()} rows · ${skippedClaves.size} unknown cve_cliente\n` +
      `<code>${sample}${skippedClaves.size > 10 ? `, …${skippedClaves.size - 10} more` : ''}</code>`
    )
  }
  await tg(`✅ <b>Productos complete</b>\n${(after || 0).toLocaleString()} rows in Supabase${skippedRows > 0 ? ` · ${skippedRows} skipped` : ''}\n— PORTAL 🦀`)
  return { rows_synced: inserted, skipped: skippedRows }
}

withSyncLog(supabase, { sync_type: 'globalpc_productos_full', company_id: null }, run).catch(e => { console.error(e); process.exit(1) })
