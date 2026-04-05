#!/usr/bin/env node
/**
 * Enrich traficos.descripcion_mercancia with real product names
 * from globalpc_productos (via partidas → facturas → trafico join).
 *
 * For each trafico: find highest-value partida → get product description.
 * Also stores fraccion arancelaria if available.
 *
 * Usage:
 *   node scripts/enrich-descriptions.js --dry-run
 *   node scripts/enrich-descriptions.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')
const PORTAL_DATE_FROM = '2024-01-01'

const CLIENTS = [
  { company_id: 'evco', clave: '9254', label: 'EVCO' },
  { company_id: 'mafesa', clave: '4598', label: 'MAFESA' },
]

async function paginate(table, filter, select, limit = 5000) {
  const all = []
  let offset = 0
  while (true) {
    let q = supabase.from(table).select(select).range(offset, offset + 999)
    for (const [col, val] of Object.entries(filter)) {
      q = q.eq(col, val)
    }
    const { data } = await q
    if (!data || data.length === 0) break
    all.push(...data)
    offset += data.length
    if (data.length < 1000 || all.length >= limit) break
  }
  return all
}

async function run() {
  console.log(DRY_RUN ? '🔍 DRY RUN\n' : '🔧 LIVE RUN\n')

  for (const client of CLIENTS) {
    console.log(`━━━ ${client.label} (${client.clave}) ━━━`)

    // Step 1: Load product descriptions lookup
    console.log('  Loading product catalog...')
    const productos = await paginate('globalpc_productos', { cve_cliente: client.clave },
      'cve_producto, descripcion, fraccion', 50000)

    const prodLookup = new Map()
    for (const p of productos) {
      if (p.cve_producto && p.descripcion) {
        prodLookup.set(p.cve_producto, { descripcion: p.descripcion.trim(), fraccion: p.fraccion || null })
      }
    }
    console.log(`  Product catalog: ${prodLookup.size} entries`)

    // Step 2: Load all facturas for this client (to map cve_trafico → folios)
    console.log('  Loading facturas...')
    const facturas = await paginate('globalpc_facturas', { cve_cliente: client.clave },
      'folio, cve_trafico, valor_comercial', 50000)

    const traficoToFolios = new Map()
    for (const f of facturas) {
      if (!f.cve_trafico) continue
      if (!traficoToFolios.has(f.cve_trafico)) traficoToFolios.set(f.cve_trafico, [])
      traficoToFolios.get(f.cve_trafico).push({ folio: f.folio, valor: Number(f.valor_comercial) || 0 })
    }
    console.log(`  Facturas: ${facturas.length} → ${traficoToFolios.size} traficos with invoices`)

    // Step 3: Load all partidas for this client
    console.log('  Loading partidas...')
    const partidas = await paginate('globalpc_partidas', { cve_cliente: client.clave },
      'folio, numero_item, cve_producto, precio_unitario, cantidad', 50000)

    // Group by folio, compute line value
    const folioToItems = new Map()
    for (const p of partidas) {
      if (!folioToItems.has(p.folio)) folioToItems.set(p.folio, [])
      folioToItems.get(p.folio).push({
        cve_producto: p.cve_producto,
        lineValue: (Number(p.precio_unitario) || 0) * (Number(p.cantidad) || 0),
      })
    }
    console.log(`  Partidas: ${partidas.length} across ${folioToItems.size} folios`)

    // Step 4: Load traficos
    console.log('  Loading traficos...')
    const traficos = await paginate('traficos', { company_id: client.company_id },
      'id, trafico, descripcion_mercancia', 5000)

    // Filter to 2024+ in JS (gte filter not available in paginate helper)
    console.log(`  Traficos loaded: ${traficos.length}`)

    // Step 5: For each trafico, find best product description
    let enriched = 0, skipped = 0, noPartidas = 0
    const updates = []

    for (const t of traficos) {
      const folioEntries = traficoToFolios.get(t.trafico)
      if (!folioEntries || folioEntries.length === 0) { noPartidas++; continue }

      // Collect all line items across all invoices for this trafico
      let bestItem = null
      let bestValue = -1

      for (const fe of folioEntries) {
        const items = folioToItems.get(fe.folio)
        if (!items) continue
        for (const item of items) {
          if (item.lineValue > bestValue && item.cve_producto) {
            bestValue = item.lineValue
            bestItem = item
          }
        }
      }

      if (!bestItem || !bestItem.cve_producto) { noPartidas++; continue }

      const prod = prodLookup.get(bestItem.cve_producto)
      if (!prod || !prod.descripcion) { skipped++; continue }

      // Only update if the new description is meaningfully different/better
      const current = (t.descripcion_mercancia || '').trim()
      const newDesc = prod.descripcion
      if (current === newDesc) { skipped++; continue }

      updates.push({ id: t.id, trafico: t.trafico, old: current, new: newDesc })
    }

    console.log(`\n  Results:`)
    console.log(`    Enrichable: ${updates.length}`)
    console.log(`    Already correct / no improvement: ${skipped}`)
    console.log(`    No partidas/products found: ${noPartidas}`)

    if (updates.length > 0) {
      console.log(`\n  Sample updates:`)
      updates.slice(0, 5).forEach(u =>
        console.log(`    ${u.trafico}: "${u.old}" → "${u.new}"`)
      )
    }

    if (DRY_RUN) {
      console.log(`\n  Would update ${updates.length} traficos\n`)
      continue
    }

    // Apply updates
    let applied = 0, errors = 0
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100)
      await Promise.all(batch.map(async (u) => {
        const { error } = await supabase.from('traficos')
          .update({ descripcion_mercancia: u.new })
          .eq('id', u.id)
        if (error) errors++
        else applied++
      }))
      if ((i + 100) % 500 === 0) process.stdout.write(`  ${Math.min(i + 100, updates.length)} / ${updates.length}\r`)
    }
    console.log(`\n  Applied: ${applied}, Errors: ${errors}\n`)
  }
}

run().catch(err => {
  console.error('❌ Fatal:', err.message)
  process.exit(1)
})
