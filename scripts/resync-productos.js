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
const TENANT_ID = '52762e3c-bd8a-49b8-9a32-296e526b7238'
const CLIENT_CLAVE = '9254'  // EVCO-specific — not a multi-client pattern
const COMPANY_ID = 'evco'
const BATCH = 500

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
