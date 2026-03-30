#!/usr/bin/env node
// scripts/feedback-loop.js — Prediction accuracy tracker
// Compares crossing predictions and risk scores against actual outcomes
// Cron: 0 6 * * * (daily at 6 AM after crossings settle)

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
  console.log('📊 Feedback Loop — Prediction Accuracy Tracker')
  const start = Date.now()

  // 1. Crossing predictions: find predicted tráficos that have now crossed
  const { data: preds } = await supabase.from('crossing_predictions')
    .select('trafico_id, predicted_hours, calculated_at')
    .eq('company_id', COMPANY_ID).is('actual_hours', null)

  const predMap = {}
  ;(preds || []).forEach(p => { predMap[p.trafico_id] = p })
  const predIds = Object.keys(predMap)

  let crossVerified = 0, crossErrors = [], crossWithin4h = 0

  if (predIds.length > 0) {
    const { data: crossed } = await supabase.from('traficos')
      .select('trafico, fecha_llegada, fecha_cruce')
      .eq('company_id', COMPANY_ID).ilike('estatus', '%cruz%')
      .in('trafico', predIds)
      .not('fecha_llegada', 'is', null).not('fecha_cruce', 'is', null)

    for (const t of (crossed || [])) {
      const actual = (new Date(t.fecha_cruce) - new Date(t.fecha_llegada)) / 3600000
      if (actual <= 0 || actual > 72) continue
      const pred = predMap[t.trafico]
      const error = Math.abs(pred.predicted_hours - actual)
      crossErrors.push(error)
      if (error <= 4) crossWithin4h++
      crossVerified++
      await supabase.from('crossing_predictions').update({
        actual_hours: Math.round(actual * 10) / 10,
        accuracy: Math.round((1 - error / actual) * 100) / 100
      }).eq('trafico_id', t.trafico).eq('company_id', COMPANY_ID)
    }
  }

  const crossAccuracy = crossVerified > 0 ? Math.round((crossWithin4h / crossVerified) * 100) : 0
  const avgError = crossErrors.length > 0 ? (crossErrors.reduce((a, b) => a + b, 0) / crossErrors.length).toFixed(1) : 'N/A'

  // 2. Risk scores: check scored tráficos that have since crossed for issues
  const { data: riskScores } = await supabase.from('pedimento_risk_scores')
    .select('trafico_id, score')
    .eq('company_id', COMPANY_ID).is('actual_outcome', null)

  const riskMap = {}
  ;(riskScores || []).forEach(r => { riskMap[r.trafico_id] = r })
  const riskIds = Object.keys(riskMap)

  let riskVerified = 0, riskCorrect = 0

  if (riskIds.length > 0) {
    const { data: crossedRisk } = await supabase.from('traficos')
      .select('trafico').eq('company_id', COMPANY_ID).ilike('estatus', '%cruz%')
      .in('trafico', riskIds)

    const crossedSet = new Set((crossedRisk || []).map(t => t.trafico))
    if (crossedSet.size > 0) {
      const { data: entradas } = await supabase.from('entradas')
        .select('trafico, mercancia_danada, tiene_faltantes')
        .eq('company_id', COMPANY_ID).in('trafico', [...crossedSet])

      const issueSet = new Set()
      ;(entradas || []).forEach(e => { if (e.mercancia_danada || e.tiene_faltantes) issueSet.add(e.trafico) })

      for (const tid of crossedSet) {
        const hadIssue = issueSet.has(tid)
        const wasHighRisk = riskMap[tid].score > 50
        const outcome = hadIssue ? 'issue' : 'clean'
        if ((wasHighRisk && hadIssue) || (!wasHighRisk && !hadIssue)) riskCorrect++
        riskVerified++
        await supabase.from('pedimento_risk_scores').update({ actual_outcome: outcome })
          .eq('trafico_id', tid).eq('company_id', COMPANY_ID)
      }
    }
  }

  const riskAccuracy = riskVerified > 0 ? Math.round((riskCorrect / riskVerified) * 100) : 0

  // 3. Summary
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`${crossVerified} crossing predictions verified, accuracy ${crossAccuracy}% (within 4h), avg error ${avgError}h`)
  console.log(`${riskVerified} risk scores verified, accuracy ${riskAccuracy}%`)

  if (crossVerified > 0 || riskVerified > 0) {
    await sendTG(
      `📊 <b>Feedback Loop</b>\n\n` +
      `🔮 Crossing: ${crossVerified} verified, ${crossAccuracy}% within 4h, avg error ${avgError}h\n` +
      `🔍 Risk: ${riskVerified} verified, ${riskAccuracy}% correct\n\n` +
      `— CRUZ 🦀 · ${elapsed}s`
    )
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
