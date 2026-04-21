#!/usr/bin/env node
// scripts/crossing-model-train.js — BUILD 3 PHASE 3
// Crossing Time Prediction Model — statistical ML trained on real crossings
// Features: day_of_week, carrier, hour_of_day, month, regimen, weight, invoice count
// Cron: 0 3 * * 0 (Sunday 3 AM — weekly retrain)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function sendTG(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

// ── Ensure crossing_model table ──────────────────────
async function ensureTable() {
  const { error: rpcErr } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS crossing_model (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        feature TEXT,
        feature_value TEXT,
        avg_hours NUMERIC,
        sample_count INTEGER,
        std_dev NUMERIC,
        company_id TEXT DEFAULT 'all',
        model_version INTEGER DEFAULT 1,
        trained_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_crossing_model_feature
        ON crossing_model(feature, feature_value);
    `
  })
  if (rpcErr) console.log('  Note: crossing_model table creation via RPC:', rpcErr.message)
  await supabase.from('crossing_model').select('id').limit(1)
}

// ── Feature extraction ───────────────────────────────
function extractFeatures(trafico, facturas) {
  const llegada = new Date(trafico.fecha_llegada)
  const cruce = new Date(trafico.fecha_cruce)
  const crossingHours = (cruce - llegada) / 3600000

  // Filter outliers: must be between 1h and 240h (10 days)
  if (crossingHours < 1 || crossingHours > 240) return null

  const matchedFacturas = (facturas || []).filter(f => f.cve_trafico === trafico.trafico)

  return {
    trafico: trafico.trafico,
    crossing_hours: crossingHours,
    day_of_week: cruce.getDay(), // 0=Sunday
    hour_of_day: cruce.getHours(),
    month: cruce.getMonth() + 1,
    carrier: (trafico.transportista_extranjero || 'UNKNOWN').toUpperCase().trim(),
    regimen: trafico.regimen || 'UNKNOWN',
    peso_bruto: trafico.peso_bruto || 0,
    num_facturas: matchedFacturas.length,
    total_value: matchedFacturas.reduce((s, f) => s + (f.valor || 0), 0),
  }
}

// ── Statistics calculator ────────────────────────────
function calcStats(values) {
  if (!values.length) return { avg: 0, count: 0, std_dev: 0 }
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length
  return {
    avg: Math.round(avg * 10) / 10,
    count: values.length,
    std_dev: Math.round(Math.sqrt(variance) * 10) / 10,
  }
}

// ── Prediction function ──────────────────────────────
function predictCrossingTime(trafico, modelCoeffs, overallAvg) {
  const dayAvg = modelCoeffs.find(m =>
    m.feature === 'day_of_week' && m.feature_value === String(trafico.day_of_week)
  )
  const carrierAvg = modelCoeffs.find(m =>
    m.feature === 'carrier' && m.feature_value === trafico.carrier
  )
  const hourAvg = modelCoeffs.find(m =>
    m.feature === 'hour_of_day' && m.feature_value === String(trafico.hour_of_day)
  )
  const monthAvg = modelCoeffs.find(m =>
    m.feature === 'month' && m.feature_value === String(trafico.month)
  )

  const dayVal = dayAvg?.avg_hours || overallAvg
  const carrierVal = carrierAvg?.avg_hours || overallAvg
  const hourVal = hourAvg?.avg_hours || overallAvg
  const monthVal = monthAvg?.avg_hours || overallAvg

  // Weighted ensemble
  const predicted = (
    dayVal * 0.30 +
    carrierVal * 0.30 +
    hourVal * 0.15 +
    monthVal * 0.15 +
    overallAvg * 0.10
  )

  // Confidence based on sample sizes
  const minSamples = Math.min(
    dayAvg?.sample_count || 0,
    carrierAvg?.sample_count || 0
  )
  const confidence = minSamples > 100 ? 'high'
    : minSamples > 20 ? 'medium' : 'low'

  return {
    predicted_hours: Math.round(predicted * 10) / 10,
    confidence,
    recommendation: predicted < 30 ? 'optimal_window'
      : predicted < 48 ? 'acceptable'
      : 'delay_if_possible',
    factors: {
      day_contribution: dayVal,
      carrier_contribution: carrierVal,
      hour_contribution: hourVal,
      month_contribution: monthVal,
    }
  }
}

// ── Main ─────────────────────────────────────────────
async function main() {
  console.log('🤖 CROSSING TIME PREDICTION MODEL — CRUZ Build 3')
  console.log('═'.repeat(55))
  const start = Date.now()

  await ensureTable()

  // Step 1: Load completed tráficos
  console.log('\n📊 Loading training data...')
  let traficos = []
  let offset = 0
  while (true) {
    const { data } = await supabase.from('traficos')
      .select('trafico, company_id, fecha_llegada, fecha_cruce, estatus, transportista_extranjero, regimen, peso_bruto')
      .ilike('estatus', '%cruz%')
      .not('fecha_llegada', 'is', null)
      .not('fecha_cruce', 'is', null)
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    traficos = traficos.concat(data)
    offset += 1000
    if (data.length < 1000) break
  }
  console.log(`  ${traficos.length} completed tráficos loaded`)

  // Load facturas for value features
  const { data: facturas } = await supabase.from('globalpc_facturas')
    .select('cve_trafico, valor')
    .limit(10000)

  // Step 2: Extract features
  console.log('\n🔬 Extracting features...')
  const trainingData = traficos
    .map(t => extractFeatures(t, facturas))
    .filter(Boolean)

  console.log(`  ${trainingData.length} valid training samples (outliers removed)`)

  if (trainingData.length < 10) {
    console.log('❌ Not enough training data')
    return
  }

  // Overall average
  const allHours = trainingData.map(t => t.crossing_hours)
  const overall = calcStats(allHours)
  console.log(`  Overall avg crossing: ${overall.avg}h (±${overall.std_dev}h)`)

  // Step 3: Calculate model coefficients per feature
  console.log('\n📈 Training model...')
  const features = ['day_of_week', 'carrier', 'hour_of_day', 'month', 'regimen']
  const modelCoeffs = []

  // Overall coefficient
  modelCoeffs.push({
    feature: 'overall',
    feature_value: 'avg',
    avg_hours: overall.avg,
    sample_count: overall.count,
    std_dev: overall.std_dev,
    company_id: 'all',
    model_version: 1,
  })

  for (const feature of features) {
    const groups = {}
    for (const t of trainingData) {
      const val = String(t[feature] || 'UNKNOWN')
      if (!groups[val]) groups[val] = []
      groups[val].push(t.crossing_hours)
    }

    for (const [val, hours] of Object.entries(groups)) {
      const stats = calcStats(hours)
      if (stats.count >= 3) { // Minimum 3 samples
        modelCoeffs.push({
          feature,
          feature_value: val,
          avg_hours: stats.avg,
          sample_count: stats.count,
          std_dev: stats.std_dev,
          company_id: 'all',
          model_version: 1,
        })
      }
    }

    // Log feature summary
    const vals = Object.entries(groups)
      .filter(([, h]) => h.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
    console.log(`  ${feature}: ${vals.length} segments`)
    for (const [val, hours] of vals.slice(0, 3)) {
      const s = calcStats(hours)
      console.log(`    ${val}: ${s.avg}h avg (n=${s.count})`)
    }
  }

  // Numeric correlations
  console.log('\n📊 Numeric correlations:')
  const numFeatures = ['peso_bruto', 'num_facturas', 'total_value']
  for (const feat of numFeatures) {
    const pairs = trainingData.filter(t => t[feat] > 0).map(t => [t[feat], t.crossing_hours])
    if (pairs.length < 10) continue
    const meanX = pairs.reduce((s, p) => s + p[0], 0) / pairs.length
    const meanY = pairs.reduce((s, p) => s + p[1], 0) / pairs.length
    const cov = pairs.reduce((s, p) => s + (p[0] - meanX) * (p[1] - meanY), 0) / pairs.length
    const stdX = Math.sqrt(pairs.reduce((s, p) => s + (p[0] - meanX) ** 2, 0) / pairs.length)
    const stdY = Math.sqrt(pairs.reduce((s, p) => s + (p[1] - meanY) ** 2, 0) / pairs.length)
    const corr = stdX > 0 && stdY > 0 ? (cov / (stdX * stdY)).toFixed(3) : 'N/A'
    console.log(`  ${feat} vs crossing_hours: r=${corr}`)
  }

  // Step 4: Save model to database
  console.log('\n💾 Saving model coefficients...')
  await supabase.from('crossing_model').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  for (let i = 0; i < modelCoeffs.length; i += 200) {
    const batch = modelCoeffs.slice(i, i + 200)
    const { error } = await supabase.from('crossing_model').insert(batch)
    if (error) console.log(`  ⚠️  Batch save error: ${error.message}`)
  }
  console.log(`  ${modelCoeffs.length} coefficients saved`)

  // Step 5: Update predictions for active tráficos
  console.log('\n🔮 Predicting for active tráficos...')
  const { data: active } = await supabase.from('traficos')
    .select('trafico, company_id, fecha_llegada, transportista_extranjero, regimen, peso_bruto')
    .not('estatus', 'ilike', '%cruz%')
    .not('fecha_llegada', 'is', null)
    .limit(500)

  let predictions = 0
  for (const t of (active || [])) {
    const now = new Date()
    const feats = {
      day_of_week: now.getDay(),
      hour_of_day: now.getHours(),
      month: now.getMonth() + 1,
      carrier: (t.transportista_extranjero || 'UNKNOWN').toUpperCase().trim(),
    }

    const pred = predictCrossingTime(feats, modelCoeffs, overall.avg)

    const { error: upsertErr } = await supabase.from('crossing_predictions').upsert({
      trafico_id: t.trafico,
      company_id: t.company_id || 'evco',
      predicted_hours: pred.predicted_hours,
      confidence: pred.confidence,
      recommendation: pred.recommendation,
      model_factors: pred.factors,
      model_version: 1,
      predicted_at: new Date().toISOString(),
    }, { onConflict: 'trafico_id' })
    if (upsertErr) {
      // Try crossing_intelligence as fallback
      await supabase.from('crossing_intelligence').upsert({
        trafico_id: t.trafico,
        company_id: t.company_id || 'evco',
        predicted_hours: pred.predicted_hours,
        confidence: pred.confidence,
        recommendation: pred.recommendation,
        predicted_at: new Date().toISOString(),
      }, { onConflict: 'trafico_id' })
    }

    predictions++
  }
  console.log(`  ${predictions} active tráficos updated with predictions`)

  // Step 6: Accuracy check (compare past predictions vs actual)
  console.log('\n📏 Accuracy check...')
  const { data: pastPreds } = await supabase.from('crossing_predictions')
    .select('trafico_id, predicted_hours')
    .not('predicted_hours', 'is', null)
    .limit(200)

  let mae = null
  if (pastPreds && pastPreds.length > 0) {
    const actuals = []
    for (const pred of pastPreds.slice(0, 50)) {
      const completed = traficos.find(t => t.trafico === pred.trafico_id)
      if (completed) {
        const actualHours = (new Date(completed.fecha_cruce) - new Date(completed.fecha_llegada)) / 3600000
        if (actualHours > 0 && actualHours < 240) {
          actuals.push(Math.abs(pred.predicted_hours - actualHours))
        }
      }
    }
    if (actuals.length > 0) {
      mae = Math.round((actuals.reduce((a, b) => a + b, 0) / actuals.length) * 10) / 10
      console.log(`  MAE: ${mae}h (${actuals.length} samples)`)
      console.log(`  Target: < 8h MAE — ${mae < 8 ? '✅ ACHIEVED' : '🟡 IN PROGRESS'}`)
    }
  }

  // ── Summary ────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('\n' + '═'.repeat(55))
  console.log('MODEL TRAINING COMPLETE')
  console.log('═'.repeat(55))
  console.log(`Training samples: ${trainingData.length}`)
  console.log(`Model coefficients: ${modelCoeffs.length}`)
  console.log(`Active predictions: ${predictions}`)
  console.log(`Overall avg: ${overall.avg}h crossing time`)
  if (mae !== null) console.log(`MAE: ${mae}h`)
  console.log(`Time: ${elapsed}s`)

  // ── Telegram ───────────────────────────────────────
  const report = `🤖 <b>CROSSING MODEL TRAINED</b>
━━━━━━━━━━━━━━━━━━━━━
Training samples: ${trainingData.length}
Coefficients: ${modelCoeffs.length}
Active predictions: ${predictions}
Overall avg: ${overall.avg}h
${mae !== null ? `MAE: ${mae}h ${mae < 8 ? '✅' : '🟡'}` : 'MAE: insufficient data'}

Top carriers:
${modelCoeffs.filter(m => m.feature === 'carrier').sort((a, b) => b.sample_count - a.sample_count).slice(0, 3).map(m => `• ${m.feature_value}: ${m.avg_hours}h (n=${m.sample_count})`).join('\n')}

Time: ${elapsed}s
━━━━━━━━━━━━━━━━━━━━━
— CRUZ 🦀`

  await sendTG(report)
}

main().catch(err => {
  console.error('❌ Fatal:', err.message)
  process.exit(1)
})
