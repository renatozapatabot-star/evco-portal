#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { safeUpsert } = require('./lib/safe-write')
const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'
async function tg(msg) { if (!TG) return; await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' }) }).catch(() => {}) }
  if (process.env.TELEGRAM_SILENT === 'true') return

async function run() {
  console.log('\n📄 FULL FACTURAS SYNC (upsert on folio)')
  const conn = await mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST, port: parseInt(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER, password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38', connectTimeout: 15000
  })

  const { data: companies } = await supabase.from('companies').select('company_id, clave_cliente').eq('active', true)
  const claveMap = {}
  ;(companies || []).forEach(c => { claveMap[c.clave_cliente] = c.company_id })

  const [countRes] = await conn.execute('SELECT COUNT(*) as c FROM cb_factura')
  const totalRows = countRes[0].c
  console.log(`Total in GlobalPC: ${totalRows.toLocaleString()}`)
  await tg(`📄 <b>Facturas full upsert</b>\n${totalRows.toLocaleString()} registros\n— CRUZ 🦀`)

  const BATCH = 5000
  let offset = 0, total = 0

  while (true) {
    const [rows] = await conn.execute(`
      SELECT f.iFolio, f.sCveTrafico, f.sNumero, f.sCveProveedor, f.sCveCliente,
        f.iValorComercial, f.sCveMoneda, f.dFechaFacturacion, f.sCoveVucem,
        f.sCveIncoterm, f.iFlete, f.iSeguros, f.iEmbalajes
      FROM cb_factura f ORDER BY f.iFolio LIMIT ${BATCH} OFFSET ${offset}
    `)
    if (!rows.length) break

    const batch = rows.map(r => ({
      folio: r.iFolio,
      cve_trafico: r.sCveTrafico,
      cve_cliente: r.sCveCliente,
      cve_proveedor: r.sCveProveedor,
      numero: r.sNumero,
      valor_comercial: r.iValorComercial,
      moneda: r.sCveMoneda,
      fecha_facturacion: r.dFechaFacturacion,
      cove_vucem: r.sCoveVucem,
      incoterm: r.sCveIncoterm,
      flete: r.iFlete,
      seguros: r.iSeguros,
      embalajes: r.iEmbalajes,
      company_id: claveMap[r.sCveCliente] || r.sCveCliente || 'unknown',
      updated_at: new Date().toISOString()
    }))

    for (let i = 0; i < batch.length; i += 500) {
      await safeUpsert(supabase, 'globalpc_facturas', batch.slice(i, i + 500), {
        onConflict: 'folio',
        scriptName: 'full-sync-facturas',
      })
    }

    total += rows.length
    offset += BATCH
    process.stdout.write(`\r  ${total.toLocaleString()} / ${totalRows.toLocaleString()} (${Math.round(total / totalRows * 100)}%)`)
  }

  await conn.end()
  const { count } = await supabase.from('globalpc_facturas').select('*', { count: 'exact', head: true })
  console.log(`\n✅ Done. Supabase now: ${(count || 0).toLocaleString()} rows`)
  await tg(`✅ <b>Facturas complete</b>\n${(count || 0).toLocaleString()} en Supabase\n— CRUZ 🦀`)
}

run().catch(e => { console.error(e); process.exit(1) })
