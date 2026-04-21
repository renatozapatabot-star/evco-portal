#!/usr/bin/env node

// ============================================================
// CRUZ Memory Builder — Extract patterns, build institutional memory
//
// For each active client, analyzes tráfico history and writes
// learned patterns to cruz_memory table. CRUZ AI uses these
// patterns to give context-rich, memory-augmented responses.
//
// "This supplier always ships late in December."
// "Volume increases 15% in Q1 for this client."
// "T-MEC utilization is 64% — room for improvement."
//
// Cron: 0 4 * * * (daily 4 AM)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (DRY_RUN || !token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

// Pattern extraction (mirrors src/lib/institutional-memory.ts logic)
function extractPatterns(traficos, companyId) {
  const patterns = []
  const now = new Date().toISOString()

  // Supplier delivery patterns
  const supplierDays = new Map()
  for (const t of traficos) {
    if (!t.fecha_llegada || !t.fecha_cruce || !t.proveedores) continue
    const days = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
    if (days < 0 || days > 30) continue
    const supplier = t.proveedores.split(',')[0]?.trim()
    if (!supplier) continue
    const arr = supplierDays.get(supplier) || []
    arr.push(days)
    supplierDays.set(supplier, arr)
  }

  for (const [supplier, days] of supplierDays) {
    if (days.length < 3) continue
    const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length * 10) / 10
    patterns.push({
      company_id: companyId,
      pattern_type: 'supplier_behavior',
      pattern_key: `delivery_time:${supplier.toLowerCase().replace(/\s+/g, '_')}`,
      pattern_value: `${supplier} entrega en promedio ${avg} días (${days.length} operaciones)`,
      confidence: Math.min(0.95, 0.5 + days.length * 0.05),
      observations: days.length,
      source: 'operational',
      last_seen: now,
    })
  }

  // T-MEC utilization
  const tmecOps = traficos.filter(t => {
    const r = (t.regimen || '').toUpperCase()
    return r === 'ITE' || r === 'ITR' || r === 'IMD'
  }).length

  if (traficos.length >= 10) {
    const tmecRate = Math.round(tmecOps / traficos.length * 100)
    patterns.push({
      company_id: companyId,
      pattern_type: 'operational_insight',
      pattern_key: 'tmec_utilization',
      pattern_value: `Tasa T-MEC: ${tmecRate}% (${tmecOps}/${traficos.length})`,
      confidence: 0.9,
      observations: traficos.length,
      source: 'operational',
      last_seen: now,
    })
  }

  // Average value per shipment
  const withValue = traficos.filter(t => t.importe_total && t.importe_total > 0)
  if (withValue.length >= 5) {
    const avg = Math.round(withValue.reduce((s, t) => s + t.importe_total, 0) / withValue.length)
    patterns.push({
      company_id: companyId,
      pattern_type: 'operational_insight',
      pattern_key: 'avg_shipment_value',
      pattern_value: `Valor promedio por embarque: $${avg.toLocaleString()} USD (${withValue.length} operaciones)`,
      confidence: 0.85,
      observations: withValue.length,
      source: 'operational',
      last_seen: now,
    })
  }

  return patterns
}

async function main() {
  console.log(`🧠 CRUZ Memory Builder — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const { data: companies } = await supabase
    .from('companies')
    .select('company_id, name')
    .eq('active', true)

  if (!companies || companies.length === 0) {
    console.log('  No active companies')
    process.exit(0)
  }

  let totalPatterns = 0
  let totalWritten = 0

  for (const co of companies) {
    const { data: traficos } = await supabase
      .from('traficos')
      .select('trafico, proveedores, descripcion_mercancia, fecha_llegada, fecha_cruce, regimen, importe_total')
      .eq('company_id', co.company_id)
      .gte('fecha_llegada', '2024-01-01')
      .limit(2000)

    if (!traficos || traficos.length < 5) continue

    const patterns = extractPatterns(traficos, co.company_id)
    totalPatterns += patterns.length

    if (!DRY_RUN && patterns.length > 0) {
      for (const p of patterns) {
        await supabase.from('cruz_memory').upsert(p, { onConflict: 'company_id,pattern_key' })
        totalWritten++
      }
    }

    console.log(`  ${co.name.padEnd(25)} ${traficos.length} tráficos → ${patterns.length} patrones`)
  }

  await sendTelegram(
    `🧠 <b>Memoria CRUZ actualizada</b>\n\n` +
    `${companies.length} clientes analizados\n` +
    `${totalPatterns} patrones extraídos\n` +
    `${totalWritten} escritos a memoria\n\n` +
    `— CRUZ 🦀`
  )

  console.log(`\n✅ ${totalPatterns} patterns · ${totalWritten} written`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
