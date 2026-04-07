#!/usr/bin/env node
/**
 * CRUZ Inventory Oracle — predict stockouts from import history
 *
 * For each client with consistent product imports:
 * 1. Estimate consumption rate from shipment frequency + weight
 * 2. Estimate current inventory from last shipment + elapsed time
 * 3. Calculate days-of-cover until depletion
 * 4. Predict reorder date accounting for supplier lead time
 * 5. Alert when days-of-cover < supplier_lead_time + buffer
 *
 * Pure inference from import patterns — no physical inventory counts needed.
 *
 * Cron: 0 5 * * * (daily 5 AM)
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
const SCRIPT_NAME = 'inventory-oracle'

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

function stdDev(arr) {
  if (arr.length < 2) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1))
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDate = d => `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`
const fmtKg = v => v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)} kg`

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`📦 Inventory Oracle — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const startTime = Date.now()
  const today = new Date()

  // Step 1: Fetch tráficos with weight + product data (last 2 years for patterns)
  const { data: allTraficos, error: tErr } = await supabase.from('traficos')
    .select('trafico, company_id, proveedores, descripcion_mercancia, fecha_llegada, peso_bruto, importe_total')
    .not('descripcion_mercancia', 'is', null)
    .not('fecha_llegada', 'is', null)
    .not('peso_bruto', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .order('fecha_llegada', { ascending: true })
    .limit(10000)

  if (tErr || !allTraficos?.length) {
    console.log('  Sin tráficos con datos de peso/producto.')
    await tg(`📦 <b>${SCRIPT_NAME}</b> — sin datos de tráficos.`)
    return
  }
  console.log(`  ${allTraficos.length} tráficos cargados`)

  // Step 2: Fetch supplier profiles for lead times
  const { data: supplierProfiles } = await supabase.from('supplier_profiles')
    .select('supplier_code, supplier_name, company_id, avg_turnaround_days, avg_crossing_hours')

  const leadTimeMap = new Map()
  for (const sp of supplierProfiles || []) {
    leadTimeMap.set(`${sp.company_id}::${sp.supplier_code}`, {
      turnaround: sp.avg_turnaround_days || 14,
      crossing: Math.ceil((sp.avg_crossing_hours || 48) / 24),
      name: sp.supplier_name || sp.supplier_code,
    })
  }

  // Step 3: Group tráficos by company_id::product_key
  // Normalize product by taking first 40 chars lowercase
  const productGroups = new Map()

  for (const t of allTraficos) {
    const desc = (t.descripcion_mercancia || '').trim()
    if (!desc || !t.peso_bruto || t.peso_bruto <= 0) continue

    const productKey = desc.substring(0, 40).toLowerCase().replace(/\s+/g, '_')
    const key = `${t.company_id}::${productKey}`
    const supplier = (t.proveedores || '').split(',')[0]?.trim() || null

    if (!productGroups.has(key)) {
      productGroups.set(key, {
        company_id: t.company_id,
        product_key: productKey,
        product_description: desc.substring(0, 60),
        shipments: [],
        suppliers: new Map(),
      })
    }

    const group = productGroups.get(key)
    group.shipments.push({
      date: new Date(t.fecha_llegada),
      weight_kg: Number(t.peso_bruto),
      value_usd: Number(t.importe_total) || 0,
      supplier,
    })

    if (supplier) {
      group.suppliers.set(supplier, (group.suppliers.get(supplier) || 0) + 1)
    }
  }

  // Step 4: For each product group with 3+ shipments, compute consumption model
  const estimates = []
  const alerts = []

  for (const [, group] of productGroups) {
    if (group.shipments.length < 3) continue

    const shipments = group.shipments.sort((a, b) => a.date.getTime() - b.date.getTime())

    // Intervals between shipments (in days)
    const intervals = []
    for (let i = 1; i < shipments.length; i++) {
      const days = (shipments[i].date.getTime() - shipments[i - 1].date.getTime()) / 86400000
      if (days > 0 && days < 365) intervals.push(days)
    }
    if (intervals.length < 2) continue

    const avgFreqDays = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const freqSD = stdDev(intervals)

    // Skip very irregular products (sd > 50% of mean)
    if (freqSD > avgFreqDays * 0.6) continue

    // Consumption per shipment (kg)
    const weights = shipments.map(s => s.weight_kg)
    const avgShipmentKg = weights.reduce((a, b) => a + b, 0) / weights.length
    const values = shipments.map(s => s.value_usd).filter(v => v > 0)
    const avgShipmentUsd = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0

    // Monthly consumption estimate
    const shipmentsPerMonth = 30 / avgFreqDays
    const avgMonthlyKg = Math.round(avgShipmentKg * shipmentsPerMonth * 10) / 10
    const avgMonthlyUsd = Math.round(avgShipmentUsd * shipmentsPerMonth)

    // Daily consumption rate
    const dailyConsumptionKg = avgMonthlyKg / 30

    // Current inventory estimate
    const lastShipment = shipments[shipments.length - 1]
    const daysSinceLastShipment = (today.getTime() - lastShipment.date.getTime()) / 86400000
    const consumedSinceLastKg = dailyConsumptionKg * daysSinceLastShipment
    const estimatedRemainingKg = Math.max(0, lastShipment.weight_kg - consumedSinceLastKg)

    // Days of cover
    const daysOfCover = dailyConsumptionKg > 0
      ? Math.round(estimatedRemainingKg / dailyConsumptionKg)
      : 999

    // Primary supplier + lead time
    const primarySupplier = [...group.suppliers.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null

    const supplierData = primarySupplier
      ? leadTimeMap.get(`${group.company_id}::${primarySupplier}`)
      : null
    const totalLeadDays = supplierData
      ? Math.ceil(supplierData.turnaround + supplierData.crossing)
      : 14 // Default 14 days if no supplier data

    // Reorder date = depletion - lead time - 3 day buffer
    const depletionDate = new Date(today.getTime() + daysOfCover * 86400000)
    const reorderDate = new Date(depletionDate.getTime() - (totalLeadDays + 3) * 86400000)

    // Risk level
    let riskLevel = 'ok'
    if (daysOfCover <= totalLeadDays) riskLevel = 'critical'     // Already past reorder point
    else if (daysOfCover <= totalLeadDays + 7) riskLevel = 'warning'  // Reorder within a week
    else if (daysOfCover <= totalLeadDays + 14) riskLevel = 'watch'   // Monitor

    // Confidence
    let confidence = 70
    if (freqSD < avgFreqDays * 0.2) confidence = 95
    else if (freqSD < avgFreqDays * 0.3) confidence = 85
    else if (freqSD < avgFreqDays * 0.4) confidence = 75

    const estimate = {
      company_id: group.company_id,
      product_key: group.product_key,
      product_description: group.product_description,
      avg_monthly_kg: avgMonthlyKg,
      avg_monthly_usd: avgMonthlyUsd,
      avg_shipment_kg: Math.round(avgShipmentKg * 10) / 10,
      shipment_frequency_days: Math.round(avgFreqDays * 10) / 10,
      last_shipment_date: lastShipment.date.toISOString().split('T')[0],
      last_shipment_kg: lastShipment.weight_kg,
      estimated_remaining_kg: Math.round(estimatedRemainingKg * 10) / 10,
      days_of_cover: daysOfCover,
      reorder_date: reorderDate.toISOString().split('T')[0],
      depletion_date: depletionDate.toISOString().split('T')[0],
      primary_supplier: primarySupplier?.substring(0, 80) || null,
      supplier_lead_time_days: totalLeadDays,
      supplier_doc_time_days: supplierData ? Math.ceil(supplierData.turnaround) : null,
      confidence,
      sample_size: shipments.length,
      risk_level: riskLevel,
      updated_at: new Date().toISOString(),
    }

    estimates.push(estimate)

    // Generate alerts for warning/critical
    if (riskLevel === 'warning' || riskLevel === 'critical') {
      const supplierName = supplierData?.name || primarySupplier || 'proveedor'
      const urgency = riskLevel === 'critical' ? 'URGENTE' : 'ATENCIÓN'

      alerts.push({
        company_id: group.company_id,
        product_key: group.product_key,
        product_description: group.product_description,
        primary_supplier: primarySupplier?.substring(0, 80),
        days_of_cover: daysOfCover,
        estimated_remaining_kg: Math.round(estimatedRemainingKg * 10) / 10,
        reorder_date: reorderDate.toISOString().split('T')[0],
        depletion_date: depletionDate.toISOString().split('T')[0],
        alert_message:
          `${urgency}: Estimación de ${group.product_description.substring(0, 40)}\n` +
          `Inventario estimado: ~${fmtKg(estimatedRemainingKg)}\n` +
          `Días de cobertura: ${daysOfCover} días\n` +
          `Fecha estimada de agotamiento: ${fmtDate(depletionDate)}\n` +
          `Tiempo de ${supplierName}: ~${totalLeadDays} días (doc + tránsito)\n` +
          `Recomendación: ordenar antes del ${fmtDate(reorderDate)}`,
        status: 'pending',
      })
    }

    console.log(
      `  ${riskLevel === 'critical' ? '🔴' : riskLevel === 'warning' ? '🟡' : riskLevel === 'watch' ? '🟠' : '🟢'} ` +
      `${group.company_id}/${group.product_description.substring(0, 25).padEnd(25)} · ` +
      `~${fmtKg(estimatedRemainingKg)} restante · ${daysOfCover}d cobertura · ` +
      `consume ${fmtKg(avgMonthlyKg)}/mes · ${shipments.length} envíos`
    )
  }

  // Step 5: Save to DB
  if (!DRY_RUN && estimates.length > 0) {
    for (const est of estimates) {
      const { error } = await supabase.from('inventory_estimates').upsert(est, {
        onConflict: 'company_id,product_key',
      })
      if (error) console.error(`  ⚠ Upsert failed: ${est.company_id}/${est.product_key}: ${error.message}`)
    }

    // Create alerts (only new ones — check if already alerted recently)
    for (const alert of alerts) {
      const { data: existing } = await supabase.from('reorder_alerts')
        .select('id')
        .eq('company_id', alert.company_id)
        .eq('product_key', alert.product_key)
        .in('status', ['pending', 'sent'])
        .gte('created_at', new Date(today.getTime() - 7 * 86400000).toISOString())
        .maybeSingle()

      if (!existing) {
        // Link to inventory_estimate
        const { data: est } = await supabase.from('inventory_estimates')
          .select('id')
          .eq('company_id', alert.company_id)
          .eq('product_key', alert.product_key)
          .single()

        await supabase.from('reorder_alerts').insert({
          ...alert,
          inventory_estimate_id: est?.id || null,
        })
      }
    }
  }

  // Step 6: Telegram alerts for critical items
  const criticals = estimates.filter(e => e.risk_level === 'critical')
  const warnings = estimates.filter(e => e.risk_level === 'warning')

  if (criticals.length > 0 || warnings.length > 0) {
    const lines = [
      `📦 <b>Inventory Oracle — Alertas</b>`,
      ``,
    ]

    if (criticals.length > 0) {
      lines.push(`🔴 <b>CRÍTICOS (${criticals.length}):</b>`)
      for (const c of criticals.slice(0, 5)) {
        lines.push(`  ${c.company_id}/${c.product_description.substring(0, 25)}`)
        lines.push(`  ~${fmtKg(c.estimated_remaining_kg)} · ${c.days_of_cover}d cobertura`)
        lines.push(`  Ordenar antes: ${fmtDate(new Date(c.reorder_date))}`)
        lines.push(``)
      }
    }

    if (warnings.length > 0) {
      lines.push(`🟡 <b>ATENCIÓN (${warnings.length}):</b>`)
      for (const w of warnings.slice(0, 3)) {
        lines.push(`  ${w.company_id}/${w.product_description.substring(0, 25)}`)
        lines.push(`  ~${fmtKg(w.estimated_remaining_kg)} · ${w.days_of_cover}d cobertura`)
        lines.push(``)
      }
    }

    lines.push(`— CRUZ 📦`)
    await tg(lines.join('\n'))
  }

  // Summary
  await tg(
    `📦 <b>Inventory Oracle — Resumen</b>\n\n` +
    `${estimates.length} productos analizados\n` +
    `🔴 ${criticals.length} críticos\n` +
    `🟡 ${warnings.length} atención\n` +
    `🟠 ${estimates.filter(e => e.risk_level === 'watch').length} monitoreo\n` +
    `🟢 ${estimates.filter(e => e.risk_level === 'ok').length} ok\n` +
    `${alerts.length} alertas generadas\n` +
    `Duración: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n\n` +
    `— CRUZ 📦`
  )

  // Heartbeat
  if (!DRY_RUN) {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME,
      status: 'success',
      details: {
        estimates: estimates.length,
        criticals: criticals.length,
        warnings: warnings.length,
        alerts: alerts.length,
        duration_ms: Date.now() - startTime,
      },
    }).catch(() => {})
  }

  console.log(`\n✅ ${estimates.length} estimaciones · ${criticals.length} críticos · ${warnings.length} atención · ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>${SCRIPT_NAME}</b> failed: ${err.message}`)
  process.exit(1)
})
