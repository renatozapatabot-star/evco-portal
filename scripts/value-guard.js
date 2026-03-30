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
  console.log('🛡️  Value Intelligence Guard — Starting...\n')

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
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message)
    return
  }

  try {
    // Build unit price baselines
    const [baselines] = await conn.query(`
      SELECT
        p.descripcion,
        p.fraccion,
        AVG(p.valor_unitario) as avg_price,
        STDDEV(p.valor_unitario) as stddev_price,
        MIN(p.valor_unitario) as min_price,
        MAX(p.valor_unitario) as max_price,
        COUNT(*) as sample_size
      FROM cb_producto_factura p
      WHERE p.valor_unitario > 0
        AND p.valor_unitario < 999999
        AND p.fraccion IS NOT NULL
        AND p.fraccion != ''
      GROUP BY p.descripcion, p.fraccion
      HAVING COUNT(*) >= 3
    `)

    console.log(`📊 Built ${fmtNum(baselines.length)} price baselines\n`)

    // Save baselines to product_intelligence
    const baselineRecords = baselines.map(b => ({
      descripcion: (b.descripcion || '').trim().substring(0, 200),
      fraccion: (b.fraccion || '').trim(),
      avg_unit_price: Math.round(Number(b.avg_price) * 10000) / 10000,
      price_stddev: Math.round(Number(b.stddev_price || 0) * 10000) / 10000,
      total_quantity: null,
      total_value_usd: null,
      supplier_count: null,
      operation_count: Number(b.sample_size),
      price_trend: null,
      anomaly_flag: false,
      company_id: COMPANY_ID,
      updated_at: new Date().toISOString(),
    }))

    // Batch upsert
    const BATCH = 500
    for (let i = 0; i < baselineRecords.length; i += BATCH) {
      const batch = baselineRecords.slice(i, i + BATCH)
      await supabase.from('product_intelligence').upsert(batch, {
        onConflict: 'descripcion,fraccion',
        ignoreDuplicates: false,
      })
    }

    // Get recent products from last 30 days to check for anomalies
    const [recentProducts] = await conn.query(`
      SELECT
        p.descripcion,
        p.fraccion,
        p.valor_unitario,
        f.cve_trafico,
        f.proveedor,
        f.fecha
      FROM cb_producto_factura p
      JOIN cb_factura f ON f.id = p.id_factura
      WHERE p.valor_unitario > 0
        AND f.fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND p.fraccion IS NOT NULL
      ORDER BY f.fecha DESC
    `)

    console.log(`🔍 Checking ${fmtNum(recentProducts.length)} recent products for anomalies\n`)

    // Build baseline lookup
    const baselineLookup = {}
    baselines.forEach(b => {
      const key = `${(b.descripcion || '').trim()}::${(b.fraccion || '').trim()}`
      baselineLookup[key] = {
        avg: Number(b.avg_price),
        std: Number(b.stddev_price || 0),
        min: Number(b.min_price),
        max: Number(b.max_price),
        samples: Number(b.sample_size),
      }
    })

    // Detect anomalies
    const anomalies = []
    recentProducts.forEach(p => {
      const key = `${(p.descripcion || '').trim()}::${(p.fraccion || '').trim()}`
      const baseline = baselineLookup[key]
      if (!baseline || baseline.std === 0 || baseline.samples < 5) return

      const price = Number(p.valor_unitario)
      const zScore = Math.abs(price - baseline.avg) / baseline.std
      if (zScore > 2.0) {
        const deviationPct = Math.round(((price - baseline.avg) / baseline.avg) * 100)
        anomalies.push({
          product: (p.descripcion || '').substring(0, 100),
          fraccion: p.fraccion,
          trafico: p.cve_trafico,
          supplier: p.proveedor,
          declared_price: price,
          historical_avg: baseline.avg,
          deviation_pct: deviationPct,
          z_score: Math.round(zScore * 100) / 100,
          severity: zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low',
        })
      }
    })

    console.log(`⚠️  Anomalies detected: ${anomalies.length}`)
    const high = anomalies.filter(a => a.severity === 'high')
    const medium = anomalies.filter(a => a.severity === 'medium')
    console.log(`   High: ${high.length} | Medium: ${medium.length} | Low: ${anomalies.length - high.length - medium.length}`)

    // Save anomalies to anomaly_baselines
    if (anomalies.length > 0) {
      const anomalyRecords = anomalies.slice(0, 100).map(a => ({
        metric_type: 'value_guard',
        metric_key: `${a.trafico}::${a.fraccion}::${a.product.substring(0, 50)}`,
        mean_value: a.historical_avg,
        std_dev: null,
        threshold_high: a.historical_avg * 1.5,
        threshold_low: a.historical_avg * 0.5,
        sample_count: null,
        company_id: COMPANY_ID,
        calculated_at: new Date().toISOString(),
      }))

      await supabase.from('anomaly_baselines').upsert(anomalyRecords, {
        onConflict: 'metric_type,metric_key',
        ignoreDuplicates: false,
      })
    }

    // Print top anomalies
    if (anomalies.length > 0) {
      console.log('\n🔴 Top anomalies:')
      anomalies.sort((a, b) => Math.abs(b.deviation_pct) - Math.abs(a.deviation_pct)).slice(0, 10).forEach(a => {
        console.log(`  ${a.trafico} | ${a.product.substring(0, 40)} | Declared: ${fmtUSD(a.declared_price)} | Avg: ${fmtUSD(a.historical_avg)} | ${a.deviation_pct > 0 ? '+' : ''}${a.deviation_pct}% | z=${a.z_score}`)
      })
    }

    // Telegram alert for high severity
    if (high.length > 0) {
      const alertText = high.slice(0, 5).map(a =>
        `⚠️ ${a.trafico}: ${a.product.substring(0, 35)}\n   Declarado: ${fmtUSD(a.declared_price)} vs Histórico: ${fmtUSD(a.historical_avg)} (${a.deviation_pct > 0 ? '+' : ''}${a.deviation_pct}%)`
      ).join('\n\n')

      await sendTelegram(
        `🛡️ <b>Value Guard — Anomalías Detectadas</b>\n\n` +
        `Baselines: ${fmtNum(baselines.length)}\n` +
        `Anomalías: ${anomalies.length} (${high.length} altas)\n\n` +
        alertText + '\n\n' +
        `CRUZ 🦀`
      )
    }

    console.log('\n✅ Value Guard — Complete')
  } catch (err) {
    console.error('❌ Error:', err.message)
    await sendTelegram(`❌ Value Guard failed: ${err.message}`)
  } finally {
    if (conn) await conn.end()
  }
}

run()
