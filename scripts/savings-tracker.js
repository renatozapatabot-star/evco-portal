const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const { getExchangeRate } = require('./lib/rates')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'
const CLAVE = '9254'

function fmtMXN(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' MXN' }

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
  console.log('💰 Savings Tracker — Starting...\n')

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const monthName = today.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  // T-MEC savings: operations where IGI = 0
  const { data: facturas } = await supabase
    .from('aduanet_facturas')
    .select('valor_usd, igi, fraccion')
    .eq('clave_cliente', CLAVE)
    .gte('fecha_pago', monthStart)

  const allOps = facturas || []
  const tmecOps = allOps.filter(f => Number(f.igi) === 0)
  const nonTmecOps = allOps.filter(f => Number(f.igi) > 0)

  // Estimate T-MEC savings: avg IGI rate from non-T-MEC ops applied to T-MEC ops value
  const avgIgiRate = nonTmecOps.length > 0
    ? nonTmecOps.reduce((s, f) => s + Number(f.igi || 0), 0) /
      nonTmecOps.reduce((s, f) => s + Number(f.valor_usd || 0), 0)
    : 0.05 // Default 5% estimate
  const tmecValue = tmecOps.reduce((s, f) => s + Number(f.valor_usd || 0), 0)
  const tmecSavingsUSD = tmecValue * avgIgiRate
  let tipoCambio = 17.5
  try { const fxData = await getExchangeRate(); tipoCambio = fxData.rate } catch { /* fallback */ }
  const tmecSavingsMXN = tmecSavingsUSD * tipoCambio

  // Penalties avoided: MVE folios filed
  const { data: traficosWithMVE } = await supabase
    .from('traficos')
    .select('trafico, mve_folio')
    .eq('company_id', COMPANY_ID)
    .not('mve_folio', 'is', null)
    .gte('fecha_entrada', '2026-03-31')

  const mveFiled = (traficosWithMVE || []).length
  const penaltyPerOp = 5990 // Average of $4,790-$7,190 MXN
  const penaltiesAvoided = mveFiled * penaltyPerOp

  // Time saved: automated actions
  const { data: commsData } = await supabase
    .from('compliance_predictions')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .gte('created_at', monthStart)

  const { data: docsLinked } = await supabase
    .from('documents')
    .select('id')
    .gte('inserted_at', monthStart)

  const automatedEmails = (commsData || []).length
  const autoLinkedDocs = Math.min((docsLinked || []).length, 500)
  const timeSavedMinutes = (automatedEmails * 15) + (autoLinkedDocs * 10)
  const timeSavedHours = Math.round(timeSavedMinutes / 60 * 10) / 10
  const hourlyRate = 250 // MXN
  const timeSavedMXN = timeSavedHours * hourlyRate

  // Anomalies prevented
  const { data: anomalies } = await supabase
    .from('anomaly_baselines')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .gte('calculated_at', monthStart)

  const anomaliesPrevented = (anomalies || []).length

  // Total
  const totalSavings = tmecSavingsMXN + penaltiesAvoided + timeSavedMXN
  const platformCost = 3500 // MXN/month estimate
  const roi = platformCost > 0 ? Math.round((totalSavings / platformCost) * 100) : 0

  console.log(`💰 Savings Report — ${monthName}`)
  console.log(`   T-MEC savings: ${fmtMXN(tmecSavingsMXN)} (${tmecOps.length} ops, $${tmecSavingsUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD)`)
  console.log(`   Penalties avoided: ${fmtMXN(penaltiesAvoided)} (${mveFiled} MVE filings)`)
  console.log(`   Time saved: ${timeSavedHours}h = ${fmtMXN(timeSavedMXN)}`)
  console.log(`   Anomalies flagged: ${anomaliesPrevented}`)
  console.log(`   TOTAL: ${fmtMXN(totalSavings)}`)
  console.log(`   Platform cost: ${fmtMXN(platformCost)}`)
  console.log(`   ROI: ${roi}%`)

  // Save savings report
  const report = {
    prediction_type: 'monthly_savings',
    entity_id: monthStart,
    description: JSON.stringify({
      period: monthName,
      tmec_savings_mxn: Math.round(tmecSavingsMXN),
      tmec_savings_usd: Math.round(tmecSavingsUSD),
      tmec_ops: tmecOps.length,
      penalties_avoided_mxn: penaltiesAvoided,
      mve_filings: mveFiled,
      time_saved_hours: timeSavedHours,
      time_saved_mxn: Math.round(timeSavedMXN),
      anomalies_prevented: anomaliesPrevented,
      total_value_mxn: Math.round(totalSavings),
      platform_cost_mxn: platformCost,
      roi_pct: roi,
    }),
    risk_level: 'info',
    confidence: 1,
    company_id: COMPANY_ID,
    created_at: new Date().toISOString(),
  }

  await supabase.from('compliance_predictions').upsert(report, {
    onConflict: 'prediction_type,entity_id',
    ignoreDuplicates: false,
  })

  await sendTelegram(
    `💰 <b>Valor Generado por CRUZ — ${monthName}</b>\n\n` +
    `T-MEC: ${fmtMXN(tmecSavingsMXN)} (${tmecOps.length} ops)\n` +
    `Multas prevenidas: ${fmtMXN(penaltiesAvoided)}\n` +
    `Tiempo Ursula: ${timeSavedHours}h = ${fmtMXN(timeSavedMXN)}\n` +
    `Anomalías: ${anomaliesPrevented}\n\n` +
    `<b>TOTAL: ${fmtMXN(totalSavings)}</b>\n` +
    `ROI: ${roi}%\n\n` +
    `CRUZ 🦀`
  )

  console.log('\n✅ Savings Tracker — Complete')
}

run()
