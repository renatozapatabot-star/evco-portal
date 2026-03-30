#!/usr/bin/env node
// scripts/compliance-officer.js — Weekly AI compliance assessment
// Cron: 0 8 * * 1 (Monday 8 AM)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT = '-5085543275'
const COMPANY_ID = 'evco'

async function sendTG(msg) {
  if (!TG_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: 'HTML' })
  })
}

async function main() {
  console.log('🛡️ Compliance Officer — Weekly Assessment')
  const start = Date.now()
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const findings = []
  let score = 100

  // 1. Missing pedimento
  const { data: noPed } = await supabase.from('traficos')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID).is('pedimento', null)
  const missingPed = noPed?.length ?? 0
  const pedDeduct = Math.min(missingPed * 2, 30)
  if (missingPed > 0) findings.push(`${missingPed} traficos sin pedimento (-${pedDeduct})`)
  score -= pedDeduct

  // 2. Missing MVE folio (skip if column doesn't exist)
  let missingMve = 0
  const { data: mveData, error: mveErr } = await supabase.from('traficos')
    .select('id').eq('company_id', COMPANY_ID).is('mve_folio', null).limit(200)
  if (!mveErr) {
    missingMve = mveData?.length ?? 0
    if (missingMve > 0) findings.push(`${missingMve} traficos sin folio MVE (info)`)
  }

  // 3. Missing T-MEC certificate (igi=0 but no USMCA doc)
  const { data: tmecCandidates } = await supabase.from('traficos')
    .select('id, trafico').eq('company_id', COMPANY_ID).eq('igi', 0)
  let missingTmec = 0
  if (tmecCandidates?.length) {
    const ids = tmecCandidates.map(t => t.id)
    const { data: docs } = await supabase.from('documents')
      .select('trafico_id').in('trafico_id', ids).eq('doc_type', 'usmca')
    const docSet = new Set((docs || []).map(d => d.trafico_id))
    missingTmec = ids.filter(id => !docSet.has(id)).length
  }
  const tmecDeduct = Math.min(missingTmec * 5, 25)
  if (missingTmec > 0) findings.push(`${missingTmec} ops IGI=0 sin certificado T-MEC (-${tmecDeduct})`)
  score -= tmecDeduct

  // 4. Anomaly baselines — check deviations
  const { data: anomalies } = await supabase.from('anomaly_baselines')
    .select('metric, current_value, mean, std')
    .eq('company_id', COMPANY_ID).not('std', 'eq', 0)
  let anomalyCount = 0
  ;(anomalies || []).forEach(a => {
    if (a.current_value != null && Math.abs(a.current_value - a.mean) > 2 * a.std) anomalyCount++
  })
  const anomDeduct = Math.min(anomalyCount * 3, 15)
  if (anomalyCount > 0) findings.push(`${anomalyCount} anomalias detectadas (-${anomDeduct})`)
  score -= anomDeduct

  // 5. Entradas with incidents
  const { count: incidentCount } = await supabase.from('entradas')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID).not('incidencia', 'is', null)
    .gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
  const incidents = incidentCount || 0
  const incDeduct = Math.min(incidents * 3, 15)
  if (incidents > 0) findings.push(`${incidents} entradas con incidencia (-${incDeduct})`)
  score -= incDeduct

  score = Math.max(0, score)
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'
  const summary = `Compliance Score: ${score}/100 (${grade}). ${findings.length} hallazgos.`

  // 6. Save to monthly_intelligence_reports (discover columns via upsert attempt)
  const reportData = {
    company_id: COMPANY_ID, period,
    report_data: { score, grade, findings, assessed_at: now.toISOString(), summary },
  }
  const { error: rptErr } = await supabase.from('monthly_intelligence_reports').insert(reportData)
  if (rptErr) console.log(`⚠️ Report save: ${rptErr.message}`)
  else console.log('💾 Report saved to monthly_intelligence_reports')

  // 7. Update compliance_predictions with current findings
  const predictions = findings.map(f => ({
    company_id: COMPANY_ID, prediction_type: 'compliance_assessment',
    title: f.split(' (-')[0], description: f, severity: score < 60 ? 'critical' : score < 80 ? 'warning' : 'info',
    resolved: false, calculated_at: now.toISOString()
  }))
  if (predictions.length > 0) {
    await supabase.from('compliance_predictions').delete()
      .eq('company_id', COMPANY_ID).eq('prediction_type', 'compliance_assessment')
    await supabase.from('compliance_predictions').insert(predictions)
  }

  // 8. Telegram
  const emoji = score >= 90 ? '🟢' : score >= 75 ? '🟡' : '🔴'
  const topFindings = findings.slice(0, 5).map(f => `  • ${f}`).join('\n')
  await sendTG([
    `${emoji} <b>COMPLIANCE OFFICER — ${period}</b>`,
    `Score: <b>${score}/100 (${grade})</b>`,
    '', topFindings || '  Sin hallazgos',
    '', `— CRUZ 🦀`
  ].join('\n'))

  // 9. Print
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n${emoji} Score: ${score}/100 (${grade})`)
  findings.forEach(f => console.log(`  • ${f}`))
  console.log(`\n✅ Done in ${elapsed}s`)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
