#!/usr/bin/env node
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
  console.log('\n📋 FULL EVENTOS SYNC (upsert on consecutivo)')
  const conn = await mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST, port: parseInt(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER, password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38', connectTimeout: 15000
  })

  const { data: companies } = await supabase.from('companies').select('company_id, clave_cliente').eq('active', true)
  const claveMap = {}
  ;(companies || []).forEach(c => { claveMap[c.clave_cliente] = c.company_id })

  const [countRes] = await conn.execute('SELECT COUNT(*) as c FROM cb_eventos_trafico')
  const totalRows = countRes[0].c
  console.log(`Total in GlobalPC: ${totalRows.toLocaleString()}`)
  await tg(`📋 <b>Eventos full upsert</b>\n${totalRows.toLocaleString()} registros\n— CRUZ 🦀`)

  const BATCH = 10000
  let offset = 0, total = 0

  while (true) {
    const [rows] = await conn.execute(`
      SELECT e.iConsecutivo, e.sCveTrafico, e.iConsecutivoEvento,
        e.sComentarios, e.dFecha, e.sRegistradoPor, e.sRemesa,
        t.sCveCliente
      FROM cb_eventos_trafico e
      LEFT JOIN cb_trafico t ON t.sCveTrafico = e.sCveTrafico
      ORDER BY e.iConsecutivo LIMIT ${BATCH} OFFSET ${offset}
    `)
    if (!rows.length) break

    const batch = rows.map(r => ({
      consecutivo: r.iConsecutivo,
      cve_trafico: r.sCveTrafico,
      consecutivo_evento: r.iConsecutivoEvento,
      comentarios: r.sComentarios,
      fecha: r.dFecha,
      registrado_por: r.sRegistradoPor,
      remesa: r.sRemesa,
      company_id: claveMap[r.sCveCliente] || r.sCveCliente || 'unknown'
    }))

    for (let i = 0; i < batch.length; i += 1000) {
      const { error } = await supabase.from('globalpc_eventos').upsert(
        batch.slice(i, i + 1000),
        { onConflict: 'consecutivo', ignoreDuplicates: false }
      )
      if (error) console.error('\n  Upsert error at', total + i, ':', error.message.substring(0, 80))
    }

    total += rows.length
    offset += BATCH
    process.stdout.write(`\r  ${total.toLocaleString()} / ${totalRows.toLocaleString()} (${Math.round(total / totalRows * 100)}%)`)
  }

  await conn.end()
  const { count } = await supabase.from('globalpc_eventos').select('*', { count: 'exact', head: true })
  console.log(`\n✅ Done. Supabase now: ${(count || 0).toLocaleString()} rows`)
  await tg(`✅ <b>Eventos complete</b>\n${(count || 0).toLocaleString()} en Supabase\n— PORTAL 🦀`)
  return { rows_synced: count || 0 }
}

withSyncLog(supabase, { sync_type: 'globalpc_eventos_full', company_id: null }, run).catch(e => { console.error(e); process.exit(1) })
