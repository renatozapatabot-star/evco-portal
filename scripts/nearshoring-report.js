#!/usr/bin/env node
/**
 * CRUZ — Nearshoring Intelligence Report (BUILD 158)
 *
 * Analyzes cross-border trends from all client data:
 * - New suppliers appearing from US (nearshoring indicator)
 * - Product categories growing fastest
 * - Routes with increasing volume
 * - Monthly "Nearshoring Report" for intelligence product
 *
 * Usage:
 *   node scripts/nearshoring-report.js --dry-run
 *
 * Cron: 0 6 1 * * (1st of each month, 6 AM)
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function tg(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function run() {
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''
  console.log(`\n📊 ${prefix}CRUZ — Nearshoring Intelligence Report`)
  console.log('═'.repeat(55))

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`
  const lastYear = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Get traficos for analysis — paginate past Supabase 1,000-row cap
  const traficos = []
  {
    const BATCH = 1000
    let offset = 0
    while (true) {
      const { data, error } = await supabase.from('traficos')
        .select('company_id, proveedores, descripcion_mercancia, regimen, importe_total, fecha_llegada, pais_procedencia')
        .gte('fecha_llegada', '2024-01-01')
        .not('fecha_llegada', 'is', null)
        .range(offset, offset + BATCH - 1)
      if (error || !data || data.length === 0) break
      traficos.push(...data)
      offset += BATCH
      if (data.length < BATCH) break
    }
  }

  if (!traficos || traficos.length === 0) {
    console.log('   No data for analysis')
    return
  }

  // Unique companies with operations
  const activeClients = new Set(traficos.map(t => t.company_id))

  // Monthly volume trend
  const byMonth = {}
  for (const t of traficos) {
    const m = (t.fecha_llegada || '').substring(0, 7)
    byMonth[m] = (byMonth[m] || 0) + 1
  }

  // Supplier growth
  const thisMonthSuppliers = new Set()
  const lastMonthSuppliers = new Set()
  for (const t of traficos) {
    const m = (t.fecha_llegada || '').substring(0, 7)
    const sup = (t.proveedores || '').split(',')[0].trim()
    if (!sup) continue
    if (m === thisMonth) thisMonthSuppliers.add(sup)
    if (m === lastMonth) lastMonthSuppliers.add(sup)
  }
  const newSuppliers = [...thisMonthSuppliers].filter(s => !lastMonthSuppliers.has(s))

  // T-MEC adoption rate
  const tmecOps = traficos.filter(t => ['ITE', 'ITR', 'IMD'].includes((t.regimen || '').toUpperCase()))
  const tmecRate = Math.round((tmecOps.length / traficos.length) * 100)

  // Top growing sectors (by description keywords)
  const sectorKeywords = {
    'automotriz': ['auto', 'motor', 'freno', 'balata', 'asiento', 'faurecia'],
    'plasticos': ['plastic', 'resina', 'polipropileno', 'polietileno', 'molde'],
    'electronica': ['electric', 'cable', 'circuit', 'sensor', 'electro'],
    'alimentos': ['aliment', 'comida', 'bebida', 'cereal'],
    'textil': ['tela', 'hilo', 'textil', 'ropa', 'fabric'],
    'metalmecanico': ['acero', 'metal', 'hierro', 'alumin', 'soldad'],
  }

  const sectorCounts = {}
  for (const [sector, keywords] of Object.entries(sectorKeywords)) {
    sectorCounts[sector] = traficos.filter(t => {
      const desc = (t.descripcion_mercancia || '').toLowerCase()
      return keywords.some(k => desc.includes(k))
    }).length
  }

  // Report
  console.log('\n── NEARSHORING INTELLIGENCE ──')
  console.log(`   Period: ${lastYear} to ${thisMonth}`)
  console.log(`   Active clients: ${activeClients.size}`)
  console.log(`   Total operations: ${traficos.length.toLocaleString()}`)
  console.log(`   T-MEC rate: ${tmecRate}%`)
  console.log(`   New suppliers this month: ${newSuppliers.length}`)

  console.log('\n   Monthly volume:')
  Object.entries(byMonth).sort().slice(-6).forEach(([m, c]) => console.log(`     ${m}: ${c}`))

  console.log('\n   Sector distribution:')
  Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
    if (c > 0) console.log(`     ${s}: ${c} operations`)
  })

  // Save report
  if (!DRY_RUN) {
    await supabase.from('system_config').upsert({
      key: 'nearshoring_report',
      value: {
        period: `${lastYear}-${thisMonth}`,
        active_clients: activeClients.size,
        total_operations: traficos.length,
        tmec_rate: tmecRate,
        new_suppliers: newSuppliers.length,
        sectors: sectorCounts,
        generated_at: new Date().toISOString(),
      },
      valid_to: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    }, { onConflict: 'key' })
  }

  await tg(
    `📊 <b>NEARSHORING REPORT</b>\n` +
    `${activeClients.size} clientes · ${traficos.length.toLocaleString()} ops\n` +
    `T-MEC: ${tmecRate}% · Nuevos proveedores: ${newSuppliers.length}\n` +
    `— CRUZ 🦀`
  )
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>nearshoring-report FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
