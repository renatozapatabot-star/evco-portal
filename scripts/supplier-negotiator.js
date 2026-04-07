#!/usr/bin/env node
/**
 * CRUZ Supplier Negotiator — generate negotiation briefs with leverage
 *
 * For each client's top suppliers:
 * 1. YOUR LEVERAGE — operations count, total spend, relationship length
 * 2. PERFORMANCE — doc turnaround, compliance, T-MEC, late deliveries
 * 3. MARKET CONTEXT — price vs network avg, alternative suppliers
 * 4. NEGOTIATION ANGLE — specific strategy + draft message
 * 5. POTENTIAL OUTCOME — estimated savings if negotiation succeeds
 *
 * Cron: 0 5 * * 1 (weekly Monday 5 AM)
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
const SCRIPT_NAME = 'supplier-negotiator'

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
  console.log(`🤝 Supplier Negotiator — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const startTime = Date.now()

  // Multi-client
  const { data: companies } = await supabase.from('companies')
    .select('company_id').eq('active', true)
  const companyIds = (companies || []).map(c => c.company_id)
  if (companyIds.length === 0) companyIds.push('evco')

  let totalBriefs = 0

  for (const companyId of companyIds) {
    // Fetch tráficos for supplier analysis
    const { data: traficos } = await supabase.from('traficos')
      .select('trafico, proveedores, fecha_llegada, fecha_cruce, importe_total, regimen')
      .eq('company_id', companyId)
      .not('proveedores', 'is', null)
      .gte('fecha_llegada', '2023-01-01')
      .limit(5000)

    if (!traficos || traficos.length < 10) continue

    // Fetch facturas (deduped)
    const { data: allFacturas } = await supabase.from('aduanet_facturas')
      .select('referencia, proveedor, valor_usd')
      .eq('clave_cliente', companyId)
      .not('proveedor', 'is', null)
      .not('valor_usd', 'is', null)
      .gte('fecha_pago', '2023-01-01')
      .limit(5000)

    const seenRef = new Set()
    const facturas = (allFacturas || []).filter(f => {
      if (!f.referencia || seenRef.has(f.referencia)) return false
      seenRef.add(f.referencia)
      return true
    })

    // Fetch supplier profiles
    const { data: profiles } = await supabase.from('supplier_profiles')
      .select('supplier_code, supplier_name, total_operations, avg_value_usd, avg_turnaround_days, reliability_score, on_time_pct')
      .eq('company_id', companyId)
      .order('total_operations', { ascending: false })

    // Fetch network scores for alternatives
    const { data: networkScores } = await supabase.from('supplier_network_scores')
      .select('supplier_name, total_operations, reliability_score, compliance_rate, tmec_qualification_rate')
      .gte('total_operations', 5)
      .order('reliability_score', { ascending: false })
      .limit(50)

    // Group tráficos by supplier
    const supplierOps = new Map()
    for (const t of traficos) {
      const supplier = (t.proveedores || '').split(',')[0]?.trim()
      if (!supplier) continue
      if (!supplierOps.has(supplier)) supplierOps.set(supplier, [])
      supplierOps.get(supplier).push(t)
    }

    // Group facturas by supplier
    const supplierValues = new Map()
    for (const f of facturas) {
      const supplier = (f.proveedor || '').substring(0, 40).trim()
      if (!supplier) continue
      if (!supplierValues.has(supplier)) supplierValues.set(supplier, [])
      supplierValues.get(supplier).push(Number(f.valor_usd))
    }

    // Network average price
    const allValues = [...supplierValues.values()].flat()
    const networkAvgPrice = allValues.length > 0
      ? allValues.reduce((a, b) => a + b, 0) / allValues.length
      : 0

    // Generate briefs for top suppliers (5+ ops)
    const briefs = []

    for (const [supplier, ops] of supplierOps) {
      if (ops.length < 5) continue

      const profile = (profiles || []).find(p =>
        p.supplier_code === supplier || p.supplier_name === supplier
      )

      // Leverage data
      const totalValue = ops.reduce((s, t) => s + (Number(t.importe_total) || 0), 0)
      ops.sort((a, b) => (a.fecha_llegada || '').localeCompare(b.fecha_llegada || ''))
      const firstOp = new Date(ops[0].fecha_llegada)
      const relationshipMonths = Math.round((Date.now() - firstOp.getTime()) / (30 * 86400000))

      // Performance
      const tmecOps = ops.filter(t => ['ITE', 'ITR', 'IMD'].includes((t.regimen || '').toUpperCase()))
      const tmecPct = Math.round((tmecOps.length / ops.length) * 100)

      const crossingOps = ops.filter(t => t.fecha_llegada && t.fecha_cruce)
      const avgCrossingDays = crossingOps.length > 0
        ? crossingOps.reduce((s, t) =>
            s + (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000, 0
          ) / crossingOps.length
        : 0

      // Pricing
      const values = supplierValues.get(supplier.substring(0, 40).trim()) || []
      const supplierAvgPrice = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
      const priceVsMarket = networkAvgPrice > 0
        ? Math.round(((supplierAvgPrice - networkAvgPrice) / networkAvgPrice) * 100)
        : 0

      // Alternative suppliers (from network, exclude current)
      const alternatives = (networkScores || [])
        .filter(ns => ns.supplier_name !== supplier && ns.supplier_name)
        .slice(0, 3)
        .map(ns => ({
          name: ns.supplier_name,
          reliability_score: ns.reliability_score,
          compliance_rate: ns.compliance_rate,
        }))

      // Negotiation angle
      let angle = ''
      let potentialSavings = 0
      let risk = ''
      let suggestedMessage = ''

      if (priceVsMarket > 10 && supplierAvgPrice > 1000) {
        // Price above market
        const reduction = Math.round(supplierAvgPrice * (priceVsMarket / 100) * 0.5) // Aim for half the gap
        potentialSavings = Math.round(reduction * (ops.length / 12)) // Monthly
        angle = `Precio ${priceVsMarket}% arriba del promedio. Negociar reducción basada en datos de mercado.`
        risk = ops.length >= 20 ? 'Bajo — relación sólida' : 'Moderado — volumen puede no ser suficiente para exigir'
        suggestedMessage = `Estimado proveedor,\n\nEstamos revisando costos de materiales. ` +
          `El precio promedio en nuestro portafolio para productos similares es ` +
          `${fmtUSD(networkAvgPrice)} USD por operación. ` +
          `Nuestro promedio con ustedes es ${fmtUSD(supplierAvgPrice)} USD.\n\n` +
          `Dado nuestro volumen de ${ops.length} operaciones y relación de ${relationshipMonths} meses, ` +
          `¿podrían revisar los precios para alinearse con el mercado?\n\n` +
          `— Renato Zapata y Cía · Patente 3596`
      } else if (tmecPct < 50 && tmecOps.length > 0) {
        // T-MEC underutilized
        const tmecSavings = Math.round((ops.length - tmecOps.length) * supplierAvgPrice * 0.05 / 12)
        potentialSavings = tmecSavings
        angle = `Solo ${tmecPct}% de operaciones con T-MEC. Solicitar certificados para el resto.`
        risk = 'Bajo — beneficia a ambas partes'
        suggestedMessage = `Estimado proveedor,\n\n` +
          `${tmecOps.length} de ${ops.length} operaciones califican para T-MEC. ` +
          `¿Podrían emitir certificados de origen para todas las operaciones elegibles? ` +
          `Esto reduce impuestos para ambas partes.\n\n` +
          `— Renato Zapata y Cía · Patente 3596`
      } else {
        // Good supplier — lock in terms
        angle = `Buen proveedor. Negociar términos de pago extendidos o descuento por volumen comprometido.`
        potentialSavings = Math.round(supplierAvgPrice * 0.03 * (ops.length / 12))
        risk = 'Bajo — negociación amistosa'
        suggestedMessage = `Estimado proveedor,\n\n` +
          `Agradecemos la excelente relación comercial de ${relationshipMonths} meses ` +
          `y ${ops.length} operaciones. Para ${new Date().getFullYear() + 1}, ` +
          `¿podemos acordar un compromiso de volumen a cambio de 3% de descuento ` +
          `o extensión de términos de pago a 60 días?\n\n` +
          `— Renato Zapata y Cía · Patente 3596`
      }

      const brief = {
        company_id: companyId,
        supplier: supplier.substring(0, 80),
        total_operations: ops.length,
        total_value_usd: Math.round(totalValue),
        relationship_months: relationshipMonths,
        client_rank_for_supplier: null, // Would need cross-client data
        doc_turnaround_days: profile?.avg_turnaround_days || null,
        compliance_rate_pct: profile ? Math.round((profile.reliability_score || 0)) : null,
        tmec_qualification_pct: tmecPct,
        late_delivery_pct: profile?.on_time_pct ? Math.round(100 - profile.on_time_pct) : null,
        pricing_trend: 'stable',
        supplier_avg_price_usd: Math.round(supplierAvgPrice),
        network_avg_price_usd: Math.round(networkAvgPrice),
        price_vs_market_pct: priceVsMarket,
        alternative_suppliers: alternatives,
        negotiation_angle: angle,
        potential_savings_usd: potentialSavings,
        risk_assessment: risk,
        suggested_message: suggestedMessage,
        status: 'generated',
        updated_at: new Date().toISOString(),
      }

      briefs.push(brief)

      console.log(
        `  🤝 ${companyId}/${supplier.substring(0, 20).padEnd(20)} · ` +
        `${ops.length} ops · ${fmtUSD(totalValue)} · ` +
        `${priceVsMarket > 0 ? '+' : ''}${priceVsMarket}% vs mercado · ` +
        `potencial: ${fmtUSD(potentialSavings)}/mes`
      )
    }

    // Save
    if (!DRY_RUN && briefs.length > 0) {
      for (const b of briefs) {
        await supabase.from('negotiation_briefs').upsert(b, {
          onConflict: 'company_id,supplier',
        }).catch(err => console.error(`  ⚠ ${err.message}`))
      }
    }

    totalBriefs += briefs.length
  }

  await tg(
    `🤝 <b>Supplier Negotiator — ${totalBriefs} briefs</b>\n\n` +
    `${companyIds.length} empresa(s)\n` +
    `Duración: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n\n` +
    `— CRUZ 🤝`
  )

  if (!DRY_RUN) {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME, status: 'success',
      details: { briefs: totalBriefs, companies: companyIds.length },
    }).catch(() => {})
  }

  console.log(`\n✅ ${totalBriefs} briefs generados · ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>${SCRIPT_NAME}</b> failed: ${err.message}`)
  process.exit(1)
})
