#!/usr/bin/env node
/**
 * Full productos sync — INSERT new rows by globalpc_folio
 * Skips rows where globalpc_folio already exists
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'
async function tg(msg) { if (!TG) return; await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' }) }).catch(() => {}) }

async function run() {
  console.log('\n📦 FULL PRODUCTOS SYNC (insert by globalpc_folio)')
  const conn = await mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST, port: parseInt(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER, password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38', connectTimeout: 15000
  })

  const { data: companies } = await supabase.from('companies').select('company_id, clave_cliente').eq('active', true)
  const claveMap = {}
  ;(companies || []).forEach(c => { claveMap[c.clave_cliente] = c.company_id })

  // Build set of existing globalpc_folios
  console.log('Loading existing globalpc_folio values...')
  const existingFolios = new Set()
  let existOffset = 0
  while (true) {
    const { data } = await supabase.from('globalpc_productos')
      .select('globalpc_folio')
      .not('globalpc_folio', 'is', null)
      .range(existOffset, existOffset + 999)
    if (!data?.length) break
    data.forEach(r => existingFolios.add(r.globalpc_folio))
    existOffset += data.length
    if (data.length < 1000) break
  }
  console.log(`Existing with globalpc_folio: ${existingFolios.size}`)

  const [countRes] = await conn.execute('SELECT COUNT(*) as c FROM cb_producto_factura')
  const totalRows = countRes[0].c
  console.log(`Total in GlobalPC: ${totalRows.toLocaleString()}`)
  await tg(`📦 <b>Productos sync</b>\n${totalRows.toLocaleString()} registros · ${existingFolios.size} existing\n— CRUZ 🦀`)

  const BATCH = 10000
  let offset = 0, total = 0, inserted = 0, skipped = 0

  while (true) {
    const [rows] = await conn.execute(`
      SELECT pf.iFolio, pf.sCveCliente, pf.sCveProveedor,
        pf.iPrecioUnitarioProducto, pf.iCantidadProducto,
        pf.sCveUMC, pf.sCvePais, pf.sMarca
      FROM cb_producto_factura pf
      ORDER BY pf.iFolio LIMIT ${BATCH} OFFSET ${offset}
    `)
    if (!rows.length) break

    // Filter to only new rows
    const newRows = rows.filter(r => !existingFolios.has(r.iFolio))
    skipped += rows.length - newRows.length

    if (newRows.length > 0) {
      const batch = newRows.map(r => ({
        globalpc_folio: r.iFolio,
        cve_cliente: r.sCveCliente,
        cve_proveedor: r.sCveProveedor,
        precio_unitario: r.iPrecioUnitarioProducto,
        umt: r.sCveUMC,
        pais_origen: r.sCvePais,
        marca: r.sMarca,
        company_id: claveMap[r.sCveCliente] || r.sCveCliente || 'unknown'
      }))

      for (let i = 0; i < batch.length; i += 200) {
        const chunk = batch.slice(i, i + 200)
        const { error, status } = await supabase.from('globalpc_productos').insert(chunk)
        if (error) {
          if (!error.message.includes('duplicate')) {
            console.error('\n  Insert error at offset', total + i, ':', error.message.substring(0, 100))
          }
          inserted -= (chunk.length) // correct count
        }
      }
      inserted += newRows.length
    }

    total += rows.length
    offset += BATCH
    process.stdout.write(`\r  ${total.toLocaleString()} scanned · ${inserted.toLocaleString()} new · ${skipped.toLocaleString()} existing`)

    if (total % 50000 < BATCH) {
      await tg(`📦 Productos: ${total.toLocaleString()} scanned · ${inserted.toLocaleString()} new`)
    }
  }

  await conn.end()
  const { count } = await supabase.from('globalpc_productos').select('*', { count: 'exact', head: true })
  console.log(`\n✅ Done. Inserted: ${inserted.toLocaleString()} · Supabase total: ${(count || 0).toLocaleString()}`)
  await tg(`✅ <b>Productos complete</b>\n+${inserted.toLocaleString()} nuevos · Total: ${(count || 0).toLocaleString()}\n— CRUZ 🦀`)
}

run().catch(e => { console.error(e); process.exit(1) })
