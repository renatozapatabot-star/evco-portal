#!/usr/bin/env node

// ============================================================
// CRUZ Client Intelligence Profiles
// Builds a living profile per client that makes every interaction smarter.
// Every shipment, login, and question makes CRUZ more valuable.
// After 6 months, switching brokers = losing accumulated intelligence.
// Cron: 0 3 * * 1 (Monday 3 AM)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'
const PORTAL_DATE_FROM = '2024-01-01'

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

async function buildProfile(company) {
  const { company_id, name, clave_cliente } = company

  // ── OPERATIONAL ──
  const traficos = await fetchAll(supabase
    .from('traficos')
    .select('trafico, estatus, fecha_llegada, fecha_cruce, importe_total, regimen, pais_procedencia, descripcion_mercancia, proveedores')
    .eq('company_id', company_id)
    .gte('fecha_llegada', PORTAL_DATE_FROM))

  const traf = traficos
  if (traf.length < 3) return null // Too few for meaningful profile

  // Monthly volumes
  const monthlyVolume = {}
  for (const t of traf) {
    const m = (t.fecha_llegada || '').substring(0, 7)
    if (m) monthlyVolume[m] = (monthlyVolume[m] || 0) + 1
  }
  const months = Object.keys(monthlyVolume).sort()
  const avgMonthly = months.length > 0 ? Math.round(traf.length / months.length * 10) / 10 : 0

  // Trend: compare last 3 months vs prior 3
  const recentMonths = months.slice(-3)
  const priorMonths = months.slice(-6, -3)
  const recentAvg = recentMonths.length > 0 ? recentMonths.reduce((s, m) => s + monthlyVolume[m], 0) / recentMonths.length : 0
  const priorAvg = priorMonths.length > 0 ? priorMonths.reduce((s, m) => s + monthlyVolume[m], 0) / priorMonths.length : recentAvg
  const volumeTrend = priorAvg > 0 ? Math.round(((recentAvg - priorAvg) / priorAvg) * 100) : 0

  // Seasonality: which months have highest volume
  const monthAgg = {}
  for (const [ym, count] of Object.entries(monthlyVolume)) {
    const monthNum = parseInt(ym.split('-')[1])
    monthAgg[monthNum] = (monthAgg[monthNum] || 0) + count
  }
  const peakMonth = Object.entries(monthAgg).sort((a, b) => b[1] - a[1])[0]?.[0]
  const monthNames = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

  // Value
  const values = traf.map(t => Number(t.importe_total) || 0).filter(v => v > 0)
  const avgValue = values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0
  const totalValue = values.reduce((s, v) => s + v, 0)

  // Product categories
  const productCounts = {}
  for (const t of traf) {
    const desc = (t.descripcion_mercancia || '').substring(0, 30).toLowerCase().trim()
    if (desc) productCounts[desc] = (productCounts[desc] || 0) + 1
  }
  const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Origins
  const originCounts = {}
  for (const t of traf) {
    const o = (t.pais_procedencia || '').toUpperCase().trim()
    if (o) originCounts[o] = (originCounts[o] || 0) + 1
  }
  const topOrigins = Object.entries(originCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

  // T-MEC rate
  const tmecCount = traf.filter(t => {
    const r = (t.regimen || '').toUpperCase()
    return r === 'ITE' || r === 'ITR' || r === 'IMD'
  }).length
  const tmecRate = traf.length > 0 ? Math.round((tmecCount / traf.length) * 100) : 0

  // Crossing time
  const crossings = traf.filter(t => t.fecha_llegada && t.fecha_cruce)
  const avgCrossingDays = crossings.length > 0
    ? Math.round(crossings.reduce((s, t) => s + Math.max(0, (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000), 0) / crossings.length * 10) / 10
    : 0

  // ── PREDICTIVE ──
  const expectedNext30 = Math.round(recentAvg)
  const tmecSavings = Math.round(totalValue * (tmecRate / 100) * 0.05) // 5% IGI saved

  // Volume trend risk
  let churnRisk = 'low'
  if (volumeTrend < -30) churnRisk = 'high'
  else if (volumeTrend < -10) churnRisk = 'medium'

  return {
    company_id,
    name,
    operational: {
      total_traficos: traf.length,
      avg_monthly: avgMonthly,
      volume_trend_pct: volumeTrend,
      peak_month: peakMonth ? monthNames[parseInt(peakMonth)] : null,
      avg_value_usd: avgValue,
      total_value_usd: Math.round(totalValue),
      top_products: topProducts.map(([desc, count]) => ({ desc, count })),
      top_origins: topOrigins.map(([country, count]) => ({ country, count })),
      tmec_rate: tmecRate,
      avg_crossing_days: avgCrossingDays,
    },
    predictive: {
      expected_next_30: expectedNext30,
      tmec_savings_estimated: tmecSavings,
      churn_risk: churnRisk,
      volume_direction: volumeTrend > 5 ? 'growing' : volumeTrend < -5 ? 'declining' : 'stable',
    },
    updated_at: new Date().toISOString(),
  }
}

async function main() {
  console.log(`🧠 CRUZ Client Profiles — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const { data: companies } = await supabase
    .from('companies')
    .select('company_id, name, clave_cliente')
    .eq('active', true)
    .order('name')

  if (!companies) { console.log('No companies'); process.exit(0) }

  console.log(`  Building profiles for ${companies.length} companies...\n`)

  const profiles = []
  const churnAlerts = []

  for (const company of companies) {
    try {
      const profile = await buildProfile(company)
      if (!profile) {
        process.stdout.write('·')
        continue
      }
      profiles.push(profile)
      process.stdout.write(profile.predictive.churn_risk === 'high' ? '!' : profile.predictive.churn_risk === 'medium' ? '?' : '.')

      if (profile.predictive.churn_risk !== 'low') {
        churnAlerts.push(profile)
      }

      if (!DRY_RUN) {
        await supabase.from('client_profiles').upsert({
          company_id: profile.company_id,
          profile_data: profile,
          churn_risk: profile.predictive.churn_risk,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id' }).then(() => {}, () => {})
      }
    } catch (err) {
      process.stdout.write('X')
    }
  }

  console.log(`\n\n✅ ${profiles.length} profiles built`)

  // Churn alerts for Tito
  if (churnAlerts.length > 0) {
    const lines = [
      `🧠 <b>Client Intelligence — Alertas</b>`,
      ``,
      `⚠️ <b>${churnAlerts.length} cliente(s) con riesgo de churn:</b>`,
    ]
    for (const p of churnAlerts.slice(0, 5)) {
      const icon = p.predictive.churn_risk === 'high' ? '🔴' : '🟡'
      lines.push(`${icon} <b>${p.name}</b>: volumen ${p.operational.volume_trend_pct > 0 ? '+' : ''}${p.operational.volume_trend_pct}% · ${p.operational.avg_monthly}/mes`)
    }
    lines.push(``, `— CRUZ 🦀`)
    await sendTelegram(lines.join('\n'))
  }

  // Log
  await supabase.from('heartbeat_log').insert({
    script: 'build-client-profile',
    status: 'success',
    details: { profiles: profiles.length, churn_alerts: churnAlerts.length, dry_run: DRY_RUN },
  }).then(() => {}, () => {})

  process.exit(0)
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
