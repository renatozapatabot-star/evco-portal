#!/usr/bin/env node
/**
 * CRUZ Client Whisper Network — Build 213
 * ============================================================================
 * Proactive intelligence engine. Checks for patterns and anomalies per client,
 * generates actionable insights that appear in Eloisa's launchpad.
 *
 * Checks:
 *   1. Volume drop (>30% vs previous 14 days)
 *   2. Shipping window approaching (day-of-week patterns)
 *   3. Exchange rate favorable move (>2%)
 *   4. MVE deadline approaching (<60 days)
 *   5. Supplier price change (>5%)
 *
 * Cron: 0 */2 * * 1-5 (every 2 hours, weekdays)
 *
 * Patente 3596 · Aduana 240
 * ============================================================================
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'client-whisper-engine'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sendTelegram(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG skip]', msg.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
    })
  } catch (e) { console.error('Telegram error:', e.message) }
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ── Whisper checks ───────────────────────────────────────────────────────────

async function checkVolumeDrops(companyId) {
  const whispers = []

  // Count tráficos in last 14 days vs previous 14 days
  const { count: recent } = await supabase
    .from('traficos')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', daysAgo(14))

  const { count: previous } = await supabase
    .from('traficos')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', daysAgo(28))
    .lt('created_at', daysAgo(14))

  const recentCount = recent || 0
  const previousCount = previous || 0

  if (previousCount > 0 && recentCount < previousCount * 0.7) {
    const dropPct = Math.round((1 - recentCount / previousCount) * 100)
    whispers.push({
      type: 'volume_drop',
      title: 'Volumen de operaciones bajó',
      insight: `Las operaciones bajaron ${dropPct}% en los últimos 14 días (${recentCount} vs ${previousCount}). Considere contactar al cliente.`,
      urgency: dropPct > 50 ? 'high' : 'medium',
      data: { recent: recentCount, previous: previousCount, drop_pct: dropPct },
    })
  }

  return whispers
}

async function checkShippingWindows(companyId) {
  const whispers = []

  // Find suppliers with day-of-week patterns
  const dayOfWeek = new Date().getDay() // 0=Sun, 1=Mon...
  const tomorrow = (dayOfWeek + 1) % 7

  // Get supplier shipping patterns from last 90 days
  const { data: patterns } = await supabase
    .from('traficos')
    .select('proveedor, created_at')
    .eq('company_id', companyId)
    .gte('created_at', daysAgo(90))
    .not('proveedor', 'is', null)

  if (!patterns || patterns.length === 0) return whispers

  // Count day-of-week per supplier
  const supplierDays = {}
  for (const t of patterns) {
    const supplier = t.proveedor
    const day = new Date(t.created_at).getDay()
    if (!supplierDays[supplier]) supplierDays[supplier] = {}
    supplierDays[supplier][day] = (supplierDays[supplier][day] || 0) + 1
  }

  // Find suppliers that typically ship on tomorrow's day
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  for (const [supplier, days] of Object.entries(supplierDays)) {
    const totalOps = Object.values(days).reduce((s, v) => s + v, 0)
    const tomorrowCount = days[tomorrow] || 0
    if (totalOps >= 5 && tomorrowCount / totalOps > 0.25) {
      whispers.push({
        type: 'shipping_window',
        title: `${supplier} suele embarcar ${dayNames[tomorrow]}`,
        insight: `${supplier} ha embarcado ${tomorrowCount} de ${totalOps} veces en ${dayNames[tomorrow]}. Prepare expediente.`,
        urgency: 'low',
        data: { supplier, day: tomorrow, day_name: dayNames[tomorrow], count: tomorrowCount, total: totalOps },
      })
    }
  }

  return whispers.slice(0, 3) // Max 3 shipping window alerts
}

async function checkExchangeRate(companyId) {
  const whispers = []

  // Get current exchange rate from system_config
  const { data: config } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'banxico_exchange_rate')
    .maybeSingle()

  if (!config?.value) return whispers

  const current = typeof config.value === 'object' ? config.value.rate : parseFloat(config.value)
  if (!current || current <= 0) return whispers

  // Check if rate moved favorably (lower = better for importers)
  // Compare against 7-day average (stored in system_config or calculate)
  const { data: rateHistory } = await supabase
    .from('pipeline_log')
    .select('details')
    .eq('step', 'banxico-rate')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(7)

  if (rateHistory && rateHistory.length >= 3) {
    const avgRate = rateHistory
      .map(r => r.details?.rate || r.details?.new_rate)
      .filter(Boolean)
      .reduce((s, v) => s + v, 0) / rateHistory.length

    if (avgRate > 0) {
      const changePct = Math.round(((current - avgRate) / avgRate) * 100 * 10) / 10
      if (Math.abs(changePct) >= 2) {
        const direction = changePct < 0 ? 'bajó' : 'subió'
        const favorability = changePct < 0 ? 'favorable para importaciones' : 'desfavorable para importaciones'
        whispers.push({
          type: 'exchange_rate',
          title: `Tipo de cambio ${direction} ${Math.abs(changePct)}%`,
          insight: `TC actual: $${current.toFixed(2)} MXN/USD (promedio 7d: $${avgRate.toFixed(2)}). ${favorability}.`,
          urgency: Math.abs(changePct) >= 5 ? 'high' : 'medium',
          data: { current, avg_7d: avgRate, change_pct: changePct },
        })
      }
    }
  }

  return whispers
}

