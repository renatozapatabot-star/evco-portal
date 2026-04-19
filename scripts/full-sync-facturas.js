#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { safeUpsert } = require('./lib/safe-write')
const { withSyncLog } = require('./lib/sync-log')
// Canonical Telegram helper — handles TELEGRAM_SILENT internally (skips
// the fetch, does NOT exit the module). Previous local tg() + stray
// top-level `return` made this script a silent no-op under
// TELEGRAM_SILENT=true. Fixed in the combined-fix pass 2026-04-20.
const { sendTelegram: tg } = require('./lib/telegram')

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
  await tg(`📄 <b>Facturas full upsert</b>\n${totalRows.toLocaleString()} registros\n— PORTAL 🦀`)

  const BATCH = 5000
  let offset = 0, total = 0, skippedRows = 0
  const skippedClaves = new Set()

  while (true) {
    const [rows] = await conn.execute(`
      SELECT f.iFolio, f.sCveTrafico, f.sNumero, f.sCveProveedor, f.sCveCliente,
        f.iValorComercial, f.sCveMoneda, f.dFechaFacturacion, f.sCoveVucem,
        f.sCveIncoterm, f.iFlete, f.iSeguros, f.iEmbalajes
      FROM cb_factura f ORDER BY f.iFolio LIMIT ${BATCH} OFFSET ${offset}
    `)
    if (!rows.length) break

    // Block EE tenant-isolation contract (.claude/rules/tenant-isolation.md):
    // rows whose sCveCliente isn't in the active companies allowlist are
    // SKIPPED, not tagged 'unknown'. Collect the skipped claves for a
    // single end-of-run Telegram alert instead of per-batch spam.
    const batch = rows.map(r => {
      const companyId = claveMap[r.sCveCliente]
      if (!companyId) {
        skippedClaves.add(r.sCveCliente ?? '(null)')
        skippedRows++
        return null
      }
      return {
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
        company_id: companyId,
        updated_at: new Date().toISOString()
      }
    }).filter(Boolean)

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

  // Block EE: alert on skipped rows (unknown cve_cliente). One summary
  // per run, not per batch. Absence of alerts == clean mapping.
  if (skippedRows > 0) {
    const sample = Array.from(skippedClaves).slice(0, 10).join(', ')
    console.warn(`⚠ Skipped ${skippedRows} rows · ${skippedClaves.size} unknown cve_cliente values: ${sample}`)
    await tg(
      `🟡 <b>Facturas full-sync · skipped rows</b>\n` +
      `${skippedRows.toLocaleString()} rows · ${skippedClaves.size} unknown cve_cliente\n` +
      `<code>${sample}${skippedClaves.size > 10 ? `, …${skippedClaves.size - 10} more` : ''}</code>\n\n` +
      `Per tenant-isolation.md — add these claves to companies + re-run, OR confirm they're stale.`
    )
  }
  await tg(`✅ <b>Facturas complete</b>\n${(count || 0).toLocaleString()} en Supabase · ${total.toLocaleString()} synced${skippedRows > 0 ? ` · ${skippedRows} skipped` : ''}\n— PORTAL 🦀`)
  return { rows_synced: total, skipped: skippedRows }
}

withSyncLog(supabase, { sync_type: 'globalpc_facturas_full', company_id: null }, run).catch(e => { console.error(e); process.exit(1) })
