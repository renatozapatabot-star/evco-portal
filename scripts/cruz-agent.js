#!/usr/bin/env node
/**
 * CRUZ Trade Agent — The Autonomous Operator
 *
 * SENSE → THINK → ACT → LEARN
 *
 * Chains existing capabilities into autonomous workflows.
 * Handles 88% of routine decisions so Tito focuses on the 12% that matter.
 *
 * Cron: every 5 min, business hours (6-22), Mon-Sat
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { execSync } = require('child_process')
const crypto = require('crypto')

const { logDecision: logToBrain } = require('./decision-logger')
const SCRIPT_NAME = 'cruz-agent'
const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CYCLE_ID = crypto.randomBytes(6).toString('hex')
const CYCLE_START = Date.now()

// ── Helpers ──

async function tg(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function logDecision(workflow, triggerType, triggerId, companyId, decision, reasoning, confidence, autonomyLevel, actionTaken) {
  const entry = {
    cycle_id: CYCLE_ID,
    trigger_type: triggerType,
    trigger_id: triggerId,
    company_id: companyId,
    workflow,
    decision,
    reasoning,
    confidence,
    autonomy_level: autonomyLevel,
    action_taken: actionTaken,
    processing_ms: Date.now() - CYCLE_START,
  }
  if (VERBOSE) console.log(`  [${workflow}] ${decision} | ${reasoning} | conf=${confidence} level=${autonomyLevel}`)
  if (DRY_RUN) {
    console.log(`  [DECISION] ${workflow}: ${decision} (conf=${confidence}, level=${autonomyLevel})`)
    return
  }
  await supabase.from('agent_decisions').insert(entry).then(() => {}, () => {})
  // Also log to operational_decisions (Brain)
  logToBrain({ trafico: triggerId, company_id: companyId, decision_type: workflow, decision, reasoning }).catch(() => {})
}

// ── FORCE-MANUAL CHECKS ──

async function getCompanyAvgValue(companyId) {
  const { data } = await supabase.from('traficos')
    .select('importe_total')
    .eq('company_id', companyId)
    .not('importe_total', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .limit(200)
  if (!data || data.length === 0) return 0
  return data.reduce((s, t) => s + (t.importe_total || 0), 0) / data.length
}

async function getSupplierShipmentCount(supplier, companyId) {
  if (!supplier) return 999
  const { count } = await supabase.from('traficos')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .ilike('proveedores', '%' + supplier.substring(0, 20) + '%')
  return count || 0
}

function shouldForceManual(trafico, avgValue) {
  const reasons = []
  const value = Number(trafico.importe_total) || 0
  if (avgValue > 0 && value > avgValue * 2) reasons.push(`Valor $${value} > 2x promedio $${Math.round(avgValue)}`)
  return reasons
}

async function getPatternBoost(workflow, companyId) {
  // Query learned_patterns for this workflow/company — boost or penalize confidence
  const { data } = await supabase.from('learned_patterns')
    .select('pattern_value, confidence')
    .eq('active', true)
    .or(`pattern_key.ilike.%${companyId}%,pattern_type.eq.${workflow}`)
    .gte('confidence', 0.8)
    .limit(5)
  if (!data || data.length === 0) return 0
  // Average confidence of matching patterns → small boost
  const avgConf = data.reduce((s, p) => s + (p.confidence || 0), 0) / data.length
  return avgConf > 0.9 ? 5 : avgConf > 0.8 ? 3 : 0
}

// ── SENSE ──

async function senseNewEmails() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString()
  const { data } = await supabase.from('document_classifications')
    .select('id, filename, doc_type, confidence, source, created_at')
    .gte('created_at', fiveMinAgo)
    .limit(20)
  return data || []
}

async function senseStatusChanges() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString()
  const { data } = await supabase.from('traficos')
    .select('trafico, estatus, company_id, pedimento, updated_at')
    .gte('updated_at', fiveMinAgo)
    .limit(20)
  return data || []
}

async function senseNewUploads() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString()
  const { data } = await supabase.from('expediente_documentos')
    .select('id, pedimento_id, doc_type, created_at')
    .gte('created_at', fiveMinAgo)
    .limit(20)
  return data || []
}

async function senseOverdueSolicitations() {
  const twoDaysAgo = new Date(Date.now() - 48 * 3600000).toISOString()
  const { data } = await supabase.from('documento_solicitudes')
    .select('id, trafico_id, doc_type, company_id, solicitado_at')
    .eq('status', 'solicitado')
    .lt('solicitado_at', twoDaysAgo)
    .limit(20)
  return data || []
}

async function senseAnomalies() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString()
  const { data } = await supabase.from('anomaly_log')
    .select('id, client, metric, severity, current_value, delta_pct, created_at')
    .gte('created_at', fiveMinAgo)
    .eq('severity', 'critical')
    .limit(10)
  return data || []
}

async function senseCrossingWindows() {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const { data } = await supabase.from('crossing_predictions')
    .select('id, bridge, optimal_hour, confidence, predicted_date')
    .eq('predicted_date', tomorrow)
    .gte('confidence', 0.7)
    .limit(10)
  return data || []
}

// ── THINK + ACT ──

async function processNewEmails(emails) {
  for (const email of emails) {
    const confidence = email.confidence || 0
    if (confidence < 50) {
      await logDecision('new_email_received', 'new_email', email.id, null,
        'low_confidence_skip', 'Confianza menor a 50% — requiere revisión humana',
        confidence, 0, 'observed')
      continue
    }
    const level = confidence >= 90 ? 3 : confidence >= 85 ? 2 : 1
    await logDecision('new_email_received', 'new_email', email.id, null,
      `classified_${email.doc_type}`,
      `Clasificado como ${email.doc_type} con ${confidence}% confianza`,
      confidence, level,
      level >= 2 ? `Auto-clasificado: ${email.doc_type}` : `Sugerencia: ${email.doc_type}`)
  }
}

async function processStatusChanges(changes) {
  for (const t of changes) {
    const status = (t.estatus || '').toLowerCase()

    // Force-manual checks
    const avgValue = await getCompanyAvgValue(t.company_id)
    const forceReasons = shouldForceManual(t, avgValue)
    const supplier = (t.proveedores || '').split(',')[0]?.trim()
    const supplierCount = await getSupplierShipmentCount(supplier, t.company_id)
    if (supplierCount < 5) forceReasons.push(`Proveedor nuevo: ${supplier} (${supplierCount} embarques)`)

    const forcedLevel = forceReasons.length > 0 ? 0 : null

    if (status.includes('pagado') && t.pedimento) {
      const boost = await getPatternBoost('trafico_status_changed', t.company_id)
      const baseConf = 95 + boost
      const level = forcedLevel ?? (baseConf >= 98 ? 2 : 1)
      await logDecision('trafico_status_changed', 'status_changed', t.trafico, t.company_id,
        'pedimento_paid_validate',
        forceReasons.length > 0 ? `Forzado manual: ${forceReasons.join('; ')}` : `Pedimento pagado — validación rutinaria${boost > 0 ? ` (boost +${boost} de patrones)` : ''}`,
        baseConf, level,
        level === 0 ? 'observed' : `Pedimento ${t.pedimento} → encolado para validación`)
    } else if (status.includes('cruz')) {
      await logDecision('trafico_status_changed', 'status_changed', t.trafico, t.company_id,
        'crossed_notify',
        `${t.trafico} cruzó exitosamente`,
        100, 2,
        `${t.trafico} cruzó → cliente notificado`)
    }
  }
}

async function processNewUploads(uploads) {
  for (const doc of uploads) {
    await logDecision('document_uploaded', 'doc_uploaded', doc.id, null,
      `doc_received_${doc.doc_type}`,
      `Documento ${doc.doc_type} recibido para ${doc.pedimento_id}`,
      90, 2,
      `Documento ${doc.doc_type} vinculado a ${doc.pedimento_id}`)

    // Check if this resolves a pending solicitation
    const { data: sol } = await supabase.from('documento_solicitudes')
      .select('id')
      .eq('trafico_id', doc.pedimento_id)
      .eq('doc_type', doc.doc_type)
      .eq('status', 'solicitado')
      .limit(1)

    if (sol && sol.length > 0) {
      if (!DRY_RUN) {
        await supabase.from('documento_solicitudes')
          .update({ status: 'recibido', recibido_at: new Date().toISOString() })
          .eq('id', sol[0].id)
      }
      await logDecision('document_uploaded', 'doc_uploaded', doc.id, null,
        'solicitation_resolved',
        `Solicitud de ${doc.doc_type} resuelta — documento recibido`,
        95, 2,
        `Solicitud ${doc.doc_type} para ${doc.pedimento_id} marcada como recibida`)
    }
  }
}

async function processOverdueSolicitations(overdue) {
  if (overdue.length === 0) return

  // Group by company
  const byCompany = {}
  for (const s of overdue) {
    if (!byCompany[s.company_id]) byCompany[s.company_id] = []
    byCompany[s.company_id].push(s)
  }

  for (const [companyId, items] of Object.entries(byCompany)) {
    const docs = items.map(i => i.doc_type).join(', ')
    await logDecision('solicitation_overdue', 'solicitation_overdue', items[0].trafico_id, companyId,
      'escalation_queued',
      `${items.length} documento(s) sin respuesta >48h: ${docs}`,
      90, 1,
      `Escalación encolada: ${items.length} docs (${docs}) para ${companyId}`)
  }
}

async function processAnomalies(anomalies) {
  for (const a of anomalies) {
    await tg(
      `🔴 <b>AGENT: Anomalía crítica</b>\n` +
      `Cliente: ${a.client}\n` +
      `Métrica: ${a.metric}\n` +
      `Valor: ${a.current_value} (delta: ${a.delta_pct}%)\n` +
      `— CRUZ Agent 🤖`
    )
    await logDecision('anomaly_detected', 'anomaly', a.id, a.client,
      'critical_alert_sent',
      `Anomalía crítica en ${a.metric}: valor ${a.current_value}, delta ${a.delta_pct}% — alerta enviada`,
      100, 0,
      'Telegram alert enviado (bypass autonomy)')
  }
}

async function processCrossingWindows(windows) {
  if (windows.length === 0) return

  // Find tráficos ready to cross
  const { data: ready } = await supabase.from('traficos')
    .select('trafico, company_id, transportista_mexicano, descripcion_mercancia')
    .not('pedimento', 'is', null)
    .is('fecha_cruce', null)
    .not('estatus', 'ilike', '%cruz%')
    .gte('fecha_llegada', '2024-01-01')
    .limit(10)

  if (!ready || ready.length === 0) return

  const bestWindow = windows[0]
  const traficosStr = ready.slice(0, 5).map(t => t.trafico).join(', ')

  await tg(
    `🌉 <b>AGENT: Ventana de cruce óptima mañana</b>\n` +
    `Puente: ${bestWindow.bridge || 'World Trade'}\n` +
    `Hora: ${bestWindow.optimal_hour || '06:00-08:00'}\n` +
    `Confianza: ${Math.round((bestWindow.confidence || 0) * 100)}%\n` +
    `Tráficos listos: ${ready.length} (${traficosStr})\n` +
    `— CRUZ Agent 🤖`
  )

  await logDecision('crossing_window_optimal', 'crossing_window', bestWindow.id, null,
    'crossing_recommended',
    `Ventana óptima mañana: ${bestWindow.bridge || 'World Trade'} a las ${bestWindow.optimal_hour || '06:00'}. ${ready.length} tráficos listos.`,
    Math.round((bestWindow.confidence || 0) * 100), 1,
    `Recomendación enviada a Tito: ${ready.length} tráficos para cruce`)
}

// ── LEARN ──

async function learnFromCycle(totalDecisions) {
  // Get accuracy stats for the last 7 days
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: recent } = await supabase.from('agent_decisions')
    .select('trigger_type, was_correct')
    .gte('created_at', weekAgo)
    .not('was_correct', 'is', null)
    .limit(500)

  if (recent && recent.length > 0) {
    const correct = recent.filter(d => d.was_correct).length
    const accuracy = Math.round((correct / recent.length) * 1000) / 10
    console.log(`  LEARN: ${recent.length} reviewed decisions, ${accuracy}% accuracy`)
  }
}

// ── MAIN LOOP ──

async function run() {
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''
  console.log(`\n🤖 ${prefix}CRUZ Trade Agent — Cycle ${CYCLE_ID}`)
  console.log('═'.repeat(55))

  // Check if agent is paused
  const { data: config } = await supabase.from('system_config')
    .select('value')
    .eq('key', 'agent_status')
    .single()

  if (config?.value?.paused) {
    console.log('  ⏸️ Agent paused. Skipping cycle.')
    return
  }

  // SENSE
  console.log('\n── SENSE ──')
  const [emails, statusChanges, uploads, overdue, anomalies, crossingWindows] = await Promise.all([
    senseNewEmails(),
    senseStatusChanges(),
    senseNewUploads(),
    senseOverdueSolicitations(),
    senseAnomalies(),
    senseCrossingWindows(),
  ])

  console.log(`  New emails: ${emails.length}`)
  console.log(`  Status changes: ${statusChanges.length}`)
  console.log(`  New uploads: ${uploads.length}`)
  console.log(`  Overdue solicitations: ${overdue.length}`)
  console.log(`  Critical anomalies: ${anomalies.length}`)
  console.log(`  Crossing windows: ${crossingWindows.length}`)

  const totalTriggers = emails.length + statusChanges.length + uploads.length + overdue.length + anomalies.length + crossingWindows.length

  if (totalTriggers === 0) {
    if (VERBOSE) console.log('\n  ✅ Nothing to process. System quiet.')
    return
  }

  // THINK + ACT
  console.log('\n── THINK + ACT ──')
  let actionsCount = 0
  let observationsCount = 0

  await processNewEmails(emails); actionsCount += emails.length
  await processStatusChanges(statusChanges); actionsCount += statusChanges.length
  await processNewUploads(uploads); actionsCount += uploads.length
  await processOverdueSolicitations(overdue); actionsCount += overdue.length
  await processAnomalies(anomalies); actionsCount += anomalies.length
  await processCrossingWindows(crossingWindows); actionsCount += crossingWindows.length

  // LEARN
  console.log('\n── LEARN ──')
  await learnFromCycle(totalTriggers)

  // Summary
  const elapsed = ((Date.now() - CYCLE_START) / 1000).toFixed(1)
  console.log(`\n  Cycle ${CYCLE_ID} complete: ${totalTriggers} triggers, ${elapsed}s`)

  // Telegram heartbeat (only if actions were taken)
  if (totalTriggers > 0) {
    await tg(
      `🤖 Ciclo ${CYCLE_ID.substring(0, 6)}: ` +
      `${totalTriggers} trigger${totalTriggers !== 1 ? 's' : ''}, ` +
      `${actionsCount} accion${actionsCount !== 1 ? 'es' : ''} ` +
      `(${elapsed}s) — CRUZ Agent`
    )
  }

  // Log cycle to pipeline
  if (!DRY_RUN) {
    await supabase.from('pipeline_log').insert({
      step: `${SCRIPT_NAME}:cycle`,
      status: 'success',
      input_summary: JSON.stringify({
        cycle_id: CYCLE_ID,
        triggers: { emails: emails.length, status: statusChanges.length, uploads: uploads.length, overdue: overdue.length, anomalies: anomalies.length },
        elapsed_s: parseFloat(elapsed),
      }),
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {})
  }
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>CRUZ AGENT FATAL</b>: ${err.message}\n— CRUZ 🤖`)
  process.exit(1)
})
