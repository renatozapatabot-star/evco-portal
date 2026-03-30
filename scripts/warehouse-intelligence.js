const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'

function fmtNum(n) { return Number(n || 0).toLocaleString('es-MX') }

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function run() {
  console.log('🏭 Warehouse Intelligence — Starting...\n')

  let conn
  try {
    conn = await mysql.createConnection({
      host: process.env.GLOBALPC_DB_HOST,
      port: Number(process.env.GLOBALPC_DB_PORT),
      user: process.env.GLOBALPC_DB_USER,
      password: process.env.GLOBALPC_DB_PASS,
      database: 'bd_demo_38',
      connectTimeout: 15000,
    })
    console.log('✅ MySQL connected\n')
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message)
    return
  }

  try {
    // Query warehouse entries
    // cb_entrada_bodega: sCveEntradaBodega, iCveEmbarque, sCveCliente, sCveProveedor,
    //   iCantidadBultosRecibidos, iPesoBruto, iPesoNeto, bFaltantes, bMercanciaDanada,
    //   sRecibidoPor, dFechaLlegadaMercancia, dFechaIngreso, sCveTransportistaAmericano, sCveTransportistaMexicano
    const [entries] = await conn.query(`
      SELECT
        e.sCveEntradaBodega AS cve_entrada,
        e.sCveCliente AS cve_trafico,
        e.dFechaLlegadaMercancia AS fecha_entrada,
        e.dFechaIngreso AS fecha_salida,
        e.iCantidadBultosRecibidos AS bultos_recibidos,
        NULL AS bultos_esperados,
        e.iPesoBruto AS peso_recibido,
        e.iPesoNeto AS peso_esperado,
        e.bFaltantes AS tiene_faltantes,
        e.bMercanciaDanada AS mercancia_danada,
        e.sRecibidoPor AS recibido_por
      FROM cb_entrada_bodega e
      ORDER BY e.dFechaLlegadaMercancia DESC
    `)
    console.log(`📦 Fetched ${fmtNum(entries.length)} warehouse entries\n`)

    // Get carrier info from traficos
    const [traficos] = await conn.query(`
      SELECT sCveTrafico AS cve_trafico, sCveTransportistaMexicano AS transportista_mexicano, sCveTransportistaAmericano AS transportista_extranjero
      FROM cb_trafico
    `)
    const traficoCarriers = {}
    traficos.forEach(t => {
      traficoCarriers[t.cve_trafico] = {
        mx: t.transportista_mexicano,
        ext: t.transportista_extranjero,
      }
    })

    // Get supplier info from facturas
    const [facturas] = await conn.query(`
      SELECT DISTINCT sCveTrafico AS cve_trafico, sCveProveedor AS proveedor
      FROM cb_factura
      WHERE sCveProveedor IS NOT NULL
    `)
    const traficoSuppliers = {}
    facturas.forEach(f => {
      if (!traficoSuppliers[f.cve_trafico]) traficoSuppliers[f.cve_trafico] = new Set()
      traficoSuppliers[f.cve_trafico].add(f.proveedor)
    })

    // Calculate KPIs
    let shortageCount = 0
    let damageCount = 0
    let weightVariances = []
    let dwellTimes = []
    const carrierShortages = {}
    const supplierDamages = {}

    entries.forEach(e => {
      // Shortage detection (bFaltantes is enum '0'/'1')
      const hasShortage = e.tiene_faltantes === '1' || e.tiene_faltantes === 1 || e.tiene_faltantes === true ||
        (e.bultos_recibidos && e.bultos_esperados && Number(e.bultos_recibidos) < Number(e.bultos_esperados))
      if (hasShortage) {
        shortageCount++
        const carrier = traficoCarriers[e.cve_trafico]?.mx || 'Unknown'
        carrierShortages[carrier] = (carrierShortages[carrier] || 0) + 1
      }

      // Damage detection (bMercanciaDanada is enum '0'/'1')
      if (e.mercancia_danada === '1' || e.mercancia_danada === 1 || e.mercancia_danada === true) {
        damageCount++
        const suppliers = traficoSuppliers[e.cve_trafico]
        if (suppliers) {
          suppliers.forEach(s => {
            supplierDamages[s] = (supplierDamages[s] || 0) + 1
          })
        }
      }

      // Weight variance
      if (e.peso_recibido && e.peso_esperado && Number(e.peso_esperado) > 0) {
        const variance = (Number(e.peso_recibido) - Number(e.peso_esperado)) / Number(e.peso_esperado)
        weightVariances.push(variance)
      }

      // Dwell time
      if (e.fecha_entrada && e.fecha_salida) {
        const hours = (new Date(e.fecha_salida).getTime() - new Date(e.fecha_entrada).getTime()) / 3600000
        if (hours > 0 && hours < 720) dwellTimes.push(hours)
      }
    })

    const totalEntries = entries.length
    const shortageRate = totalEntries > 0 ? shortageCount / totalEntries : 0
    const damageRate = totalEntries > 0 ? damageCount / totalEntries : 0
    const avgWeightVariance = weightVariances.length > 0
      ? weightVariances.reduce((s, v) => s + v, 0) / weightVariances.length
      : 0
    const avgDwellHours = dwellTimes.length > 0
      ? dwellTimes.reduce((s, v) => s + v, 0) / dwellTimes.length
      : 0

    // Worst carrier and supplier
    const worstCarrier = Object.entries(carrierShortages).sort((a, b) => b[1] - a[1])[0]
    const worstSupplier = Object.entries(supplierDamages).sort((a, b) => b[1] - a[1])[0]

    console.log(`📊 Warehouse KPIs:`)
    console.log(`   Total entries: ${fmtNum(totalEntries)}`)
    console.log(`   Shortage rate: ${(shortageRate * 100).toFixed(2)}% (${shortageCount} incidents)`)
    console.log(`   Damage rate: ${(damageRate * 100).toFixed(2)}% (${damageCount} incidents)`)
    console.log(`   Avg weight variance: ${(avgWeightVariance * 100).toFixed(2)}%`)
    console.log(`   Avg dwell time: ${avgDwellHours.toFixed(1)} hours`)
    console.log(`   Worst carrier (shortages): ${worstCarrier ? `${worstCarrier[0]} (${worstCarrier[1]})` : 'N/A'}`)
    console.log(`   Worst supplier (damage): ${worstSupplier ? `${worstSupplier[0]} (${worstSupplier[1]})` : 'N/A'}\n`)

    // Group by month for trend
    const monthlyEntries = {}
    entries.forEach(e => {
      if (!e.fecha_entrada) return
      const d = new Date(e.fecha_entrada)
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      if (!monthlyEntries[period]) {
        monthlyEntries[period] = { total: 0, shortages: 0, damages: 0 }
      }
      monthlyEntries[period].total++
      const hasShortage = e.tiene_faltantes ||
        (e.bultos_recibidos && e.bultos_esperados && Number(e.bultos_recibidos) < Number(e.bultos_esperados))
      if (hasShortage) monthlyEntries[period].shortages++
      if (e.mercancia_danada) monthlyEntries[period].damages++
    })

    const records = Object.entries(monthlyEntries).sort().map(([period, data]) => ({
      period,
      total_entries: data.total,
      shortage_rate: Math.round((data.shortages / data.total) * 10000) / 10000,
      damage_rate: Math.round((data.damages / data.total) * 10000) / 10000,
      avg_weight_variance: Math.round(avgWeightVariance * 10000) / 10000,
      worst_carrier: worstCarrier ? worstCarrier[0] : null,
      worst_supplier: worstSupplier ? worstSupplier[0] : null,
      shortage_prediction_accuracy: null,
      company_id: COMPANY_ID,
      calculated_at: new Date().toISOString(),
    }))

    // Save to Supabase
    const BATCH = 200
    let saved = 0
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)
      const { error } = await supabase.from('warehouse_intelligence').upsert(batch, {
        onConflict: 'period,company_id',
        ignoreDuplicates: false,
      })
      if (error) {
        if (error.code === '42P01') {
          console.error('❌ Table warehouse_intelligence does not exist. Run the SQL migration first.')
          return
        }
        console.error('Batch error:', error.message)
      } else {
        saved += batch.length
      }
    }
    console.log(`✅ Saved ${fmtNum(saved)} warehouse intelligence records\n`)

    // Build shortage prediction model
    // Probability = f(carrier_shortage_rate, supplier_damage_rate)
    const predictionData = entries.slice(0, 1000).map(e => {
      const carrier = traficoCarriers[e.cve_trafico]?.mx || 'Unknown'
      const carrierRate = carrierShortages[carrier]
        ? carrierShortages[carrier] / entries.filter(en =>
            (traficoCarriers[en.cve_trafico]?.mx || 'Unknown') === carrier
          ).length
        : 0

      return {
        trafico: e.cve_trafico,
        carrier,
        shortage_probability: Math.round(Math.min(carrierRate * 1.5, 1) * 100) / 100,
      }
    })

    // Save predictions for active tráficos to compliance_predictions
    const highRiskEntries = predictionData.filter(p => p.shortage_probability > 0.15).slice(0, 20)
    if (highRiskEntries.length > 0) {
      const riskRecords = highRiskEntries.map(p => ({
        prediction_type: 'warehouse_shortage',
        entity_id: String(p.trafico),
        description: `Riesgo de faltantes: ${Math.round(p.shortage_probability * 100)}% — carrier: ${p.carrier}`,
        risk_level: p.shortage_probability > 0.3 ? 'high' : 'medium',
        confidence: 0.7,
        company_id: COMPANY_ID,
        created_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from('compliance_predictions').upsert(riskRecords, {
        onConflict: 'prediction_type,entity_id',
        ignoreDuplicates: false,
      })
      if (error) console.error('Predictions error:', error.message)
      else console.log(`⚠️  ${riskRecords.length} shortage risk predictions saved`)
    }

    // Only send Telegram if shortage or damage rate is elevated
    const shortageCount = records.filter(r => r.shortage_count > 0).reduce((s, r) => s + r.shortage_count, 0)
    const damageCount = records.filter(r => r.damage_count > 0).reduce((s, r) => s + r.damage_count, 0)
    if (shortageRate > 0.005 || damageRate > 0.03) {
      await sendTelegram(
        `⚠️ <b>Warehouse Alert</b>\n\n` +
        `Shortages: ${shortageCount} (${(shortageRate * 100).toFixed(2)}%)\n` +
        `Damages: ${damageCount} (${(damageRate * 100).toFixed(2)}%)\n` +
        `Worst carrier: ${worstCarrier ? worstCarrier[0] : 'N/A'}\n` +
        `Worst supplier: ${worstSupplier ? worstSupplier[0] : 'N/A'}\n\n` +
        `CRUZ 🦀`
      )
    }

    console.log('\n✅ Warehouse Intelligence — Complete')

  } catch (err) {
    console.error('❌ Error:', err.message)
    await sendTelegram(`❌ Warehouse Intelligence failed: ${err.message}`)
  } finally {
    if (conn) await conn.end()
  }
}

run()
