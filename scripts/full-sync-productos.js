#!/usr/bin/env node
/**
 * Full productos sync — plain INSERT, no unique key
 * iFolio is NOT unique in GlobalPC (63K distinct / 315K rows)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { withSyncLog } = require('./lib/sync-log')
const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'
async function tg(msg) { if (!TG) return; await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' }) }).catch(() => {}) }
  if (process.env.TELEGRAM_SILENT === 'true') return

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
  let offset = 0, total = 0, inserted = 0, errors = 0

  while (true) {
    const [rows] = await conn.execute(`
      SELECT pf.iFolio, pf.sCveCliente, pf.sCveProveedor,
        pf.iPrecioUnitarioProducto, pf.sCveUMC, pf.sCvePais, pf.sMarca
      FROM cb_producto_factura pf
      ORDER BY pf.iFolio LIMIT ${BATCH} OFFSET ${offset}
    `)
    if (!rows.length) break

    const batch = rows.map(r => ({
      globalpc_folio: r.iFolio,
      cve_cliente: r.sCveCliente,
      cve_proveedor: r.sCveProveedor,
      precio_unitario: r.iPrecioUnitarioProducto,
      umt: String(r.sCveUMC || ''),
      pais_origen: r.sCvePais,
      marca: r.sMarca,
      company_id: claveMap[r.sCveCliente] || r.sCveCliente || 'unknown'
    }))

    for (let i = 0; i < batch.length; i += 200) {
      const { error } = await supabase.from('globalpc_productos').insert(batch.slice(i, i + 200))
      if (error) {
        errors++
        if (errors <= 3) console.error('\n  Insert error:', error.message.substring(0, 100))
      } else {
        inserted += Math.min(200, batch.length - i)
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
  await tg(`✅ <b>Productos complete</b>\n${(after || 0).toLocaleString()} rows in Supabase\n— PORTAL 🦀`)
  return { rows_synced: inserted }
}

withSyncLog(supabase, { sync_type: 'globalpc_productos_full', company_id: null }, run).catch(e => { console.error(e); process.exit(1) })
