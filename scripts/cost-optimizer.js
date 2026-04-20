#!/usr/bin/env node
/**
 * CRUZ Landed Cost Optimizer — find savings in every operation
 *
 * Weekly analysis across 5 dimensions:
 * 1. Bridge optimization — faster/cheaper bridge for this route
 * 2. Filing timing — FX favorable days
 * 3. Supplier pricing — above network average
 * 4. Consolidation — combine shipments from same origin
 * 5. Regime optimization — T-MEC or alternate regime savings
 *
 * Each insight: specific dollar savings, confidence, actionable recommendation.
 * Monthly aggregate tracked in operations_savings.
 *
 * Cron: 0 4 * * 0 (weekly Sunday 4 AM)
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { getExchangeRate } = require('./lib/rates')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
// Telegram token/chat now owned by scripts/lib/telegram.js (shared helper).
const { fetchAll } = require('./lib/paginate')
const SCRIPT_NAME = 'cost-optimizer'

// Use the shared Telegram helper so transport errors are logged, not
// swallowed. core-invariants rule 18.
const { sendTelegram } = require('./lib/telegram')

async function tg(msg) {
  if (DRY_RUN) {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await sendTelegram(msg)
}

function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString() }
const fmtUSD = v => `$${Math.round(v).toLocaleString()}`

// ============================================================================
// Analysis functions
// ============================================================================

async function analyzeBridgeOptimization(companyId, traficos, crossingWindows) {
  const insights = []

  // Group crossings by DOW, find if there's a consistently faster day
  const dowTimes = [[], [], [], [], [], [], []] // Sun-Sat
  for (const t of traficos) {
    if (!t.fecha_llegada || !t.fecha_cruce) continue
    const arrivalDow = new Date(t.fecha_llegada).getDay()
    const crossingHours = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 3600000
    if (crossingHours > 0 && crossingHours < 240) {
      dowTimes[arrivalDow].push({ hours: crossingHours, trafico: t.trafico, value: Number(t.importe_total) || 0 })
    }
  }

  // Find the best and worst DOWs
  const dowAvgs = dowTimes.map((times, i) => ({
    dow: i,
    avg: times.length >= 3 ? times.reduce((s, t) => s + t.hours, 0) / times.length : null,
    count: times.length,
  })).filter(d => d.avg !== null)

  if (dowAvgs.length >= 2) {
    const best = dowAvgs.reduce((a, b) => a.avg < b.avg ? a : b)
    const worst = dowAvgs.reduce((a, b) => a.avg > b.avg ? a : b)
    const DOW_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

    if (worst.avg - best.avg > 12) { // >12h difference
      const opsPerMonth = Math.round(traficos.length / 6) // ~6 months of data
      const hoursSaved = Math.round(worst.avg - best.avg)
      // Value of faster crossing: reduced inventory carrying cost (~0.1% per day)
      const avgValue = traficos.reduce((s, t) => s + (Number(t.importe_total) || 0), 0) / traficos.length
      const savingsPerOp = Math.round(avgValue * 0.001 * (hoursSaved / 24))
      const monthlySavings = savingsPerOp * Math.round(opsPerMonth * 0.3) // 30% of ops could shift

      if (monthlySavings > 50) {
        insights.push({
          company_id: companyId,
          insight_type: 'bridge_optimization',
          trafico: null,
          supplier: null,
          product_description: null,
          estimated_savings_usd: monthlySavings,
          savings_basis: `Cruzar ${DOW_ES[best.dow]} en vez de ${DOW_ES[worst.dow]} ahorra ~${hoursSaved}h por operación`,
          confidence: 70,
          current_value: `Cruces distribuidos en todos los días (peor: ${DOW_ES[worst.dow]} ~${Math.round(worst.avg)}h)`,
          optimized_value: `Priorizar ${DOW_ES[best.dow]} (~${Math.round(best.avg)}h promedio, ${best.count} muestras)`,
          detail: { best_dow: best.dow, worst_dow: worst.dow, hours_diff: hoursSaved, ops_per_month: opsPerMonth },
        })
      }
    }
  }

  return insights
}

async function analyzeSupplierPricing(companyId, facturas) {
  const insights = []

  // Group facturas by supplier, compute avg price per kg
  const supplierPrices = new Map()
  for (const f of facturas) {
    const supplier = (f.proveedor || '').substring(0, 40).trim()
    if (!supplier || !f.valor_usd || f.valor_usd <= 0) continue
    if (!supplierPrices.has(supplier)) supplierPrices.set(supplier, [])
    supplierPrices.get(supplier).push(f.valor_usd)
  }

  // Network-wide average for comparison (from supplier_network_scores)
  const { data: networkScores } = await supabase.from('supplier_network_scores')
    .select('supplier_name, total_operations, reliability_score')
    .gte('total_operations', 10)
    .limit(100)

  // For each supplier with 5+ ops, check if they're above average
  for (const [supplier, values] of supplierPrices) {
    if (values.length < 5) continue
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length

    // Compare with network (all suppliers, same size range)
    const allValues = [...supplierPrices.values()].flat()
    const networkAvg = allValues.reduce((a, b) => a + b, 0) / allValues.length

    if (avgValue > networkAvg * 1.15 && avgValue - networkAvg > 500) {
      const overagePerOp = Math.round(avgValue - networkAvg)
      const opsPerMonth = Math.round(values.length / 6)
      const monthlySavings = overagePerOp * opsPerMonth

      if (monthlySavings > 100) {
        insights.push({
          company_id: companyId,
          insight_type: 'supplier_pricing',
          trafico: null,
          supplier: supplier.substring(0, 80),
          product_description: null,
          estimated_savings_usd: monthlySavings,
          savings_basis: `${supplier.substring(0, 25)} cobra ~${fmtUSD(overagePerOp)} más que el promedio por operación`,
          confidence: 60,
          current_value: `Precio promedio: ${fmtUSD(avgValue)} USD/operación`,
          optimized_value: `Promedio red: ${fmtUSD(networkAvg)} USD/operación (${Math.round(((avgValue - networkAvg) / networkAvg) * 100)}% arriba)`,
          detail: { supplier_avg: avgValue, network_avg: networkAvg, ops: values.length },
        })
      }
    }
  }

  return insights
}

async function analyzeConsolidation(companyId, traficos) {
  const insights = []

  // Find shipments from same supplier in same week
  const weekGroups = new Map()
  for (const t of traficos) {
    if (!t.proveedores || !t.fecha_llegada) continue
    const supplier = (t.proveedores || '').split(',')[0]?.trim()
    if (!supplier) continue
    const week = t.fecha_llegada.substring(0, 7) // YYYY-MM as proxy
    const key = `${supplier}::${week}`
    if (!weekGroups.has(key)) weekGroups.set(key, [])
    weekGroups.get(key).push(t)
  }

  // Find suppliers with multiple shipments in same month
  const consolidatable = [...weekGroups.entries()]
    .filter(([, ops]) => ops.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)

  if (consolidatable.length >= 3) {
    const totalConsolidatable = consolidatable.reduce((s, [, ops]) => s + ops.length, 0)
    const potentialConsolidated = consolidatable.length // One shipment per group instead
    const savedShipments = totalConsolidatable - potentialConsolidated
    const savingsPerShipment = 350 // Conservative: broker fees + crossing costs
    const monthlySavings = Math.round((savedShipments / 6) * savingsPerShipment) // Divide by ~6 months

    if (monthlySavings > 200) {
      const topSupplier = consolidatable[0][0].split('::')[0]
      insights.push({
        company_id: companyId,
        insight_type: 'consolidation',
        trafico: null,
        supplier: topSupplier.substring(0, 80),
        product_description: null,
        estimated_savings_usd: monthlySavings,
        savings_basis: `${savedShipments} envíos podrían consolidarse en ${potentialConsolidated} (${consolidatable.length} meses con múltiples envíos del mismo proveedor)`,
        confidence: 55,
        current_value: `${totalConsolidatable} envíos separados de proveedores repetidos`,
        optimized_value: `Consolidar a ${potentialConsolidated} envíos (~${fmtUSD(savingsPerShipment)}/envío ahorrado)`,
        detail: { consolidatable_groups: consolidatable.length, total_ops: totalConsolidatable, top_supplier: topSupplier },
      })
    }
  }

  return insights
}

async function analyzeFilingTiming(companyId, facturas, exchangeRate) {
  const insights = []

  // Analyze FX variation within recent weeks
  // If tipo de cambio varies > 1% within a week, timing matters
  const recentFacturas = facturas.filter(f => f.fecha_pago && f.valor_usd > 1000)
  if (recentFacturas.length < 10) return insights

  // Group by week, check FX variation via valor_usd consistency
  const totalValue = recentFacturas.reduce((s, f) => s + f.valor_usd, 0)
  const avgOpValue = totalValue / recentFacturas.length

  // Filing-timing heuristic: how much FX-opportunity upside to estimate per
  // pedimento when surrounding weeks show > 1% exchange-rate variation.
  // Not a regulatory rate — a business-tuned number the broker can adjust
  // without a code change. Pulled from system_config
  // (key: fx_savings_heuristic_pct, shape: { rate: number }). If missing,
  // skip the insight rather than fabricate a value — the rest of the
  // savings dimensions still run.
  const { data: heuristicCfg } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'fx_savings_heuristic_pct')
    .maybeSingle()
  const fxSavingsFactor = heuristicCfg?.value?.rate
  if (typeof fxSavingsFactor !== 'number' || fxSavingsFactor <= 0 || fxSavingsFactor > 0.05) {
    console.log(
      '[cost-optimizer] fx_savings_heuristic_pct not configured or outside sane range (0 < rate ≤ 0.05) — skipping filing-timing insight',
    )
    return insights
  }

  const monthlyOps = Math.round(recentFacturas.length / 6)
  const monthlySavings = Math.round(avgOpValue * fxSavingsFactor * monthlyOps)

  if (monthlySavings > 100) {
    insights.push({
      company_id: companyId,
      insight_type: 'filing_timing',
      trafico: null,
      supplier: null,
      product_description: null,
      estimated_savings_usd: monthlySavings,
      savings_basis: `Optimizar timing de pago de pedimento según tipo de cambio (TC actual: ${exchangeRate})`,
      confidence: 50,
      current_value: `Pedimentos pagados sin considerar variación de TC`,
      optimized_value: `Monitorear TC y retrasar 24-48h cuando tendencia es favorable (~${(fxSavingsFactor * 100).toFixed(1)}% ahorro)`,
      detail: { exchange_rate: exchangeRate, avg_op_value: avgOpValue, monthly_ops: monthlyOps, fx_savings_factor: fxSavingsFactor },
    })
  }

  return insights
}

async function analyzeRegimeOptimization(companyId, traficos, facturas) {
  const insights = []

  // Find operations NOT using T-MEC that could qualify
  const nonTmec = traficos.filter(t => !['ITE', 'ITR', 'IMD'].includes((t.regimen || '').toUpperCase()))
  const tmec = traficos.filter(t => ['ITE', 'ITR', 'IMD'].includes((t.regimen || '').toUpperCase()))

  // If there are both T-MEC and non-T-MEC ops with same supplier, the non-T-MEC might qualify
  const tmecSuppliers = new Set(tmec.map(t => (t.proveedores || '').split(',')[0]?.trim()).filter(Boolean))
  const potentialTmec = nonTmec.filter(t => {
    const supplier = (t.proveedores || '').split(',')[0]?.trim()
    return supplier && tmecSuppliers.has(supplier)
  })

  if (potentialTmec.length >= 2) {
    // Estimate IGI savings (typically 5-15% of value for T-MEC eligible)
    const avgValue = potentialTmec.reduce((s, t) => s + (Number(t.importe_total) || 0), 0) / potentialTmec.length
    const igiSavingsPerOp = Math.round(avgValue * 0.05) // Conservative 5% IGI reduction
    const monthlySavings = Math.round((potentialTmec.length / 6) * igiSavingsPerOp)

    if (monthlySavings > 200) {
      insights.push({
        company_id: companyId,
        insight_type: 'regime_optimization',
        trafico: null,
        supplier: null,
        product_description: null,
        estimated_savings_usd: monthlySavings,
        savings_basis: `${potentialTmec.length} operaciones de proveedores con T-MEC existente podrían calificar para régimen preferencial`,
        confidence: 45,
        current_value: `${nonTmec.length} operaciones sin T-MEC`,
        optimized_value: `Revisar certificados de origen — potencial ${potentialTmec.length} ops elegibles (~${Math.round((potentialTmec.length / nonTmec.length) * 100)}%)`,
        detail: { potential_ops: potentialTmec.length, avg_value: avgValue, tmec_suppliers: [...tmecSuppliers].slice(0, 5) },
      })
    }
  }

  return insights
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`💰 Cost Optimizer — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const startTime = Date.now()

  const fxData = await getExchangeRate()
  if (!fxData?.rate) throw new Error('Exchange rate unavailable from system_config — refusing to calculate with stale data')
  const exchangeRate = fxData.rate

  // Multi-client
  const { data: companies } = await supabase.from('companies')
    .select('company_id')
    .eq('active', true)
  const companyIds = (companies || []).map(c => c.company_id)
  if (companyIds.length === 0) { companyIds.push('evco'); console.warn('  ⚠️  No active companies found — falling back to evco') }

  let totalInsights = 0
  let totalSavings = 0

  for (const companyId of companyIds) {
    console.log(`\n  Analizando: ${companyId}`)

    // Fetch data
    const [traficos, allFacturas, crossingWindows] = await Promise.all([
      fetchAll(supabase.from('traficos')
        .select('trafico, company_id, proveedores, descripcion_mercancia, fecha_llegada, fecha_cruce, importe_total, regimen, estatus')
        .eq('company_id', companyId)
        .gte('fecha_llegada', '2024-01-01')
        .not('fecha_llegada', 'is', null)),
      fetchAll(supabase.from('aduanet_facturas')
        .select('referencia, clave_cliente, proveedor, valor_usd, fecha_pago')
        .eq('clave_cliente', companyId)
        .not('proveedor', 'is', null)
        .gte('fecha_pago', '2024-01-01')),
      fetchAll(supabase.from('crossing_windows')
        .select('*')
        .eq('company_id', companyId)),
    ])

    // Dedup facturas
    const seenRef = new Set()
    const facturas = allFacturas.filter(f => {
      if (!f.referencia || seenRef.has(f.referencia)) return false
      seenRef.add(f.referencia)
      return true
    })
    if (traficos.length < 10) {
      console.log(`    Insuficientes operaciones (${traficos.length})`)
      continue
    }

    // Run all analyses
    const allInsights = [
      ...(await analyzeBridgeOptimization(companyId, traficos, crossingWindows)),
      ...(await analyzeSupplierPricing(companyId, facturas)),
      ...(await analyzeConsolidation(companyId, traficos)),
      ...(await analyzeFilingTiming(companyId, facturas, exchangeRate)),
      ...(await analyzeRegimeOptimization(companyId, traficos, facturas)),
    ]

    // Add MXN estimates
    for (const insight of allInsights) {
      insight.estimated_savings_mxn = Math.round(insight.estimated_savings_usd * exchangeRate)
    }

    console.log(`    ${allInsights.length} insights encontrados`)
    for (const ins of allInsights) {
      console.log(`    💡 ${ins.insight_type}: ${fmtUSD(ins.estimated_savings_usd)} USD/mes · ${ins.confidence}% conf`)
      console.log(`       ${ins.savings_basis}`)
    }

    // Save insights
    if (!DRY_RUN && allInsights.length > 0) {
      for (const ins of allInsights) {
        await supabase.from('cost_insights').upsert(ins, {
          onConflict: 'company_id,trafico,insight_type',
        }).catch(err => console.error(`    ⚠ Upsert failed: ${err.message}`))
      }

      // Update monthly aggregate
      const monthStart = new Date()
      monthStart.setDate(1)
      const monthKey = monthStart.toISOString().split('T')[0]

      const totalEstimated = allInsights.reduce((s, i) => s + i.estimated_savings_usd, 0)
      const byType = {}
      for (const ins of allInsights) {
        byType[ins.insight_type] = (byType[ins.insight_type] || 0) + ins.estimated_savings_usd
      }

      await supabase.from('operations_savings').upsert({
        company_id: companyId,
        month: monthKey,
        insights_generated: allInsights.length,
        estimated_savings_usd: totalEstimated,
        savings_by_type: byType,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,month' }).catch((upsertErr) => {
        console.warn(`  [operations_savings upsert skip] ${companyId} ${monthKey}: ${upsertErr?.message || upsertErr}`)
      })
    }

    totalInsights += allInsights.length
    totalSavings += allInsights.reduce((s, i) => s + i.estimated_savings_usd, 0)
  }

  // Telegram summary
  if (totalInsights > 0) {
    await tg(
      `💰 <b>Cost Optimizer — ${totalInsights} oportunidades</b>\n\n` +
      `Ahorro potencial: ~${fmtUSD(totalSavings)} USD/mes\n` +
      `${companyIds.length} empresa(s) analizadas\n` +
      `Duración: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n\n` +
      `— CRUZ 💰`
    )
  }

  if (!DRY_RUN) {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME,
      status: 'success',
      details: { insights: totalInsights, savings_usd: totalSavings, companies: companyIds.length },
    }).catch((hbErr) => {
      console.warn(`  [heartbeat insert skip] ${SCRIPT_NAME}: ${hbErr?.message || hbErr}`)
    })
  }

  console.log(`\n✅ ${totalInsights} insights · ~${fmtUSD(totalSavings)} USD/mes potencial · ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>${SCRIPT_NAME}</b> failed: ${err.message}`)
  process.exit(1)
})
