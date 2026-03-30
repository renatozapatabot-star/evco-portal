#!/usr/bin/env node
// scripts/compliance-predictor.js — FEATURE 14
// Proactive compliance alerts engine
// Cron: 0 7 * * * (daily 7 AM)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'

async function sendTG(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  })
}

async function main() {
  console.log('🔮 Compliance Predictor — CRUZ')
  const start = Date.now()
  const now = new Date()
  const predictions = []

  // 1. Regulatory calendar — known deadlines
  const regulatoryEvents = [
    { title: 'Declaracion mensual SAT', due_date: getNextDate(17), severity: 'medium', type: 'regulatory' },
    { title: 'Pago provisional ISR', due_date: getNextDate(17), severity: 'medium', type: 'regulatory' },
    { title: 'IMMEX Reporte Anual', due_date: `${now.getFullYear()}-03-31`, severity: 'high', type: 'compliance' },
    { title: 'Declaracion Anual Personas Morales', due_date: `${now.getFullYear()}-03-31`, severity: 'high', type: 'regulatory' },
    { title: 'e.firma SAT — verificar vigencia', due_date: getDatePlusDays(90), severity: 'high', type: 'document_expiration' },
    { title: 'Padron de Importadores — verificar', due_date: getDatePlusDays(180), severity: 'medium', type: 'compliance' },
    { title: 'Autorizacion IMMEX — verificar renovacion', due_date: getDatePlusDays(60), severity: 'high', type: 'compliance' },
  ]

  regulatoryEvents.forEach(evt => {
    const dueDate = new Date(evt.due_date + 'T12:00:00')
    const daysUntil = Math.floor((dueDate.getTime() - now.getTime()) / 86400000)
    if (daysUntil > 0 && daysUntil <= 90) {
      predictions.push({
        company_id: COMPANY_ID,
        prediction_type: evt.type,
        title: evt.title,
        description: `Vence en ${daysUntil} dias (${evt.due_date})`,
        due_date: evt.due_date,
        severity: daysUntil <= 7 ? 'critical' : daysUntil <= 30 ? 'warning' : 'info',
        days_until: daysUntil,
        resolved: false,
        calculated_at: new Date().toISOString(),
      })
    }
  })

  // 2. IMMEX temporal limits (18 months from fecha_llegada)
  const { data: traficos } = await supabase.from('traficos')
    .select('trafico, fecha_llegada, estatus')
    .eq('company_id', COMPANY_ID).eq('estatus', 'En Proceso')
    .not('fecha_llegada', 'is', null)

  ;(traficos || []).forEach(t => {
    const llegada = new Date(t.fecha_llegada)
    const limit = new Date(llegada)
    limit.setMonth(limit.getMonth() + 18)
    const daysUntil = Math.floor((limit.getTime() - now.getTime()) / 86400000)

    if (daysUntil > 0 && daysUntil <= 90) {
      predictions.push({
        company_id: COMPANY_ID,
        prediction_type: 'immex_temporal',
        title: `IMMEX limite temporal — ${t.trafico}`,
        description: `Vence en ${daysUntil} dias. Mercancia debe retornar o regularizarse.`,
        due_date: limit.toISOString().split('T')[0],
        severity: daysUntil <= 7 ? 'critical' : daysUntil <= 30 ? 'warning' : 'info',
        days_until: daysUntil,
        trafico_id: t.trafico,
        resolved: false,
        calculated_at: new Date().toISOString(),
      })
    }
  })

  // 3. Missing MVE for post-deadline tráficos
  const postDeadline = (traficos || []).filter(t => !t.mve_folio)
  if (postDeadline.length > 0) {
    predictions.push({
      company_id: COMPANY_ID,
      prediction_type: 'mve_missing',
      title: `${postDeadline.length} traficos sin folio MVE`,
      description: `Desde el 31/03/2026, MVE es obligatorio para todas las importaciones.`,
      due_date: new Date().toISOString().split('T')[0],
      severity: 'critical',
      days_until: 0,
      resolved: false,
      calculated_at: new Date().toISOString(),
    })
  }

  console.log(`${predictions.length} compliance predictions generated`)

  // 4. Save to compliance_predictions
  await supabase.from('compliance_predictions').delete().eq('company_id', COMPANY_ID).eq('resolved', false)
  if (predictions.length > 0) {
    for (const batch of chunk(predictions, 50)) {
      await supabase.from('compliance_predictions').insert(batch)
    }
  }

  // 5. Calculate compliance score
  const criticalCount = predictions.filter(p => p.severity === 'critical').length
  const warningCount = predictions.filter(p => p.severity === 'warning').length
  const complianceScore = Math.max(0, 100 - criticalCount * 15 - warningCount * 5)

  // 6. Telegram alerts for critical items
  const criticals = predictions.filter(p => p.severity === 'critical')
  if (criticals.length > 0) {
    const lines = criticals.slice(0, 8).map(p => `  🔴 ${p.title}\n     ${p.description}`).join('\n')
    await sendTG(`🚨 <b>COMPLIANCE ALERT</b>\nScore: ${complianceScore}/100\n\n${criticals.length} alertas criticas:\n${lines}\n\n— CRUZ 🦀`)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`✅ Compliance score: ${complianceScore}/100`)
  console.log(`   ${criticalCount} critical · ${warningCount} warning · ${predictions.length - criticalCount - warningCount} info`)
  console.log(`   ${elapsed}s`)
}

function getNextDate(day) {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), day)
  if (target <= now) target.setMonth(target.getMonth() + 1)
  return target.toISOString().split('T')[0]
}

function getDatePlusDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
