#!/usr/bin/env node
/**
 * CRUZ Ghost Tráfico Detector — cross-client fraud detection
 *
 * 4 integrity checks across ALL clients:
 * 1. Duplicate invoices (same supplier+value+date, different client)
 * 2. Pedimento number reuse (NEVER valid — critical alert)
 * 3. Value manipulation (same product, >30% value difference)
 * 4. Carrier double-booking (same carrier, same time, same bridge)
 *
 * Cron: 30 2 * * * (daily after nightly sync)
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function logDetection(checkType, severity, description, traficos, companies) {
  console.log(`  ${severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : '🟡'} [${checkType}] ${description}`)
  if (!DRY_RUN) {
    await supabase.from('ghost_detections').insert({
      check_type: checkType,
      severity,
      description,
      traficos: JSON.stringify(traficos),
      companies: JSON.stringify(companies),
    }).catch(() => {})
  }
}

async function main() {
  console.log(`🔍 Ghost Tráfico Detector — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const alerts = []

  // Load recent tráficos across ALL clients
  const allTraficos = await fetchAll(supabase.from('traficos')
    .select('trafico, company_id, proveedores, importe_total, pedimento, fecha_llegada, transportista_mexicano, descripcion_mercancia, fecha_cruce')
    .gte('fecha_llegada', '2024-01-01'))

  const traficos = allTraficos || []
  console.log(`  ${traficos.length} tráficos loaded for analysis`)

  // ── CHECK 1: Duplicate Invoices ──
  console.log('\n── CHECK 1: Duplicate Invoices ──')
  const invoiceKeys = {}
  for (const t of traficos) {
    const supplier = (t.proveedores || '').split(',')[0]?.trim()
    const value = Number(t.importe_total) || 0
    const date = (t.fecha_llegada || '').split('T')[0]
    if (!supplier || value === 0 || !date) continue

    const key = `${supplier.substring(0, 20).toLowerCase()}|${value}|${date}`
    if (!invoiceKeys[key]) invoiceKeys[key] = []
    invoiceKeys[key].push(t)
  }

  for (const [key, matches] of Object.entries(invoiceKeys)) {
    const uniqueCompanies = new Set(matches.map(m => m.company_id))
    if (uniqueCompanies.size >= 2) {
      const [supplier, value, date] = key.split('|')
      const desc = `${supplier} facturó $${Number(value).toLocaleString()} el ${date} a ${uniqueCompanies.size} clientes distintos`
      await logDetection('duplicate_invoice', 'high', desc,
        matches.map(m => m.trafico),
        [...uniqueCompanies]
      )
      alerts.push({ severity: 'high', desc })
    }
  }

  // ── CHECK 2: Pedimento Number Reuse ──
  console.log('\n── CHECK 2: Pedimento Reuse ──')
  const pedimentoMap = {}
  for (const t of traficos) {
    if (!t.pedimento) continue
    if (!pedimentoMap[t.pedimento]) pedimentoMap[t.pedimento] = []
    pedimentoMap[t.pedimento].push(t)
  }

  for (const [ped, matches] of Object.entries(pedimentoMap)) {
    const uniqueCompanies = new Set(matches.map(m => m.company_id))
    if (uniqueCompanies.size >= 2) {
      const desc = `Pedimento ${ped} usado por ${uniqueCompanies.size} clientes distintos — NUNCA debe ocurrir`
      await logDetection('pedimento_reuse', 'critical', desc,
        matches.map(m => m.trafico),
        [...uniqueCompanies]
      )
      alerts.push({ severity: 'critical', desc })

      await tg(
        `🚨🚨🚨 <b>PEDIMENTO DUPLICADO</b>\n\n` +
        `Pedimento ${ped} asignado a ${uniqueCompanies.size} clientes:\n` +
        matches.map(m => `  • ${m.trafico} (${m.company_id})`).join('\n') + `\n\n` +
        `Acción inmediata requerida.\n— CRUZ 🔍`
      )
    }
  }

  // ── CHECK 3: Value Manipulation ──
  console.log('\n── CHECK 3: Value Manipulation ──')
  const supplierProductValues = {}
  for (const t of traficos) {
    const supplier = (t.proveedores || '').split(',')[0]?.trim()
    const desc = (t.descripcion_mercancia || '').substring(0, 30).toLowerCase().trim()
    const value = Number(t.importe_total) || 0
    if (!supplier || !desc || value === 0) continue

    const key = `${supplier.substring(0, 20).toLowerCase()}|${desc}`
    if (!supplierProductValues[key]) supplierProductValues[key] = []
    supplierProductValues[key].push({ trafico: t.trafico, company_id: t.company_id, value })
  }

  for (const [key, entries] of Object.entries(supplierProductValues)) {
    if (entries.length < 3) continue
    const values = entries.map(e => e.value)
    const avg = values.reduce((a, b) => a + b, 0) / values.length

    for (const e of entries) {
      const deviation = Math.abs(e.value - avg) / avg
      if (deviation > 0.30) {
        const [supplier, product] = key.split('|')
        const direction = e.value < avg ? 'bajo' : 'alto'
        const desc = `${supplier}/${product}: ${e.trafico} (${e.company_id}) declara $${e.value.toLocaleString()} — ${Math.round(deviation * 100)}% ${direction} vs promedio $${Math.round(avg).toLocaleString()}`
        await logDetection('value_manipulation', 'medium', desc,
          [e.trafico],
          [e.company_id]
        )
        alerts.push({ severity: 'medium', desc })
      }
    }
  }

  // ── CHECK 4: Carrier Double-Booking ──
  console.log('\n── CHECK 4: Carrier Double-Booking ──')
  const carrierCrossings = {}
  for (const t of traficos) {
    if (!t.transportista_mexicano || !t.fecha_cruce) continue
    const carrier = t.transportista_mexicano.trim().toLowerCase()
    const crossDate = t.fecha_cruce.split('T')[0]
    const key = `${carrier}|${crossDate}`
    if (!carrierCrossings[key]) carrierCrossings[key] = []
    carrierCrossings[key].push(t)
  }

  for (const [key, matches] of Object.entries(carrierCrossings)) {
    if (matches.length >= 3) {
      const [carrier, date] = key.split('|')
      const uniqueCompanies = new Set(matches.map(m => m.company_id))
      const desc = `${carrier} cruzó ${matches.length} embarques el ${date} — verificar capacidad`
      await logDetection('carrier_double_booking', 'low', desc,
        matches.map(m => m.trafico),
        [...uniqueCompanies]
      )
      alerts.push({ severity: 'low', desc })
    }
  }

  // ── Summary ──
  const critical = alerts.filter(a => a.severity === 'critical').length
  const high = alerts.filter(a => a.severity === 'high').length
  const medium = alerts.filter(a => a.severity === 'medium').length
  const low = alerts.filter(a => a.severity === 'low').length

  if (alerts.length > 0 && (critical > 0 || high > 0)) {
    await tg(
      `🔍 <b>Ghost Detector — Alertas</b>\n\n` +
      (critical > 0 ? `🔴 ${critical} crítico(s)\n` : '') +
      (high > 0 ? `🟠 ${high} alto(s)\n` : '') +
      (medium > 0 ? `🟡 ${medium} medio(s)\n` : '') +
      (low > 0 ? `⚪ ${low} bajo(s)\n` : '') +
      `\n${alerts.length} detecciones totales\n— CRUZ 🔍`
    )
  }

  console.log(`\n✅ ${alerts.length} detections: ${critical} critical · ${high} high · ${medium} medium · ${low} low`)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
