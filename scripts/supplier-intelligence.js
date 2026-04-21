require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'supplier-intelligence'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function sendTelegram(msg) {
  if (!process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_SILENT === 'true') return
  try {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: msg,
        parse_mode: 'Markdown'
      })
    })
  } catch (err) {
    console.error('Telegram send failed:', err.message)
  }
}

async function run() {
  console.log('🏭 Supplier Intelligence — pure analytics, no AI')

  // 1. Query traficos for EVCO
  // EVCO-specific — not a multi-client pattern
  const { data: traficos, error: fetchError } = await supabase
    .from('traficos')
    .select('trafico, descripcion_mercancia, proveedores, fecha_llegada, importe_total, estatus, fecha_cruce, company_id')
    .eq('company_id', 'evco')
    .order('fecha_llegada', { ascending: false })

  if (fetchError) throw new Error(`Failed to fetch traficos: ${fetchError.message}`)

  if (!traficos?.length) {
    console.log('⚠️ No traficos found for company_id=evco')
    return
  }

  console.log(`📦 ${traficos.length} traficos loaded`)

  // 2. Group by proveedores field
  const supplierMap = {}
  for (const t of traficos) {
    const supplier = t.proveedores || 'Desconocido'
    if (!supplierMap[supplier]) {
      supplierMap[supplier] = {
        ops: 0,
        totalValue: 0,
        crossingTimes: [],
        statuses: {}
      }
    }
    const s = supplierMap[supplier]
    s.ops++
    s.totalValue += t.importe_total || 0

    // 4. Crossing time: fecha_cruce - fecha_llegada (in hours)
    if (t.fecha_cruce && t.fecha_llegada) {
      const hours = (new Date(t.fecha_cruce) - new Date(t.fecha_llegada)) / (1000 * 60 * 60)
      if (hours > 0) s.crossingTimes.push(hours)
    }

    // Track status distribution
    const status = t.estatus || 'sin_estatus'
    s.statuses[status] = (s.statuses[status] || 0) + 1
  }

  // 3 & 4. Calculate metrics per supplier
  const metrics = []
  for (const [name, data] of Object.entries(supplierMap)) {
    const avgValue = data.ops > 0 ? data.totalValue / data.ops : 0
    const avgCrossingHours = data.crossingTimes.length > 0
      ? data.crossingTimes.reduce((a, b) => a + b, 0) / data.crossingTimes.length
      : null

    metrics.push({
      supplier_name: name,
      total_ops: data.ops,
      avg_shipment_value: Math.round(avgValue * 100) / 100,
      avg_crossing_hours: avgCrossingHours ? Math.round(avgCrossingHours * 10) / 10 : null,
      status_distribution: data.statuses,
      last_analyzed: new Date().toISOString()
    })
  }

  // Sort by ops descending
  metrics.sort((a, b) => b.total_ops - a.total_ops)

  // Print results
  console.log(`\n📊 ${metrics.length} suppliers found:\n`)
  for (const m of metrics) {
    const crossing = m.avg_crossing_hours ? `${m.avg_crossing_hours}h avg crossing` : 'no crossing data'
    console.log(`  ${m.supplier_name}: ${m.total_ops} ops · $${m.avg_shipment_value.toLocaleString()} avg · ${crossing}`)
  }

  // 5. Upsert to supplier_intelligence table
  const { error: upsertError } = await supabase
    .from('supplier_intelligence')
    .upsert(metrics, { onConflict: 'supplier_name' })

  if (upsertError) {
    console.error('❌ Upsert error:', upsertError.message)
    throw new Error(`Upsert failed: ${upsertError.message}`)
  }

  console.log(`\n✅ ${metrics.length} suppliers upserted to supplier_intelligence`)

  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: 'success',
    details: `${metrics.length} suppliers analyzed from ${traficos.length} traficos`,
    created_at: new Date().toISOString()
  })
}

module.exports = { run }

run()
  .then(() => {
    console.log('🏁 Done')
    process.exit(0)
  })
  .catch(async (err) => {
    console.error(`🔴 ${SCRIPT_NAME} failed:`, err.message)
    try {
      await supabase.from('heartbeat_log').insert({
        script: SCRIPT_NAME,
        status: 'failed',
        details: err.message,
        created_at: new Date().toISOString()
      })
    } catch (_) { /* best effort */ }
    await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${err.message}`)
    process.exit(1)
  })
