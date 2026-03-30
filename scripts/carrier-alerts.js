const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function run() {
  console.log('🚛 Carrier Performance Alerts — Starting...\n')

  // Get all traficos with carrier data
  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico, transportista_mexicano, transportista_extranjero, fecha_llegada, fecha_cruce, estatus')
    .eq('company_id', COMPANY_ID)
    .order('fecha_llegada', { ascending: false })

  // Get entradas for shortage/damage data
  const { data: entradas } = await supabase
    .from('entradas')
    .select('cve_entrada, trafico, tiene_faltantes, mercancia_danada, fecha_llegada_mercancia')
    .eq('company_id', COMPANY_ID)

  const allTraficos = traficos || []
  const allEntradas = entradas || []

  // Map entradas to traficos
  const entradasByTrafico = {}
  allEntradas.forEach(e => {
    if (e.trafico) entradasByTrafico[e.trafico] = e
  })

  const today = new Date()
  const fourWeeksAgo = new Date(today.getTime() - 28 * 86400000)

  // Group by carrier
  const carrierData = {}
  allTraficos.forEach(t => {
    const carrier = t.transportista_mexicano || t.transportista_extranjero
    if (!carrier) return
    if (!carrierData[carrier]) carrierData[carrier] = { all: [], recent: [] }

    const arrival = t.fecha_llegada ? new Date(t.fecha_llegada) : null
    const crossing = t.fecha_cruce ? new Date(t.fecha_cruce) : null
    const crossingHours = arrival && crossing ? (crossing - arrival) / 3600000 : null
    const entrada = entradasByTrafico[t.trafico]

    const record = {
      trafico: t.trafico,
      crossingHours: crossingHours && crossingHours > 0 && crossingHours < 720 ? crossingHours : null,
      hasShortage: entrada?.tiene_faltantes || false,
      hasDamage: entrada?.mercancia_danada || false,
      date: arrival,
    }

    carrierData[carrier].all.push(record)
    if (arrival && arrival >= fourWeeksAgo) {
      carrierData[carrier].recent.push(record)
    }
  })

  // Calculate degradation for each carrier
  const alerts = []

  Object.entries(carrierData).forEach(([carrier, data]) => {
    if (data.all.length < 10 || data.recent.length < 3) return

    // Crossing time
    const allCrossings = data.all.filter(r => r.crossingHours).map(r => r.crossingHours)
    const recentCrossings = data.recent.filter(r => r.crossingHours).map(r => r.crossingHours)
    const historicalAvg = allCrossings.length > 0 ? allCrossings.reduce((s, v) => s + v, 0) / allCrossings.length : 0
    const recentAvg = recentCrossings.length > 0 ? recentCrossings.reduce((s, v) => s + v, 0) / recentCrossings.length : 0

    if (historicalAvg > 0 && recentAvg > 0) {
      const degradation = (recentAvg - historicalAvg) / historicalAvg
      if (degradation > 0.2) {
        alerts.push({
          carrier,
          metric: 'crossing_time',
          current_value: Math.round(recentAvg * 10) / 10,
          historical_avg: Math.round(historicalAvg * 10) / 10,
          degradation_pct: Math.round(degradation * 100),
          sample_size: recentCrossings.length,
          recommendation: `Tiempo de cruce degradado ${Math.round(degradation * 100)}%. Evaluar alternativas.`,
        })
      }
    }

    // Shortage rate
    const allShortages = data.all.filter(r => r.hasShortage).length / data.all.length
    const recentShortages = data.recent.filter(r => r.hasShortage).length / data.recent.length
    if (allShortages > 0 && recentShortages > allShortages * 1.5 && recentShortages > 0.05) {
      alerts.push({
        carrier,
        metric: 'shortage_rate',
        current_value: Math.round(recentShortages * 1000) / 10,
        historical_avg: Math.round(allShortages * 1000) / 10,
        degradation_pct: Math.round(((recentShortages - allShortages) / allShortages) * 100),
        sample_size: data.recent.length,
        recommendation: `Tasa de faltantes aumentó. Verificar embarques de este carrier.`,
      })
    }

    // Damage rate
    const allDamages = data.all.filter(r => r.hasDamage).length / data.all.length
    const recentDamages = data.recent.filter(r => r.hasDamage).length / data.recent.length
    if (allDamages > 0 && recentDamages > allDamages * 1.5 && recentDamages > 0.03) {
      alerts.push({
        carrier,
        metric: 'damage_rate',
        current_value: Math.round(recentDamages * 1000) / 10,
        historical_avg: Math.round(allDamages * 1000) / 10,
        degradation_pct: Math.round(((recentDamages - allDamages) / allDamages) * 100),
        sample_size: data.recent.length,
        recommendation: `Tasa de daños aumentó. Revisar condiciones de transporte.`,
      })
    }
  })

  console.log(`⚠️  Carrier degradation alerts: ${alerts.length}\n`)

  // Save alerts to compliance_predictions
  if (alerts.length > 0) {
    const predictions = alerts.map(a => ({
      prediction_type: 'carrier_degradation',
      entity_id: `${a.carrier}::${a.metric}`,
      description: `${a.carrier}: ${a.metric} degradado ${a.degradation_pct}% — actual: ${a.current_value}, histórico: ${a.historical_avg}. ${a.recommendation}`,
      risk_level: a.degradation_pct > 50 ? 'critical' : 'warning',
      confidence: Math.min(0.95, 0.5 + a.sample_size * 0.05),
      company_id: COMPANY_ID,
      created_at: new Date().toISOString(),
    }))

    await supabase.from('compliance_predictions').upsert(predictions, {
      onConflict: 'prediction_type,entity_id',
      ignoreDuplicates: false,
    })
  }

  // Telegram for critical alerts
  const criticalAlerts = alerts.filter(a => a.degradation_pct > 50)
  if (criticalAlerts.length > 0) {
    const alertText = criticalAlerts.slice(0, 5).map(a => {
      const metricLabel = a.metric === 'crossing_time' ? 'Tiempo cruce' : a.metric === 'shortage_rate' ? 'Faltantes' : 'Daños'
      return `⚠️ <b>${a.carrier}</b>\n   ${metricLabel}: ${a.current_value} (hist: ${a.historical_avg}) — +${a.degradation_pct}%\n   ${a.recommendation}`
    }).join('\n\n')

    await sendTelegram(
      `🚛 <b>CARRIER ALERTS</b>\n\n` +
      `Degradaciones detectadas: ${alerts.length}\n` +
      `Críticas (>50%): ${criticalAlerts.length}\n\n` +
      alertText + '\n\n' +
      `CRUZ 🦀`
    )
  }

  alerts.forEach(a => {
    console.log(`  ${a.carrier}: ${a.metric} +${a.degradation_pct}% (${a.current_value} vs ${a.historical_avg})`)
  })

  console.log('\n✅ Carrier Alerts — Complete')
}

run()
