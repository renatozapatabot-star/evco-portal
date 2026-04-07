#!/usr/bin/env node
/**
 * CRUZ Exception Intelligence Engine — Build 232
 * ============================================================================
 * When anomalies occur (delay, reconocimiento, missing doc, stuck tráfico),
 * CRUZ runs a full diagnostic:
 *
 * 1. Context gathering — pull all data about the operation + similar ops
 * 2. Hypothesis generation — 3 ranked causes with confidence
 * 3. Evidence evaluation — check each hypothesis against history
 * 4. Action recommendation — exact next step
 * 5. Communication drafts — messages for client + internal team
 * 6. Outcome tracking — verify hypothesis when exception resolves
 *
 * Multi-client. Writes to exception_diagnoses table + agent_decisions.
 *
 * Cron: */15 6-22 * * 1-6 (every 15 min business hours)
 * Patente 3596 · Aduana 240
 * ============================================================================
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'exception-detective'
const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function hoursSince(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60)
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDate = d => `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`

// ── Anomaly Detectors ───────────────────────────────────────────────────────

async function detectDelayedCrossings(companyId) {
  const anomalies = []
  const { data: delayed } = await supabase
    .from('traficos')
    .select('trafico, proveedores, descripcion_mercancia, estatus, updated_at, importe_total')
    .eq('company_id', companyId)
    .eq('estatus', 'Pedimento Pagado')
    .lt('updated_at', daysAgo(2))
    .limit(20)

  for (const t of (delayed || [])) {
    const hours = hoursSince(t.updated_at)
    const supplier = (t.proveedores || '').split(',')[0]?.trim()
    anomalies.push({
      type: 'delayed_crossing',
      trafico: t.trafico,
      severity: hours > 96 ? 'critical' : hours > 72 ? 'high' : 'medium',
      hours_delayed: Math.round(hours),
      context: {
        supplier,
        product: t.descripcion_mercancia?.substring(0, 50),
        status: t.estatus,
        value_usd: t.importe_total,
      },
    })
  }
  return anomalies
}

async function detectOverdueDocuments(companyId) {
  const anomalies = []
  const { data: overdue } = await supabase
    .from('documento_solicitudes')
    .select('trafico_id, doc_type, solicitado_at, escalation_level')
    .eq('status', 'solicitado')
    .lt('solicitado_at', daysAgo(3))
    .limit(20)

  for (const d of (overdue || [])) {
    const hours = hoursSince(d.solicitado_at)
    anomalies.push({
      type: 'overdue_document',
      trafico: d.trafico_id,
      severity: hours > 120 ? 'critical' : 'high',
      hours_overdue: Math.round(hours),
      context: {
        doc_type: d.doc_type,
        escalation_level: d.escalation_level || 0,
      },
    })
  }
  return anomalies
}

async function detectStuckTraficos(companyId) {
  const anomalies = []
  const { data: stuck } = await supabase
    .from('traficos')
    .select('trafico, proveedores, descripcion_mercancia, estatus, created_at, updated_at')
    .eq('company_id', companyId)
    .eq('estatus', 'En proceso')
    .lt('updated_at', daysAgo(7))
    .limit(20)

  for (const t of (stuck || [])) {
    const daysSinceUpdate = Math.round(hoursSince(t.updated_at) / 24)
    const supplier = (t.proveedores || '').split(',')[0]?.trim()
    anomalies.push({
      type: 'stuck_trafico',
      trafico: t.trafico,
      severity: daysSinceUpdate > 14 ? 'critical' : 'medium',
      days_stuck: daysSinceUpdate,
      context: {
        supplier,
        product: t.descripcion_mercancia?.substring(0, 50),
        status: t.estatus,
        created: t.created_at,
      },
    })
  }
  return anomalies
}

// ── Hypothesis Engine ───────────────────────────────────────────────────────

