#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { safeUpsert } = require('./lib/safe-write')
const { withSyncLog } = require('./lib/sync-log')
// Canonical Telegram helper — handles TELEGRAM_SILENT internally.
// Previous local tg() + stray top-level `return` made this script a
// silent no-op under TELEGRAM_SILENT=true. Fixed 2026-04-20.
const { sendTelegram: tg } = require('./lib/telegram')

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
  let offset = 0, total = 0, skippedRows = 0
  const skippedClaves = new Set()

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

    // Block EE: skip-and-alert on unknown cve_cliente instead of tagging 'unknown'.
    const batch = rows.map(r => {
      const companyId = claveMap[r.sCveCliente]
      if (!companyId) {
        skippedClaves.add(r.sCveCliente ?? '(null)')
        skippedRows++
        return null
      }
      return {
        consecutivo: r.iConsecutivo,
        cve_trafico: r.sCveTrafico,
        consecutivo_evento: r.iConsecutivoEvento,
        comentarios: r.sComentarios,
        fecha: r.dFecha,
        registrado_por: r.sRegistradoPor,
        remesa: r.sRemesa,
        company_id: companyId,
      }
    }).filter(Boolean)

    for (let i = 0; i < batch.length; i += 1000) {
      // safeUpsert: error + zero-write-drift both fire Telegram.
      await safeUpsert(supabase, 'globalpc_eventos', batch.slice(i, i + 1000), {
        onConflict: 'consecutivo',
        ignoreDuplicates: false,
        scriptName: 'full-sync-eventos',
      })
    }

    total += rows.length
    offset += BATCH
    process.stdout.write(`\r  ${total.toLocaleString()} / ${totalRows.toLocaleString()} (${Math.round(total / totalRows * 100)}%)`)
  }

  await conn.end()
  const { count } = await supabase.from('globalpc_eventos').select('*', { count: 'exact', head: true })
  console.log(`\n✅ Done. Supabase now: ${(count || 0).toLocaleString()} rows`)

  if (skippedRows > 0) {
    const sample = Array.from(skippedClaves).slice(0, 10).join(', ')
    console.warn(`⚠ Skipped ${skippedRows} rows · ${skippedClaves.size} unknown cve_cliente: ${sample}`)
    await tg(
      `🟡 <b>Eventos full-sync · skipped rows</b>\n` +
      `${skippedRows.toLocaleString()} rows · ${skippedClaves.size} unknown cve_cliente\n` +
      `<code>${sample}${skippedClaves.size > 10 ? `, …${skippedClaves.size - 10} more` : ''}</code>`
    )
  }
  await tg(`✅ <b>Eventos complete</b>\n${(count || 0).toLocaleString()} en Supabase${skippedRows > 0 ? ` · ${skippedRows} skipped` : ''}\n— PORTAL 🦀`)
  return { rows_synced: count || 0, skipped: skippedRows }
}

withSyncLog(supabase, { sync_type: 'globalpc_eventos_full', company_id: null }, run).catch(e => { console.error(e); process.exit(1) })
