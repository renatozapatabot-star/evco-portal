const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const CLAVE = '9254'

function fmtNum(n) { return Number(n || 0).toLocaleString('es-MX') }
function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }

function calcStats(values) {
  if (!values || values.length === 0) return { mean: 0, std: 0, min: 0, max: 0, count: 0 }
  const n = values.length
  const mean = values.reduce((s, v) => s + v, 0) / n
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n
  const std = Math.sqrt(variance)
  const sorted = [...values].sort((a, b) => a - b)
  return {
    mean: Math.round(mean * 100) / 100, std: Math.round(std * 100) / 100,
    min: Math.min(...values), max: Math.max(...values), count: n,
    p10: sorted[Math.floor(n * 0.1)], p90: sorted[Math.floor(n * 0.9)],
  }
}

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function runAnomalyBaseline() {
  console.log('📐 Building Anomaly Detection Baseline...\n')

  const { data: facturas } = await supabase
    .from('aduanet_facturas')
    .select('pedimento, proveedor, valor_usd, tipo_cambio, dta, igi, iva, fecha_pago')
    .eq('clave_cliente', CLAVE).not('valor_usd', 'is', null)

  const rows = facturas || []
  console.log(`Building baseline from ${fmtNum(rows.length)} facturas...\n`)

  const baselines = {}

  // Per fracción
  const byFraccion = {}
  rows.forEach(f => { if (!f.pedimento || !f.valor_usd) return; if (!byFraccion[f.pedimento]) byFraccion[f.pedimento] = []; byFraccion[f.pedimento].push(f.valor_usd) })
  Object.entries(byFraccion).forEach(([frac, values]) => {
    if (values.length < 3) return
    const stats = calcStats(values)
    baselines[`fraccion:${frac}`] = { type: 'fraccion_valor', key: frac, stats, threshold_high: stats.mean + (2 * stats.std), threshold_low: Math.max(0, stats.mean - (2 * stats.std)) }
  })

  // Per proveedor
  const byProv = {}
  rows.forEach(f => { if (!f.proveedor || !f.valor_usd) return; if (!byProv[f.proveedor]) byProv[f.proveedor] = []; byProv[f.proveedor].push(f.valor_usd) })
  Object.entries(byProv).forEach(([prov, values]) => {
    if (values.length < 3) return
    const stats = calcStats(values)
    baselines[`proveedor:${prov}`] = { type: 'proveedor_valor', key: prov, stats, threshold_high: stats.mean + (2 * stats.std), threshold_low: Math.max(0, stats.mean - (2 * stats.std)) }
  })

  // Tipo de cambio
  const tcValues = rows.filter(f => f.tipo_cambio > 0).map(f => f.tipo_cambio)
  if (tcValues.length > 0) {
    const stats = calcStats(tcValues)
    baselines['tipo_cambio:global'] = { type: 'tipo_cambio', key: 'global', stats, threshold_high: stats.mean * 1.01, threshold_low: stats.mean * 0.99 }
  }

  console.log(`Baselines calculated:`)
  console.log(`  Per fracción: ${Object.keys(byFraccion).length}`)
  console.log(`  Per proveedor: ${Object.keys(byProv).length}`)
  console.log(`  Tipo de cambio: global`)
  console.log(`  Total baseline records: ${Object.keys(baselines).length}`)

  const records = Object.entries(baselines).map(([key, baseline]) => ({
    baseline_key: key, baseline_type: baseline.type, entity_key: baseline.key,
    mean_value: baseline.stats.mean, std_value: baseline.stats.std,
    min_value: baseline.stats.min, max_value: baseline.stats.max,
    sample_count: baseline.stats.count, threshold_high: baseline.threshold_high,
    threshold_low: baseline.threshold_low, calculated_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('anomaly_baselines').upsert(records, { onConflict: 'baseline_key' })

  if (error) {
    if (error.code === '42P01') {
      console.log('\n⚠️  anomaly_baselines table does not exist yet.')
      console.log('Run this SQL in Supabase SQL Editor:')
      console.log(`CREATE TABLE anomaly_baselines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  baseline_key VARCHAR(300) UNIQUE, baseline_type VARCHAR(50), entity_key VARCHAR(200),
  mean_value DECIMAL(14,4), std_value DECIMAL(14,4), min_value DECIMAL(14,4), max_value DECIMAL(14,4),
  sample_count INTEGER, threshold_high DECIMAL(14,4), threshold_low DECIMAL(14,4),
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`)
    } else { console.error('Supabase error:', error.message) }
  } else { console.log(`\n✅ ${records.length} baselines saved to Supabase`) }

  console.log('\nTop 5 Fracción Baselines:')
  Object.entries(baselines).filter(([k]) => k.startsWith('fraccion:'))
    .sort((a, b) => b[1].stats.mean - a[1].stats.mean).slice(0, 5)
    .forEach(([key, b]) => {
      console.log(`  ${key.replace('fraccion:', '')}: mean=${fmtUSD(b.stats.mean)} std=${fmtUSD(b.stats.std)} n=${b.stats.count}`)
      console.log(`    Thresholds: >${fmtUSD(b.threshold_high)} or <${fmtUSD(b.threshold_low)}`)
    })

  await sendTelegram([
    `📐 <b>ANOMALY BASELINE — CALCULADO</b>`, `${new Date().toLocaleDateString('es-MX')}`,
    `━━━━━━━━━━━━━━━━━━━━`, `Facturas: ${fmtNum(rows.length)} · Baselines: ${Object.keys(baselines).length}`,
    `Por fracción: ${Object.keys(byFraccion).length} · Por proveedor: ${Object.keys(byProv).length}`,
    `✅ Detector de anomalías usa estadísticas reales`, `━━━━━━━━━━━━━━━━━━━━`, `— CRUZ 🦀`
  ].join('\n'))
}

runAnomalyBaseline().catch(err => { console.error('Fatal error:', err); process.exit(1) })
