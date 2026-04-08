#!/usr/bin/env node
/**
 * resync-productos.js — Fix key mismatch and re-sync 189K products
 *
 * Problem: full-sync-productos.js used cb_producto_factura.iFolio as cve_producto.
 *          The correct source is cu_cliente_proveedor_producto (product catalog).
 *          iFolio belongs in the new globalpc_folio column.
 *
 * This script:
 *   1. Syncs cu_cliente_proveedor_producto → globalpc_productos (correct product keys)
 *   2. Cross-references cb_producto_factura.iFolio into globalpc_folio column
 *
 * Run: node scripts/resync-productos.js
 * Prereq: Run migrate-productos-folio.sql in Supabase SQL Editor first
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'
const BATCH = 500

// Parse command-line args
const args = process.argv.slice(2).reduce((acc, a) => {
  const m = a.match(/^--([^=]+)=(.*)$/)
  if (m) acc[m[1]] = m[2]
  return acc
}, {})

const TARGET_COMPANY_ID = args.client
const DRY_RUN = args['dry-run'] === 'true'

if (!TARGET_COMPANY_ID) {
  console.error('Usage: node scripts/resync-productos.js --client=<company_id> [--dry-run=true]')
  console.error('Example: node scripts/resync-productos.js --client=garlock --dry-run=true')
  process.exit(1)
}

// These get populated from Supabase in main(), not at module load
let TENANT_ID = null
let CLIENT_CLAVE = null
let COMPANY_ID = null

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TG) { console.log('[TG]', msg); return }
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function main() {
  const start = Date.now()
  console.log('\n📦 PRODUCTOS RE-SYNC — Fixing key mismatch')
  console.log('═'.repeat(50))

  // ── Look up target company from Supabase (active=true only) ──
  console.log('Target: --client=' + TARGET_COMPANY_ID + (DRY_RUN ? ' (DRY RUN)' : ''))

  const { data: companies, error: cErr } = await supabase
    .from('companies')
    .select('id, company_id, clave_cliente, globalpc_clave, name, active')
    .eq('company_id', TARGET_COMPANY_ID)
    .eq('active', true)

  if (cErr) {
    console.error('❌ Company lookup failed: ' + cErr.message)
    process.exit(1)
  }

  if (!companies || companies.length === 0) {
    console.error('❌ No active company found with company_id=' + TARGET_COMPANY_ID)
    console.error('   (Inactive duplicates do not count.)')
    process.exit(1)
  }

  if (companies.length > 1) {
    console.error('❌ Multiple active companies match — data hygiene issue:')
    companies.forEach(c => console.error('   - id=' + c.id + ' name=' + c.name))
    process.exit(1)
  }

  const company = companies[0]

  // Check if a tenant record exists; fall back to companies.id
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', company.company_id)
    .eq('status', 'active')
    .limit(1)

  TENANT_ID = (tenants && tenants[0]) ? tenants[0].id : company.id
  CLIENT_CLAVE = company.globalpc_clave || company.clave_cliente
  COMPANY_ID = company.company_id

  if (!CLIENT_CLAVE) {
    console.error('❌ Company ' + COMPANY_ID + ' has no globalpc_clave or clave_cliente')
    process.exit(1)
  }

  console.log('  Resolved company:')
  console.log('    name:           ' + company.name)
  console.log('    company_id:     ' + COMPANY_ID)
  console.log('    tenant_id:      ' + TENANT_ID + (tenants && tenants[0] ? ' (from tenants table)' : ' (from companies.id)'))
  console.log('    clave_cliente:  ' + company.clave_cliente)
  console.log('    globalpc_clave: ' + (company.globalpc_clave || '(null)'))
  console.log('    MySQL lookup:   sCveCliente = "' + CLIENT_CLAVE + '"')
  console.log('')

  const conn = await mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST,
    port: parseInt(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER,
    password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38',
    connectTimeout: 15000,
  })
  console.log('✅ MySQL connected')

  // ── Phase 1: Sync product catalog from cu_cliente_proveedor_producto ──
  console.log('\n── Phase 1: Product catalog (cu_cliente_proveedor_producto) ──')

  const [[{ total: catTotal }]] = await conn.query(
    `SELECT COUNT(*) as total FROM cu_cliente_proveedor_producto WHERE sCveCliente = ?`,
    [CLIENT_CLAVE]
  )
  console.log(`Catalog products in GlobalPC: ${catTotal.toLocaleString()}`)

  if (DRY_RUN) {
    // Also count description and fraccion coverage
    const [[{ withDesc }]] = await conn.query(
      "SELECT COUNT(*) as withDesc FROM cu_cliente_proveedor_producto WHERE sCveCliente = ? AND sDescripcionProductoEspanol IS NOT NULL AND sDescripcionProductoEspanol != ''",
      [CLIENT_CLAVE]
    )
    const [[{ withFrac }]] = await conn.query(
      "SELECT COUNT(*) as withFrac FROM cu_cliente_proveedor_producto WHERE sCveCliente = ? AND sCveFraccion IS NOT NULL AND sCveFraccion != ''",
      [CLIENT_CLAVE]
    )
    const { count: existingCount } = await supabase
      .from('globalpc_productos')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', COMPANY_ID)

    console.log('  with descripcion: ' + withDesc.toLocaleString() + ' (' + (catTotal > 0 ? Math.round(withDesc/catTotal*100) : 0) + '%)')
    console.log('  with fraccion:    ' + withFrac.toLocaleString() + ' (' + (catTotal > 0 ? Math.round(withFrac/catTotal*100) : 0) + '%)')
    console.log('  existing in Supabase for ' + COMPANY_ID + ': ' + (existingCount || 0).toLocaleString())
    console.log('')

    // Sample 3 rows
    const [sample] = await conn.query(
      `SELECT sCveProveedor, sCveClienteProveedorProducto, sDescripcionProductoEspanol, sCveFraccion, sCvePais, sMarca
       FROM cu_cliente_proveedor_producto WHERE sCveCliente = ? LIMIT 3`,
      [CLIENT_CLAVE]
    )
    console.log('Sample rows:')
    sample.forEach((r, i) => {
      console.log('  Row ' + (i+1) + ':')
      console.log('    cve_proveedor:  ' + r.sCveProveedor)
      console.log('    cve_producto:   ' + (r.sCveClienteProveedorProducto || '').slice(0, 50))
      console.log('    descripcion:    ' + (r.sDescripcionProductoEspanol || '<null>').slice(0, 60))
      console.log('    fraccion:       ' + (r.sCveFraccion || '<null>'))
      console.log('    pais_origen:    ' + (r.sCvePais || '<null>'))
      console.log('    marca:          ' + (r.sMarca || '<null>'))
    })

    console.log('')
    console.log('═══ DRY RUN — exiting before any writes ═══')
    await conn.end()
    process.exit(0)
  }

  let offset = 0, synced = 0, errors = 0

  while (offset < catTotal) {
    const [rows] = await conn.query(`
      SELECT
        sCveClienteProveedorProducto AS cve_producto,
        sCveCliente AS cve_cliente,
        sCveProveedor AS cve_proveedor,
        sDescripcionProductoEspanol AS descripcion,
        sDescripcionProductoIngles AS descripcion_en,
        sCveFraccion AS fraccion,
        sCveUMT AS umt,
        sCvePais AS pais_origen,
        sMarca AS marca,
        iPrecioUnitario AS precio
      FROM cu_cliente_proveedor_producto
      WHERE sCveCliente = ?
      ORDER BY sCveClienteProveedorProducto ASC
      LIMIT ? OFFSET ?
    `, [CLIENT_CLAVE, BATCH, offset])

    if (!rows.length) break

    const mapped = rows.map(r => ({
      cve_producto: r.cve_producto,
      cve_cliente: r.cve_cliente,
      cve_proveedor: r.cve_proveedor,
      descripcion: r.descripcion,
      descripcion_ingles: r.descripcion_en,
      fraccion: r.fraccion,
      umt: r.umt,
      pais_origen: r.pais_origen,
      marca: r.marca,
      precio_unitario: r.precio,
      company_id: COMPANY_ID,
      tenant_id: TENANT_ID,
    }))

    const { error } = await supabase.from('globalpc_productos').upsert(mapped, {
      onConflict: 'cve_producto,cve_cliente,cve_proveedor',
      ignoreDuplicates: false,
    })

    if (error) {
      console.error(`  ❌ Batch error at ${offset}: ${error.message}`)
      errors += rows.length
    } else {
      synced += rows.length
    }

    offset += rows.length
    if (synced % 5000 < BATCH || offset >= catTotal) {
      const pct = Math.round((offset / catTotal) * 100)
      process.stdout.write(`\r  Phase 1: ${offset.toLocaleString()} / ${catTotal.toLocaleString()} (${pct}%)`)
    }
  }
  console.log(`\n  ✅ Phase 1: ${synced.toLocaleString()} synced, ${errors} errors`)
  await tg(`📦 <b>Productos Phase 1</b>\n${synced.toLocaleString()} catálogo synced\n— CRUZ 🦀`)

  // ── Phase 2: Cross-reference cb_producto_factura.iFolio → globalpc_folio ──
  console.log('\n── Phase 2: Cross-reference invoice folios (cb_producto_factura) ──')

  const [[{ total: pfTotal }]] = await conn.query(
    `SELECT COUNT(*) as total FROM cb_producto_factura WHERE sCveCliente = ?`,
    [CLIENT_CLAVE]
  )
  console.log(`Invoice line items in GlobalPC: ${pfTotal.toLocaleString()}`)

  let pfOffset = 0, pfSynced = 0, pfErrors = 0

  while (pfOffset < pfTotal) {
    const [rows] = await conn.query(`
      SELECT
        pf.iFolio,
        pf.sCveClienteProveedorProducto AS cve_producto,
        pf.sCveCliente AS cve_cliente,
        pf.sCveProveedor AS cve_proveedor
      FROM cb_producto_factura pf
      WHERE pf.sCveCliente = ?
      ORDER BY pf.iFolio ASC
      LIMIT ? OFFSET ?
    `, [CLIENT_CLAVE, BATCH, pfOffset])

    if (!rows.length) break

    // Update globalpc_folio for matching products
    for (const r of rows) {
      if (!r.cve_producto || !r.cve_cliente) continue
      const { error } = await supabase
        .from('globalpc_productos')
        .update({ globalpc_folio: r.iFolio })
        .eq('cve_producto', r.cve_producto)
        .eq('cve_cliente', r.cve_cliente)
        .eq('cve_proveedor', r.cve_proveedor || '')

      if (error) pfErrors++
      else pfSynced++
    }

    pfOffset += rows.length
    if (pfSynced % 5000 < BATCH || pfOffset >= pfTotal) {
      const pct = Math.round((pfOffset / pfTotal) * 100)
      process.stdout.write(`\r  Phase 2: ${pfOffset.toLocaleString()} / ${pfTotal.toLocaleString()} (${pct}%)`)
    }
  }
  console.log(`\n  ✅ Phase 2: ${pfSynced.toLocaleString()} folios linked, ${pfErrors} missed`)

  await conn.end()

  // ── Summary ──
  const { count: finalCount } = await supabase
    .from('globalpc_productos')
    .select('*', { count: 'exact', head: true })

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('\n═'.repeat(50))
  console.log(`  PRODUCTOS RE-SYNC COMPLETE`)
  console.log(`  Catalog products:    ${synced.toLocaleString()}`)
  console.log(`  Folio cross-refs:    ${pfSynced.toLocaleString()}`)
  console.log(`  Total in Supabase:   ${(finalCount || 0).toLocaleString()}`)
  console.log(`  Elapsed: ${elapsed}s`)
  console.log('═'.repeat(50))

  await tg(`✅ <b>Productos re-sync complete</b>\n${(finalCount || 0).toLocaleString()} productos en Supabase\n${pfSynced.toLocaleString()} folios linked\n${elapsed}s\n— CRUZ 🦀`)

  // Log to scrape_runs
  await supabase.from('scrape_runs').insert({
    source: 'resync_productos',
    started_at: new Date(start).toISOString(),
    completed_at: new Date().toISOString(),
    status: 'success',
    records_found: catTotal,
    records_new: synced,
    records_updated: pfSynced,
    metadata: { phase1_catalog: synced, phase2_folios: pfSynced, errors: errors + pfErrors }
  })
}

main().catch(async e => {
  console.error('❌', e.message)
  await tg(`❌ <b>Productos re-sync FAILED</b>\n${e.message}\n— CRUZ 🦀`)
  process.exit(1)
})
