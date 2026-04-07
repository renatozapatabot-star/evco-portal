#!/usr/bin/env node
/**
 * CRUZ Profitability X-Ray — true profit per client
 *
 * For each client, computes:
 * - Revenue: brokerage fees (estimated from ops count × avg fee)
 * - Costs: staff time (from agent_decisions), AI costs (from api_cost_log),
 *   platform overhead (allocated by ops share)
 * - Net profit + margin
 * - Strategic insights: tier classification, growth signal, churn risk
 *
 * Cron: 0 3 1 * * (monthly, 1st of month at 3 AM)
 * Patente 3596 · Aduana 240
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
const SCRIPT_NAME = 'profitability-xray'

// Revenue assumptions (adjustable per client via system_config later)
const AVG_FEE_PER_OP_USD = 65     // Average brokerage fee per operation
const STAFF_HOURLY_RATE_USD = 15  // Blended rate for ops staff
const PLATFORM_MONTHLY_USD = 400  // Total platform cost (Supabase + Vercel + Anthropic)

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

const fmtUSD = v => `$${Math.round(v).toLocaleString()}`

async function main() {
  console.log(`💎 Profitability X-Ray — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const startTime = Date.now()

  // Compute for last complete month
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthKey = monthStart.toISOString().split('T')[0]
  const monthLabel = monthStart.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  console.log(`  Periodo: ${monthLabel}`)

  // Get all active companies
  const { data: companies } = await supabase.from('companies')
    .select('company_id')
    .eq('active', true)
  const companyIds = (companies || []).map(c => c.company_id)
  if (companyIds.length === 0) companyIds.push('evco')

  const results = []

  for (const companyId of companyIds) {
    // 1. Operations count this month
    const { count: opsCount } = await supabase.from('traficos')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('fecha_llegada', monthStart.toISOString())
      .lt('fecha_llegada', monthEnd.toISOString())

    const ops = opsCount || 0
    if (ops === 0) {
      console.log(`  ${companyId}: 0 operaciones — skip`)
      continue
    }

    // 2. Revenue estimate
    const brokerageFees = ops * AVG_FEE_PER_OP_USD
    const totalRevenue = brokerageFees

    // 3. Staff time estimate (from agent_decisions as proxy for human touchpoints)
    const { count: decisionsCount } = await supabase.from('agent_decisions')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString())

    // Each decision = ~5 min of staff equivalent; each op without decision = ~15 min
    const automatedOps = Math.min(ops, decisionsCount || 0)
    const manualOps = ops - automatedOps
    const staffHours = Math.round((automatedOps * 5 + manualOps * 15) / 60 * 10) / 10
    const staffCost = Math.round(staffHours * STAFF_HOURLY_RATE_USD)
    const automationPct = ops > 0 ? Math.round((automatedOps / ops) * 100) : 0

    // 4. AI cost (from api_cost_log)
    const { data: aiCosts } = await supabase.from('api_cost_log')
      .select('cost_usd')
      .eq('client_code', companyId)
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString())

    const aiCost = Math.round((aiCosts || []).reduce((s, c) => s + (Number(c.cost_usd) || 0), 0) * 100) / 100

    // 5. Platform overhead (proportional to ops share)
    const { count: totalOps } = await supabase.from('traficos')
      .select('id', { count: 'exact', head: true })
      .gte('fecha_llegada', monthStart.toISOString())
      .lt('fecha_llegada', monthEnd.toISOString())

    const opsShare = (totalOps || 1) > 0 ? ops / (totalOps || 1) : 1
    const platformOverhead = Math.round(PLATFORM_MONTHLY_USD * opsShare)

    // 6. Totals
    const totalCost = staffCost + aiCost + platformOverhead
    const netProfit = totalRevenue - totalCost
    const marginPct = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0

    // 7. Strategic insights
    let tier = 'bronze'
    if (netProfit >= 3000) tier = 'platinum'
    else if (netProfit >= 1500) tier = 'gold'
    else if (netProfit >= 500) tier = 'silver'

    // Growth signal: compare with prior month
    const { data: priorMonth } = await supabase.from('client_profitability')
      .select('operations_count, net_profit_usd')
      .eq('company_id', companyId)
      .lt('month', monthKey)
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle()

    const priorOps = priorMonth?.operations_count || ops
    const growthSignal = ops > priorOps * 1.1 ? 'growing' : ops < priorOps * 0.85 ? 'declining' : 'stable'
    const churnRisk = netProfit < 0 ? 'high' : netProfit < 200 ? 'moderate' : 'low'

    let recommendation = ''
    if (netProfit < 0) {
      recommendation = `Cliente no rentable (-${fmtUSD(Math.abs(netProfit))}). Aumentar tarifa o reducir servicio manual.`
    } else if (marginPct > 80) {
      recommendation = `Altamente rentable (${marginPct}% margen). Cliente prioritario para retención.`
    } else if (growthSignal === 'growing') {
      recommendation = `En crecimiento (+${ops - priorOps} ops). Oportunidad de upsell en servicios de consultoría.`
    } else if (growthSignal === 'declining') {
      recommendation = `Volumen en descenso. Verificar satisfacción y competencia.`
    } else {
      recommendation = `Estable. Mantener servicio actual, optimizar automatización.`
    }

    const result = {
      company_id: companyId,
      month: monthKey,
      brokerage_fees_usd: brokerageFees,
      consulting_fees_usd: 0,
      other_revenue_usd: 0,
      total_revenue_usd: totalRevenue,
      staff_time_hours: staffHours,
      staff_cost_usd: staffCost,
      ai_cost_usd: aiCost,
      platform_overhead_usd: platformOverhead,
      total_cost_usd: totalCost,
      net_profit_usd: netProfit,
      margin_pct: marginPct,
      operations_count: ops,
      revenue_per_operation: ops > 0 ? Math.round(totalRevenue / ops) : 0,
      cost_per_operation: ops > 0 ? Math.round(totalCost / ops) : 0,
      automation_pct: automationPct,
      insights: { tier, growth_signal: growthSignal, churn_risk: churnRisk, recommendation },
      updated_at: new Date().toISOString(),
    }

    results.push(result)

    const profitIcon = netProfit >= 0 ? '🟢' : '🔴'
    console.log(
      `  ${profitIcon} ${companyId}: ${fmtUSD(totalRevenue)} rev · ${fmtUSD(totalCost)} cost · ` +
      `${fmtUSD(netProfit)} profit (${marginPct}%) · ${ops} ops · ${tier}`
    )
  }

  // Save
  if (!DRY_RUN && results.length > 0) {
    for (const r of results) {
      await supabase.from('client_profitability').upsert(r, {
        onConflict: 'company_id,month',
      }).catch(err => console.error(`  ⚠ Upsert failed: ${err.message}`))
    }
  }

  // Telegram summary
  const profitable = results.filter(r => r.net_profit_usd >= 0)
  const unprofitable = results.filter(r => r.net_profit_usd < 0)
  const totalProfit = results.reduce((s, r) => s + r.net_profit_usd, 0)

  await tg(
    `💎 <b>Profitability X-Ray — ${monthLabel}</b>\n\n` +
    `${results.length} clientes analizados\n` +
    `${profitable.length} rentables · ${unprofitable.length} no rentables\n` +
    `Ganancia total: ${fmtUSD(totalProfit)} USD\n\n` +
    results.slice(0, 5).map(r =>
      `${r.net_profit_usd >= 0 ? '🟢' : '🔴'} ${r.company_id}: ${fmtUSD(r.net_profit_usd)} (${r.margin_pct}%)`
    ).join('\n') +
    `\n\n— CRUZ 💎`
  )

  if (!DRY_RUN) {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME, status: 'success',
      details: { clients: results.length, total_profit: totalProfit, month: monthKey },
    }).catch(() => {})
  }

  console.log(`\n✅ ${results.length} clientes · ${fmtUSD(totalProfit)} profit total · ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>${SCRIPT_NAME}</b> failed: ${err.message}`)
  process.exit(1)
})