async function checkMVEDeadlines(companyId) {
  const whispers = []

  const { data: predictions } = await supabase
    .from('compliance_predictions')
    .select('prediction_type, description, due_date, severity')
    .eq('company_id', companyId)
    .eq('resolved', false)
    .lte('due_date', daysAgo(-60)) // Due within 60 days
    .gte('due_date', new Date().toISOString())

  for (const p of (predictions || [])) {
    const daysUntil = Math.ceil((new Date(p.due_date) - Date.now()) / (1000 * 60 * 60 * 24))
    whispers.push({
      type: 'mve_deadline',
      title: `${p.prediction_type} vence en ${daysUntil} días`,
      insight: p.description || `Fecha límite: ${p.due_date}. Verifique cumplimiento.`,
      urgency: daysUntil <= 30 ? 'high' : 'medium',
      data: { type: p.prediction_type, due_date: p.due_date, days_until: daysUntil },
    })
  }

  return whispers
}

async function checkSupplierPriceChanges(companyId) {
  const whispers = []

  // Compare recent invoice values vs historical averages per supplier
  const { data: recentInvoices } = await supabase
    .from('aduanet_facturas')
    .select('proveedor, valor_usd')
    .eq('clave_cliente', companyId)
    .gte('fecha_pago', daysAgo(30))
    .not('valor_usd', 'is', null)

  if (!recentInvoices || recentInvoices.length === 0) return whispers

  // Group by supplier
  const supplierValues = {}
  for (const inv of recentInvoices) {
    if (!inv.proveedor) continue
    if (!supplierValues[inv.proveedor]) supplierValues[inv.proveedor] = []
    supplierValues[inv.proveedor].push(inv.valor_usd)
  }

  // Compare against supplier_profiles avg
  for (const [supplier, values] of Object.entries(supplierValues)) {
    const recentAvg = values.reduce((s, v) => s + v, 0) / values.length

    const { data: profile } = await supabase
      .from('supplier_profiles')
      .select('avg_value_usd')
      .eq('supplier_name', supplier)
      .eq('company_id', companyId)
      .maybeSingle()

    if (profile?.avg_value_usd && profile.avg_value_usd > 0) {
      const changePct = Math.round(((recentAvg - profile.avg_value_usd) / profile.avg_value_usd) * 100)
      if (Math.abs(changePct) >= 5) {
        const direction = changePct > 0 ? 'subió' : 'bajó'
        whispers.push({
          type: 'supplier_price',
          title: `${supplier}: precio ${direction} ${Math.abs(changePct)}%`,
          insight: `Valor promedio reciente: $${Math.round(recentAvg).toLocaleString()} USD vs histórico $${Math.round(profile.avg_value_usd).toLocaleString()} USD.`,
          urgency: Math.abs(changePct) >= 15 ? 'high' : 'medium',
          data: { supplier, recent_avg: recentAvg, historical_avg: profile.avg_value_usd, change_pct: changePct },
        })
      }
    }
  }

  return whispers.slice(0, 3) // Max 3 price change alerts
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`\nCRUZ Client Whisper Network`)
  console.log(`  ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}\n`)

  const companyId = process.env.DEFAULT_COMPANY_ID || 'evco'

  // Run all checks in parallel
  const [volumes, windows, rates, mve, prices] = await Promise.all([
    checkVolumeDrops(companyId),
    checkShippingWindows(companyId),
    checkExchangeRate(companyId),
    checkMVEDeadlines(companyId),
    checkSupplierPriceChanges(companyId),
  ])

  const allWhispers = [...volumes, ...windows, ...rates, ...mve, ...prices]
  console.log(`Found ${allWhispers.length} whisper(s)\n`)

  // Deduplicate: check if whisper was already created today
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const { data: existingToday } = await supabase
    .from('agent_decisions')
    .select('payload')
    .eq('trigger_type', 'whisper')
    .eq('company_id', companyId)
    .gte('created_at', `${today}T00:00:00`)

  const existingTypes = new Set(
    (existingToday || []).map(d => d.payload?.whisper_type).filter(Boolean)
  )

  let created = 0
  for (const whisper of allWhispers) {
    // Skip if same type already created today
    if (existingTypes.has(whisper.type)) {
      console.log(`  Skip (duplicate): ${whisper.title}`)
      continue
    }

    console.log(`  💡 ${whisper.title}`)

    // Insert as agent_decision for launchpad
    await supabase.from('agent_decisions').insert({
      trigger_type: 'whisper',
      decision: whisper.title,
      confidence: whisper.urgency === 'high' ? 0.9 : whisper.urgency === 'medium' ? 0.7 : 0.5,
      autonomy_level: 0, // Always show to human
      action_taken: 'insight_generated',
      company_id: companyId,
      payload: {
        whisper_type: whisper.type,
        insight: whisper.insight,
        urgency: whisper.urgency,
        data: whisper.data,
      },
    }).then(() => {}, (err) => console.error('agent_decisions error:', err.message))

    created++
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n${created} whispers created · ${elapsed}s`)

  // Log to heartbeat
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: 'success',
    details: { whispers_found: allWhispers.length, created, elapsed_s: parseFloat(elapsed) },
  }).then(() => {}, () => {})

  if (created > 0) {
    const titles = allWhispers.slice(0, 3).map(w => `• ${w.title}`).join('\n')
    await sendTelegram(`💡 <b>Whisper Network</b> · ${created} insight(s)\n${titles}`)
  }
}

run().catch(async err => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}`)
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME, status: 'failed',
    details: { error: err.message },
  }).then(() => {}, () => {})
  process.exit(1)
})
