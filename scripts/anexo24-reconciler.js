#!/usr/bin/env node

// ============================================================
// CRUZ Annex 24 Reconciler — IMMEX inventory tracking
// Tracks temporary imports vs exports/transfers/returns.
// Flags items approaching 18-month deadline.
// Cron: 0 3 1,15 * * (1st and 15th of month at 3 AM)
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
const IMMEX_REGIMES = ['IN', 'in', 'ITE', 'ITR']
const { fetchAll } = require('./lib/paginate')
const DEADLINE_MONTHS = 18 // IMMEX temporary import deadline
const WARN_90_DAYS = 90 * 86400000
const WARN_30_DAYS = 30 * 86400000

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

function fmtUSD(n) { return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) }

async function reconcileClient(companyId) {
  // Get all IMMEX temporary imports
  const imports = await fetchAll(supabase
    .from('traficos')
    .select('trafico, pedimento, fecha_llegada, importe_total, descripcion_mercancia, regimen, estatus')
    .eq('company_id', companyId)
    .in('regimen', IMMEX_REGIMES)
    .gte('fecha_llegada', '2022-01-01') // 2+ years for 18-month window
    .order('fecha_llegada', { ascending: true }))

  if (!imports || imports.length === 0) return null

  // Get exports/returns (régimen RT, RE, or Cruzado status)
  const exports = await fetchAll(supabase
    .from('traficos')
    .select('trafico, pedimento, fecha_cruce, importe_total')
    .eq('company_id', companyId)
    .ilike('estatus', '%cruz%')
    .in('regimen', IMMEX_REGIMES)
    .gte('fecha_llegada', '2022-01-01'))

  const exportedSet = new Set((exports || []).map(e => e.trafico))
  const now = Date.now()

  const openItems = []
  const atRisk90 = []
  const atRisk30 = []
  const expired = []
  let openValue = 0

  for (const imp of imports) {
    if (exportedSet.has(imp.trafico)) continue // Reconciled
    if ((imp.estatus || '').toLowerCase().includes('cruz')) continue

    const importDate = new Date(imp.fecha_llegada).getTime()
    const deadline = importDate + (DEADLINE_MONTHS * 30 * 86400000)
    const daysRemaining = Math.round((deadline - now) / 86400000)
    const value = Number(imp.importe_total) || 0

    const item = {
      trafico: imp.trafico,
      pedimento: imp.pedimento,
      fecha_llegada: imp.fecha_llegada,
      descripcion: (imp.descripcion_mercancia || '').substring(0, 40),
      valor_usd: value,
      days_remaining: daysRemaining,
      deadline: new Date(deadline).toISOString().split('T')[0],
    }

    openItems.push(item)
    openValue += value

    if (daysRemaining < 0) expired.push(item)
    else if (daysRemaining <= 30) atRisk30.push(item)
    else if (daysRemaining <= 90) atRisk90.push(item)
  }

  return {
    company_id: companyId,
    total_imports: imports.length,
    total_exports: exports.length || 0,
    open_items: openItems.length,
    open_value: Math.round(openValue),
    expired: expired.length,
    at_risk_30: atRisk30.length,
    at_risk_90: atRisk90.length,
    expired_items: expired.slice(0, 5),
    risk_30_items: atRisk30.slice(0, 5),
    risk_90_items: atRisk90.slice(0, 5),
  }
}

async function main() {
  console.log(`📋 CRUZ Annex 24 Reconciler — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  // Find companies with IMMEX operations
  const { data: companies } = await supabase
    .from('companies')
    .select('company_id, name')
    .eq('active', true)

  const results = []

  for (const company of (companies || [])) {
    const result = await reconcileClient(company.company_id)
    if (!result || result.total_imports === 0) continue

    results.push({ ...result, name: company.name })
    console.log(`  ${company.name}: ${result.open_items} open / ${result.total_imports} total · ${fmtUSD(result.open_value)} · ${result.expired} expired · ${result.at_risk_30} <30d · ${result.at_risk_90} <90d`)
  }

  // Save results
  if (!DRY_RUN) {
    for (const r of results) {
      await supabase.from('benchmarks').upsert({
        metric: 'anexo24_open',
        dimension: r.company_id,
        value: r.open_items,
        sample_size: r.total_imports,
        period: new Date().toISOString().split('T')[0],
      }, { onConflict: 'metric,dimension' }).then(() => {}, () => {})
    }
  }

  // Telegram alerts
  const critical = results.filter(r => r.expired > 0 || r.at_risk_30 > 0)
  if (critical.length > 0) {
    const lines = [
      `📋 <b>Anexo 24 — Alerta IMMEX</b>`,
      ``,
    ]
    for (const r of critical) {
      if (r.expired > 0) lines.push(`🔴 <b>${r.name}</b>: ${r.expired} partida(s) VENCIDA(S)`)
      if (r.at_risk_30 > 0) lines.push(`🟡 <b>${r.name}</b>: ${r.at_risk_30} partida(s) vencen en <30 días`)
      if (r.at_risk_90 > 0) lines.push(`🔵 <b>${r.name}</b>: ${r.at_risk_90} partida(s) vencen en <90 días`)
    }
    lines.push(``, `Acción: exportar, transferir o regularizar`, `— CRUZ 🦀`)
    await sendTelegram(lines.join('\n'))
  }

  console.log(`\n✅ ${results.length} IMMEX clients reconciled`)
  if (critical.length > 0) console.log(`⚠️ ${critical.length} with deadline alerts`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