async function generateDiagnosis(anomaly, companyId) {
  const { type, trafico, context } = anomaly
  const hypotheses = []

  // Fetch similar recent exceptions for pattern detection
  const { data: recentExceptions } = await supabase
    .from('exception_diagnoses')
    .select('exception_type, trafico, primary_hypothesis, primary_confidence, context')
    .eq('company_id', companyId)
    .gte('detected_at', daysAgo(7))
    .limit(20)

  const recentSameType = (recentExceptions || []).filter(e => e.exception_type === type)

  // ── DELAYED CROSSING ──
  if (type === 'delayed_crossing') {
    // H1: SAT screening campaign
    if (recentSameType.length >= 2) {
      hypotheses.push({
        rank: 1,
        hypothesis: `Posible revisión intensificada de SAT — ${recentSameType.length + 1} cruces demorados esta semana.`,
        confidence: Math.min(0.85, 0.55 + recentSameType.length * 0.10),
        evidence: `${recentSameType.length} excepciones similares en 7 días`,
      })
    }

    // H2: Product-specific inspection
    const { count: sameProduct } = await supabase
      .from('traficos')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .ilike('descripcion_mercancia', `%${(context.product || '').substring(0, 15)}%`)
      .eq('estatus', 'Pedimento Pagado')
      .lt('updated_at', daysAgo(2))

    if ((sameProduct || 0) >= 2) {
      hypotheses.push({
        rank: hypotheses.length + 1,
        hypothesis: `SAT puede estar inspeccionando ${context.product?.substring(0, 30)} — ${sameProduct} operaciones con mismo producto afectadas.`,
        confidence: 0.70,
        evidence: `${sameProduct} tráficos con producto similar detenidos`,
      })
    }

    // H3: High value triggered review
    if (context.value_usd && context.value_usd > 50000) {
      hypotheses.push({
        rank: hypotheses.length + 1,
        hypothesis: `Alto valor ($${Math.round(context.value_usd).toLocaleString()} USD) pudo activar revisión automatizada.`,
        confidence: 0.45,
        evidence: `Valor superior a $50K USD`,
      })
    }

    // H4: Routine reconocimiento
    hypotheses.push({
      rank: hypotheses.length + 1,
      hypothesis: `Reconocimiento de rutina — inspección aleatoria sin patrón aparente.`,
      confidence: 0.30,
      evidence: `Sin patrones adicionales detectados`,
    })
  }

  // ── OVERDUE DOCUMENT ──
  if (type === 'overdue_document') {
    // Check supplier responsiveness
    const { data: history } = await supabase
      .from('documento_solicitudes')
      .select('status, solicitado_at, recibido_at')
      .eq('trafico_id', trafico)

    const fulfilled = (history || []).filter(s => s.status === 'recibido')
    const total = (history || []).length

    if (fulfilled.length === 0 && total > 1) {
      hypotheses.push({
        rank: 1,
        hypothesis: `Proveedor no ha respondido a ${total} solicitudes. Posible problema de comunicación o rechazo.`,
        confidence: 0.80,
        evidence: `0/${total} solicitudes atendidas para este tráfico`,
      })
    } else {
      hypotheses.push({
        rank: 1,
        hypothesis: `Documento ${context.doc_type} pendiente ${anomaly.hours_overdue}h. Proveedor normalmente responde — posible retraso interno.`,
        confidence: 0.60,
        evidence: `${fulfilled.length}/${total} solicitudes previas atendidas`,
      })
    }

    if (context.escalation_level >= 2) {
      hypotheses.push({
        rank: hypotheses.length + 1,
        hypothesis: `Escalación nivel ${context.escalation_level} sin respuesta. El proveedor puede necesitar contacto directo por teléfono.`,
        confidence: 0.75,
        evidence: `Escalación automática agotada`,
      })
    }
  }

  // ── STUCK TRAFICO ──
  if (type === 'stuck_trafico') {
    // Check for documents
    const { count: docCount } = await supabase
      .from('expediente_documentos')
      .select('id', { count: 'exact', head: true })
      .eq('trafico_id', trafico)

    if ((docCount || 0) === 0) {
      hypotheses.push({
        rank: 1,
        hypothesis: `Tráfico sin documentos después de ${anomaly.days_stuck} días. Posible cancelación de embarque o error de captura en GlobalPC.`,
        confidence: 0.70,
        evidence: `0 documentos en expediente`,
      })
    } else {
      hypotheses.push({
        rank: 1,
        hypothesis: `Tráfico estancado con ${docCount} documentos. Documentación incompleta puede estar bloqueando el pedimento.`,
        confidence: 0.60,
        evidence: `${docCount} documentos presentes pero sin avance`,
      })
    }

    hypotheses.push({
      rank: hypotheses.length + 1,
      hypothesis: `Proveedor ${context.supplier || '(desconocido)'} puede tener retraso en embarque.`,
      confidence: 0.40,
      evidence: `Sin movimiento en ${anomaly.days_stuck} días`,
    })
  }

  // Sort by confidence
  hypotheses.sort((a, b) => b.confidence - a.confidence)
  hypotheses.forEach((h, i) => h.rank = i + 1)

  const primary = hypotheses[0] || { hypothesis: 'Sin hipótesis clara', confidence: 0.3 }

  // ── Recommended action ──
  let recommendedAction = ''
  let actionType = 'wait'
  let estimatedHours = 24

  if (type === 'delayed_crossing') {
    if (primary.confidence >= 0.7) {
      recommendedAction = `Si es revisión SAT, se libera en 2-4 horas. Avisar al cliente del retraso esperado. No abrir investigación.`
      actionType = 'contact_client'
      estimatedHours = 4
    } else {
      recommendedAction = `Verificar estatus en aduana. Si supera 96h, escalar a Tito.`
      actionType = anomaly.hours_delayed > 96 ? 'escalate' : 'wait'
      estimatedHours = anomaly.hours_delayed > 96 ? 2 : 24
    }
  } else if (type === 'overdue_document') {
    if (context.escalation_level >= 2) {
      recommendedAction = `Llamar directamente al proveedor. La escalación automática no fue suficiente.`
      actionType = 'contact_supplier'
      estimatedHours = 8
    } else {
      recommendedAction = `Esperar siguiente ciclo de escalación. Monitorear.`
      actionType = 'wait'
      estimatedHours = 24
    }
  } else if (type === 'stuck_trafico') {
    if ((docCount || 0) === 0) {
      recommendedAction = `Verificar con Claudia si el embarque se canceló. Si sigue activo, solicitar documentación urgente.`
      actionType = 'investigate'
      estimatedHours = 4
    } else {
      recommendedAction = `Revisar expediente y solicitar documentos faltantes. Contactar proveedor si es necesario.`
      actionType = 'contact_supplier'
      estimatedHours = 24
    }
  }

  // ── Communication drafts ──
  const supplierName = context.supplier || 'el proveedor'
  const typeLabels = {
    delayed_crossing: 'retraso en cruce',
    overdue_document: 'documento pendiente',
    stuck_trafico: 'operación detenida',
  }

  const clientDraft = anomaly.severity === 'critical' || anomaly.severity === 'high'
    ? `Estimado cliente,\n\nLe informamos que la operación ${trafico || ''} presenta un ${typeLabels[type] || 'incidente'}.\n\n` +
      `${primary.hypothesis}\n\n` +
      `Estamos monitoreando la situación y le informaremos cuando se resuelva.\n` +
      `Tiempo estimado de resolución: ~${estimatedHours} horas.\n\n` +
      `— Renato Zapata y Cía · Patente 3596`
    : null

  const internalDraft =
    `🔍 ${typeLabels[type]?.toUpperCase() || type} — ${trafico || 'N/A'}\n\n` +
    `Hipótesis principal (${Math.round(primary.confidence * 100)}%): ${primary.hypothesis}\n\n` +
    `Acción: ${recommendedAction}\n` +
    `Tiempo estimado: ~${estimatedHours}h`

  return {
    hypotheses,
    primary_hypothesis: primary.hypothesis,
    primary_confidence: primary.confidence,
    recommended_action: recommendedAction,
    recommended_action_type: actionType,
    estimated_resolution_hours: estimatedHours,
    client_message_draft: clientDraft,
    internal_message_draft: internalDraft,
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`🔍 Exception Intelligence — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  // Multi-client: get all active companies
  const { data: companies } = await supabase
    .from('companies')
    .select('company_id')
    .eq('active', true)

  const companyIds = (companies || []).map(c => c.company_id)
  if (companyIds.length === 0) companyIds.push('evco') // Fallback

  let totalCreated = 0
  let totalNotified = 0

  for (const companyId of companyIds) {
    // Run all detectors in parallel
    const [delays, overdue, stuck] = await Promise.all([
      detectDelayedCrossings(companyId),
      detectOverdueDocuments(companyId),
      detectStuckTraficos(companyId),
    ])

    const allAnomalies = [...delays, ...overdue, ...stuck]
    if (allAnomalies.length === 0) continue

    console.log(`\n  ${companyId}: ${allAnomalies.length} anomalía(s)`)

    // Dedup: check recent diagnoses (last 4h)
    const { data: recentDiags } = await supabase
      .from('exception_diagnoses')
      .select('exception_type, trafico')
      .eq('company_id', companyId)
      .gte('detected_at', new Date(Date.now() - 4 * 3600000).toISOString())

    const recentKeys = new Set(
      (recentDiags || []).map(d => `${d.exception_type}:${d.trafico}`).filter(Boolean)
    )

    for (const anomaly of allAnomalies) {
      const key = `${anomaly.type}:${anomaly.trafico}`
      if (recentKeys.has(key)) {
        console.log(`    skip (recent): ${key}`)
        continue
      }

      const diagnosis = await generateDiagnosis(anomaly, companyId)

      console.log(`    🔍 ${anomaly.trafico} · ${anomaly.type} · ${anomaly.severity}`)
      console.log(`       H1: ${diagnosis.primary_hypothesis} (${Math.round(diagnosis.primary_confidence * 100)}%)`)
      console.log(`       → ${diagnosis.recommended_action}`)

      if (!DRY_RUN) {
        // Write to exception_diagnoses
        await supabase.from('exception_diagnoses').insert({
          company_id: companyId,
          trafico: anomaly.trafico,
          exception_type: anomaly.type,
          severity: anomaly.severity,
          hypotheses: diagnosis.hypotheses,
          primary_hypothesis: diagnosis.primary_hypothesis,
          primary_confidence: diagnosis.primary_confidence,
          recommended_action: diagnosis.recommended_action,
          recommended_action_type: diagnosis.recommended_action_type,
          estimated_resolution_hours: diagnosis.estimated_resolution_hours,
          client_message_draft: diagnosis.client_message_draft,
          internal_message_draft: diagnosis.internal_message_draft,
          context: anomaly.context,
          status: 'open',
        }).catch(err => console.error(`    ⚠ Insert failed: ${err.message}`))

        // Also log to agent_decisions for backward compat
        await supabase.from('agent_decisions').insert({
          trigger_type: 'exception',
          decision: diagnosis.primary_hypothesis,
          confidence: diagnosis.primary_confidence,
          autonomy_level: 0,
          action_taken: 'diagnosis_generated',
          company_id: companyId,
          payload: {
            anomaly_type: anomaly.type,
            trafico: anomaly.trafico,
            severity: anomaly.severity,
            context: anomaly.context,
            hypotheses_count: diagnosis.hypotheses.length,
            recommended_action_type: diagnosis.recommended_action_type,
          },
        }).catch(() => {})
      }

      totalCreated++

      // Telegram for critical/high
      if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
        const icon = anomaly.severity === 'critical' ? '🔴' : '🟠'
        await tg(
          `${icon} <b>Excepción: ${anomaly.type.replace(/_/g, ' ')}</b>\n\n` +
          `Tráfico: ${anomaly.trafico || 'N/A'} · ${companyId}\n` +
          `${diagnosis.primary_hypothesis}\n` +
          `Confianza: ${Math.round(diagnosis.primary_confidence * 100)}%\n\n` +
          `Acción: ${diagnosis.recommended_action}\n` +
          `Resolución estimada: ~${diagnosis.estimated_resolution_hours}h\n\n` +
          `— CRUZ 🔍`
        )
        totalNotified++
      }
    }
  }

  // Auto-resolve: check if previously open exceptions have resolved
  if (!DRY_RUN) {
    const { data: openExceptions } = await supabase
      .from('exception_diagnoses')
      .select('id, company_id, trafico, exception_type')
      .eq('status', 'open')
      .lt('detected_at', daysAgo(1))
      .limit(50)

    for (const ex of (openExceptions || [])) {
      if (!ex.trafico) continue

      // Check if the tráfico has progressed
      const { data: trafico } = await supabase
        .from('traficos')
        .select('estatus, fecha_cruce')
        .eq('trafico', ex.trafico)
        .eq('company_id', ex.company_id)
        .maybeSingle()

      let resolved = false
      if (ex.exception_type === 'delayed_crossing' && trafico?.fecha_cruce) resolved = true
      if (ex.exception_type === 'stuck_trafico' && trafico?.estatus !== 'En proceso') resolved = true

      if (resolved) {
        await supabase.from('exception_diagnoses').update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', ex.id)
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  await tg(
    `🔍 <b>Exception Intelligence — Resumen</b>\n\n` +
    `${totalCreated} diagnósticos generados\n` +
    `${totalNotified} alertas enviadas\n` +
    `${companyIds.length} empresa(s) analizadas\n` +
    `Duración: ${elapsed}s\n\n` +
    `— CRUZ 🔍`
  )

  if (!DRY_RUN) {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME,
      status: 'success',
      details: { created: totalCreated, notified: totalNotified, companies: companyIds.length, elapsed_s: parseFloat(elapsed) },
    }).catch(() => {})
  }

  console.log(`\n✅ ${totalCreated} diagnósticos · ${totalNotified} alertas · ${elapsed}s`)
}

run().catch(async err => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}`)
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME, status: 'failed',
    details: { error: err.message },
  }).catch(() => {})
  process.exit(1)
})
