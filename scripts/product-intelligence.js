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
function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) }

function calcStats(values) {
  if (!values || values.length === 0) return { mean: 0, std: 0, count: 0 }
  const n = values.length
  const mean = values.reduce((s, v) => s + v, 0) / n
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n
  const std = Math.sqrt(variance)
  return { mean: Math.round(mean * 10000) / 10000, std: Math.round(std * 10000) / 10000, count: n }
}

function determineTrend(prices) {
  if (prices.length < 3) return 'stable'
  const half = Math.floor(prices.length / 2)
  const firstHalf = prices.slice(0, half)
  const secondHalf = prices.slice(half)
  const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length
  const change = (avgSecond - avgFirst) / avgFirst
  if (change > 0.1) return 'up'
  if (change < -0.1) return 'down'
  return 'stable'
}

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function run() {
  console.log('📦 Product Intelligence Engine — Starting...\n')

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
    // Query product data joined with invoices
    // cb_producto_factura: iFolio (FK), sCveClienteProveedorProducto, iPrecioUnitarioProducto, iCantidadProducto, sCveUMC, sCvePais
    // cb_factura: iFolio (PK), sCveProveedor, dFechaFacturacion, sCveTrafico
    const [rows] = await conn.query(`
      SELECT
        p.sCveClienteProveedorProducto AS descripcion,
        SUBSTRING(p.sCveClienteProveedorProducto, 1, 10) AS fraccion,
        p.iPrecioUnitarioProducto AS valor_unitario,
        p.iCantidadProducto AS cantidad,
        p.sCveUMC AS unidad_medida,
        f.sCveProveedor AS proveedor,
        f.dFechaFacturacion AS fecha_factura
      FROM cb_producto_factura p
      JOIN cb_factura f ON f.iFolio = p.iFolio
      WHERE p.iPrecioUnitarioProducto > 0
        AND p.sCveClienteProveedorProducto IS NOT NULL
        AND p.sCveClienteProveedorProducto != ''
      ORDER BY f.dFechaFacturacion DESC
    `)

    console.log(`📊 Fetched ${fmtNum(rows.length)} product records from GlobalPC\n`)

    // Group by fracción + descripción
    const productMap = {}
    rows.forEach(r => {
      const key = `${(r.fraccion || '').trim()}::${(r.descripcion || '').trim().substring(0, 100)}`
      if (!productMap[key]) {
        productMap[key] = {
          descripcion: (r.descripcion || '').trim().substring(0, 200),
          fraccion: (r.fraccion || '').trim(),
          unitPrices: [],
          quantities: [],
          suppliers: new Set(),
          dates: [],
          totalValue: 0,
        }
      }
      const p = productMap[key]
      if (r.valor_unitario > 0) p.unitPrices.push(Number(r.valor_unitario))
      if (r.cantidad > 0) p.quantities.push(Number(r.cantidad))
      if (r.proveedor) p.suppliers.add(r.proveedor.trim())
      if (r.fecha_factura) p.dates.push(new Date(r.fecha_factura))
      p.totalValue += (Number(r.valor_unitario) || 0) * (Number(r.cantidad) || 0)
    })

    const products = Object.values(productMap)
    console.log(`🔍 Unique products (fracción+desc): ${fmtNum(products.length)}\n`)

    // Build intelligence records
    const records = []
    let anomalyCount = 0

    products.forEach(p => {
      if (p.unitPrices.length < 2) return

      const priceStats = calcStats(p.unitPrices)
      const totalQty = p.quantities.reduce((s, v) => s + v, 0)
      const trend = determineTrend(p.unitPrices)
      const lastDate = p.dates.length > 0
        ? new Date(Math.max(...p.dates.map(d => d.getTime())))
        : null

      // Anomaly detection: flag if latest price > 2 std devs from mean
      const latestPrice = p.unitPrices[0]
      const isAnomaly = priceStats.std > 0 && Math.abs(latestPrice - priceStats.mean) > 2 * priceStats.std

      if (isAnomaly) anomalyCount++

      records.push({
        descripcion: p.descripcion,
        fraccion: p.fraccion,
        avg_unit_price: priceStats.mean,
        price_stddev: priceStats.std,
        total_quantity: Math.round(totalQty * 100) / 100,
        total_value_usd: Math.round(p.totalValue * 100) / 100,
        supplier_count: p.suppliers.size,
        operation_count: p.unitPrices.length,
        last_imported: lastDate ? lastDate.toISOString().split('T')[0] : null,
        price_trend: trend,
        anomaly_flag: isAnomaly,
        company_id: COMPANY_ID,
        updated_at: new Date().toISOString(),
      })
    })

    // Sort by total value descending
    records.sort((a, b) => b.total_value_usd - a.total_value_usd)

    console.log(`📈 Intelligence records: ${fmtNum(records.length)}`)
    console.log(`⚠️  Price anomalies detected: ${anomalyCount}\n`)

    // Save to Supabase — batch upsert
    const BATCH = 500
    let saved = 0
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)
      const { error } = await supabase.from('product_intelligence').upsert(batch, {
        onConflict: 'descripcion,fraccion',
        ignoreDuplicates: false,
      })
      if (error) {
        if (error.code === '42P01') {
          console.error('❌ Table product_intelligence does not exist. Run the SQL migration first.')
          return
        }
        console.error(`Batch ${i}-${i + BATCH} error:`, error.message)
      } else {
        saved += batch.length
      }
    }

    console.log(`✅ Saved ${fmtNum(saved)} product intelligence records to Supabase\n`)

    // Also flag anomalies in anomaly_baselines
    const anomalies = records.filter(r => r.anomaly_flag)
    if (anomalies.length > 0) {
      const anomalyRecords = anomalies.map(a => ({
        metric_type: 'product_price',
        metric_key: `${a.fraccion}::${a.descripcion.substring(0, 80)}`,
        mean_value: a.avg_unit_price,
        std_dev: a.price_stddev,
        threshold_high: a.avg_unit_price + 2 * a.price_stddev,
        threshold_low: Math.max(0, a.avg_unit_price - 2 * a.price_stddev),
        sample_count: a.operation_count,
        company_id: COMPANY_ID,
        calculated_at: new Date().toISOString(),
      }))
      const { error } = await supabase.from('anomaly_baselines').upsert(anomalyRecords, {
        onConflict: 'metric_type,metric_key',
        ignoreDuplicates: false,
      })
      if (error) console.error('Anomaly baselines error:', error.message)
      else console.log(`📐 ${anomalyRecords.length} anomaly baselines updated`)
    }

    // Top 10 products summary
    console.log('\n🏆 Top 10 Products by Value:')
    records.slice(0, 10).forEach((r, i) => {
      const trend = r.price_trend === 'up' ? '↑' : r.price_trend === 'down' ? '↓' : '→'
      console.log(`  ${i + 1}. ${r.descripcion.substring(0, 50)} | ${r.fraccion} | ${fmtUSD(r.total_value_usd)} | ${trend} | ${r.supplier_count} suppliers`)
    })

    // Telegram summary
    const top5 = records.slice(0, 5).map((r, i) =>
      `${i + 1}. ${r.descripcion.substring(0, 40)} — ${fmtUSD(r.total_value_usd)}`
    ).join('\n')

    // Only send Telegram if anomalies found
    if (anomalyCount > 0) {
      await sendTelegram(
        `⚠️ <b>Product Intelligence — ${anomalyCount} Anomalies</b>\n\n` +
        `Products analyzed: ${fmtNum(records.length)}\n` +
        `Price anomalies: ${anomalyCount}\n\n` +
        `<b>Top 5:</b>\n${top5}\n\n` +
        `CRUZ 🦀`
      )
    }

    console.log('\n✅ Product Intelligence Engine — Complete')

  } catch (err) {
    console.error('❌ Error:', err.message)
    await sendTelegram(`❌ Product Intelligence failed: ${err.message}`)
  } finally {
    if (conn) await conn.end()
  }
}

run()
