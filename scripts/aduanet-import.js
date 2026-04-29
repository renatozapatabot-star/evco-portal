#!/usr/bin/env node
/**
 * aduanet-import.js — Import pedimentos from CSV/Excel exported by Tito from aduanetm3.net
 *
 * Usage: node scripts/aduanet-import.js imports/pedimentos.xlsx
 *        node scripts/aduanet-import.js imports/pedimentos.csv
 *
 * Expects columns (flexible matching — Spanish or English headers):
 *   pedimento, fecha_pago/fecha, valor_usd/valor/importe,
 *   referencia, dta, igi, iva, proveedor
 *
 * Upserts to aduanet_facturas on (pedimento, clave_cliente).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const fs = require('fs')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'
// Default clave for rows whose XLSX has no clave_cliente column. The
// per-row clave_cliente column is preferred (see findCol below) — this
// fallback only matters for legacy single-client EVCO exports.
const DEFAULT_CLAVE = '9254'

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TG) return console.log('[TG]', msg)
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

// Match a column header to one of several possible names
function findCol(headers, ...candidates) {
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
  for (const c of candidates) {
    const idx = headers.findIndex(h => norm(h).includes(norm(c)))
    if (idx >= 0) return headers[idx]
  }
  return null
}

function parseNum(v) {
  if (v == null || v === '') return null
  const n = parseFloat(String(v).replace(/[,$\s]/g, ''))
  return isNaN(n) ? null : n
}

function parseDate(v) {
  if (!v) return null
  // Excel serial date
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(v).trim()
  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  // YYYY-MM-DD (already ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
  return null
}

async function run() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: node scripts/aduanet-import.js <file.csv|file.xlsx>')
    console.error('  Place export in ~/evco-portal/imports/')
    process.exit(1)
  }

  const filePath = path.resolve(file)
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  console.log(`\n📋 ADUANET IMPORT — ${path.basename(filePath)}`)

  // Read file
  const wb = XLSX.readFile(filePath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  if (rows.length === 0) {
    console.error('No data rows found')
    process.exit(1)
  }

  console.log(`Rows: ${rows.length}`)
  const headers = Object.keys(rows[0])
  console.log(`Headers: ${headers.join(', ')}`)

  // Map columns
  const colPed = findCol(headers, 'pedimento', 'num_pedimento', 'pedimento_num')
  const colFecha = findCol(headers, 'fecha_pago', 'fecha', 'date', 'fecha_pagado')
  const colValor = findCol(headers, 'valor_usd', 'valor', 'importe', 'value', 'monto')
  const colRef = findCol(headers, 'referencia', 'reference', 'ref')
  const colDta = findCol(headers, 'dta')
  const colIgi = findCol(headers, 'igi', 'arancel')
  const colIva = findCol(headers, 'iva')
  const colProv = findCol(headers, 'proveedor', 'supplier', 'provider')
  const colClave = findCol(headers, 'clave_cliente', 'cve_cliente', 'cliente', 'clave')

  if (!colPed) {
    console.error('❌ No "pedimento" column found. Headers:', headers.join(', '))
    process.exit(1)
  }
  console.log(`Mapped: pedimento="${colPed}" fecha="${colFecha}" valor="${colValor}" ref="${colRef}" dta="${colDta}" igi="${colIgi}" iva="${colIva}" prov="${colProv}" clave="${colClave}"`)

  // Build clave_cliente → company_id map from companies table — required
  // for tenant-safe imports. Per .claude/rules/tenant-isolation.md: trust
  // cve_cliente (MySQL-native), derive company_id. Never let an import
  // write company_id without resolving it through the companies allowlist.
  const { data: companiesRows } = await supabase
    .from('companies')
    .select('clave_cliente, globalpc_clave, company_id')
    .eq('active', true)
  const claveMap = {}
  for (const c of (companiesRows || [])) {
    if (c.clave_cliente) claveMap[c.clave_cliente] = c.company_id
    if (c.globalpc_clave) claveMap[c.globalpc_clave] = c.company_id
  }
  console.log(`Clave allowlist loaded: ${Object.keys(claveMap).length} active claves`)

  // Parse records — derive company_id per row from clave_cliente via the
  // active-companies allowlist. Skip + warn on unknown claves; never
  // default to 'evco' (the prior behavior mis-tagged 370 of 459 rows in
  // the 2026-03-09 dump).
  const records = []
  let skipped = 0
  let skippedUnknownClave = 0
  const unknownClaveSamples = {}
  for (const row of rows) {
    const ped = String(row[colPed] || '').trim()
    if (ped.length < 5) { skipped++; continue }

    // Per-row clave_cliente takes precedence; fall back to DEFAULT_CLAVE
    // only when the XLSX lacks the column entirely (legacy single-client).
    const rowClaveRaw = colClave ? String(row[colClave] || '').trim() : ''
    const claveCliente = rowClaveRaw || (colClave ? null : DEFAULT_CLAVE)
    if (!claveCliente) { skipped++; continue }

    const companyId = claveMap[claveCliente]
    if (!companyId) {
      skippedUnknownClave++
      unknownClaveSamples[claveCliente] = (unknownClaveSamples[claveCliente] || 0) + 1
      continue
    }

    records.push({
      pedimento: ped,
      fecha_pago: colFecha ? parseDate(row[colFecha]) : null,
      valor_usd: colValor ? parseNum(row[colValor]) : null,
      referencia: colRef ? String(row[colRef] || '').trim() || null : null,
      dta: colDta ? parseNum(row[colDta]) : null,
      igi: colIgi ? parseNum(row[colIgi]) : null,
      iva: colIva ? parseNum(row[colIva]) : null,
      proveedor: colProv ? String(row[colProv] || '').trim() || null : null,
      clave_cliente: claveCliente,
      company_id: companyId,
    })
  }

  console.log(`Parsed: ${records.length} pedimentos (${skipped} skipped, ${skippedUnknownClave} unknown clave)`)
  if (skippedUnknownClave > 0) {
    console.log('Unknown claves (not in active companies allowlist):')
    for (const [k, n] of Object.entries(unknownClaveSamples)) {
      console.log(`  ${k}: ${n} row(s)`)
    }
    await tg(`⚠️ <b>ADUANET import</b> — ${skippedUnknownClave} row(s) skipped: unknown clave_cliente. ${Object.keys(unknownClaveSamples).slice(0, 5).join(', ')}\n— CRUZ 🦀`)
  }
  if (records.length === 0) {
    console.log('Nothing to import')
    return
  }

  // Preview first 3
  console.log('\nPreview:')
  for (const r of records.slice(0, 3)) {
    console.log(`  ${r.pedimento} | ${r.fecha_pago || '?'} | $${r.valor_usd || '?'} | ${r.referencia || '-'}`)
  }

  // Insert or update — check each pedimento individually (no unique constraint on table)
  let inserted = 0, updated = 0, errors = 0
  for (const rec of records) {
    // Check if pedimento already exists for this client
    const { data: existing } = await supabase
      .from('aduanet_facturas')
      .select('id')
      .eq('pedimento', rec.pedimento)
      .eq('clave_cliente', CLAVE)
      .limit(1)

    if (existing && existing.length > 0) {
      // Update existing row
      const { error } = await supabase
        .from('aduanet_facturas')
        .update(rec)
        .eq('id', existing[0].id)
      if (error) { console.error(`  Update ${rec.pedimento}: ${error.message}`); errors++ }
      else updated++
    } else {
      // Insert new row
      const { error } = await supabase
        .from('aduanet_facturas')
        .insert(rec)
      if (error) { console.error(`  Insert ${rec.pedimento}: ${error.message}`); errors++ }
      else inserted++
    }
  }
  const saved = inserted + updated

  const summary = `${inserted} new + ${updated} updated from ${path.basename(filePath)}`
  console.log(`\n✅ ${summary}`)
  if (errors > 0) console.log(`⚠ ${errors} row(s) had errors`)

  // Log run
  await supabase.from('scrape_runs').insert({
    source: 'aduanet_import',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    status: errors > 0 ? 'partial' : 'success',
    records_found: records.length,
    records_new: saved,
    metadata: { file: path.basename(filePath), skipped, errors }
  })

  await tg(`✅ <b>ADUANET import</b>\n${summary}\n— CRUZ 🦀`)
}

run().catch(e => {
  console.error('❌', e.message)
  process.exit(1)
})
