#!/usr/bin/env node
/**
 * CRUZ Supplier Network Scorer
 *
 * Aggregates supplier performance ACROSS all companies.
 * Computes ranked reliability scores for the CRUZ network.
 * Anonymized — no company_id exposed in output table.
 *
 * Cron: 30 4 * * * (daily 4:30 AM, after network-intelligence at 4 AM)
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

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

async function main() {
  console.log(`🏭 Supplier Network Scorer — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  // Fetch all traficos with supplier data since 2024
  const { data: traficos, error } = await supabase.from('traficos')
    .select('proveedores, company_id, pedimento, regimen, fecha_llegada, fecha_cruce')
    .not('proveedores', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .limit(10000)

  if (error) {
    console.error('Fetch error:', error.message)
    await tg(`🔴 Supplier Network Scorer failed: ${error.message}`)
    process.exit(1)
  }

  console.log(`  Fetched ${(traficos || []).length} traficos with suppliers`)

  // Aggregate by supplier name
  const supplierStats = {}
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()
  const oneEightyDaysAgo = new Date(Date.now() - 180 * 86400000).toISOString()

  for (const t of (traficos || [])) {
    // Take first supplier from comma-separated list
    const supplier = (t.proveedores || '').split(',')[0]?.trim()
    if (!supplier || supplier.length < 2) continue

    if (!supplierStats[supplier]) {
      supplierStats[supplier] = {
        clients: new Set(),
        total: 0,
        withPed: 0,
        tmec: 0,
        dwellDays: [],
        recent90: 0,
        prior90: 0,
      }
    }

    const s = supplierStats[supplier]
    s.clients.add(t.company_id)
    s.total++
    if (t.pedimento) s.withPed++

    const reg = (t.regimen || '').toUpperCase()
    if (reg === 'ITE' || reg === 'ITR' || reg === 'IMD') s.tmec++

    // Dwell time (days from arrival to crossing)
    if (t.fecha_llegada && t.fecha_cruce) {
      const days = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
      if (days >= 0 && days < 30) s.dwellDays.push(days)
    }

    // Trend: recent 90d vs prior 90d
    if (t.fecha_llegada >= ninetyDaysAgo) s.recent90++
    else if (t.fecha_llegada >= oneEightyDaysAgo) s.prior90++
  }

  // Score suppliers serving 2+ clients
  const scored = Object.entries(supplierStats)
    .filter(([, s]) => s.clients.size >= 2)
    .map(([name, s]) => {
      const complianceRate = s.total > 0 ? Math.round(s.withPed / s.total * 1000) / 10 : 0
      const tmecRate = s.total > 0 ? Math.round(s.tmec / s.total * 1000) / 10 : 0
      const avgDwell = s.dwellDays.length > 0
        ? Math.round(s.dwellDays.reduce((a, b) => a + b, 0) / s.dwellDays.length * 10) / 10
        : null

      // Reliability: doc compliance 40% + T-MEC 30% + speed 30%
      const speedScore = avgDwell !== null ? Math.max(0, 100 - avgDwell * 10) : 50
      const reliabilityScore = Math.round(
        complianceRate * 0.4 + tmecRate * 0.3 + speedScore * 0.3
      )

      // Trend
      let trend = 'stable'
      if (s.recent90 > s.prior90 * 1.2) trend = 'up'
      else if (s.recent90 < s.prior90 * 0.8 && s.prior90 > 0) trend = 'down'

      return {
        supplier_name: name.substring(0, 100),
        clients_served: s.clients.size,
        total_operations: s.total,
        avg_doc_turnaround_days: avgDwell,
        compliance_rate: complianceRate,
        tmec_qualification_rate: tmecRate,
        reliability_score: reliabilityScore,
        trend,
      }
    })
    .sort((a, b) => b.reliability_score - a.reliability_score)

  // Assign ranks
  scored.forEach((s, i) => { s.rank_in_network = i + 1 })

  console.log(`\n  ${scored.length} suppliers scored (2+ clients)\n`)

  // Upsert into supplier_network_scores
  let written = 0
  for (const s of scored) {
    if (DRY_RUN) {
      console.log(`  #${s.rank_in_network} ${s.supplier_name.padEnd(30)} score: ${s.reliability_score} · ${s.clients_served} clients · ${s.total_operations} ops · compliance: ${s.compliance_rate}% · T-MEC: ${s.tmec_qualification_rate}% · trend: ${s.trend}`)
    } else {
      const { error: upsertErr } = await supabase.from('supplier_network_scores').upsert({
        ...s,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'supplier_name' })

      if (upsertErr) {
        console.error(`  Error upserting ${s.supplier_name}:`, upsertErr.message)
      } else {
        written++
      }
    }
  }

  if (DRY_RUN) {
    console.log(`\n  Would write ${scored.length} supplier scores`)
  } else {
    console.log(`  ${written} supplier scores written`)
  }

  // Telegram summary
  const top3 = scored.slice(0, 3)
  await tg(
    `🏭 <b>Supplier Network Scores</b>\n\n` +
    `${scored.length} proveedores calificados (2+ clientes)\n\n` +
    `Top 3:\n` +
    top3.map((s, i) => `  ${i + 1}. ${s.supplier_name.substring(0, 25)} — score ${s.reliability_score} (${s.clients_served} clientes)`).join('\n') +
    `\n\n— CRUZ 🏭`
  )

  console.log('\n✅ Done')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  tg(`🔴 Supplier Network Scorer failed: ${err.message}`).then(() => process.exit(1))
})
