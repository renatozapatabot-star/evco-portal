#!/usr/bin/env node
/**
 * CRUZ 2.0 — Workflow Processor (replaces cruz-agent.js)
 *
 * Polls workflow_events WHERE status='pending' every 30 seconds.
 * Dispatches to the correct handler based on workflow + event_type.
 * On completion, chains to the next workflow via workflow_chains config.
 *
 * SENSE → THINK → ACT → LEARN is now:
 * EMIT → QUEUE → PROCESS → CHAIN
 *
 * Cron: pm2 daemon (always-on during business hours)
 * Or: every-minute 6-22 * * 1-6 node scripts/workflow-processor.js --once
 *
 * Flags:
 *   --dry-run   → process events without executing handlers
 *   --once      → single poll cycle, then exit (for cron mode)
 *   --verbose   → detailed logging
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const fs = require('fs')
const crypto = require('crypto')

const { fetchPendingEvents, updateEventStatus, chainNext, emitEvent, supabase } = require('./lib/workflow-emitter')
const { logDecision } = require('./decision-logger')
const batcher = require('./lib/notification-batcher')
const { calculateContributions, lookupTariffRate, lookupHistoricalDTA } = require('./lib/ghost-pipeline')
const { getAllRates } = require('./lib/rates')

const SCRIPT_NAME = 'workflow-processor'
const DRY_RUN = process.argv.includes('--dry-run')
const ONCE = process.argv.includes('--once')
const VERBOSE = process.argv.includes('--verbose')
const POLL_INTERVAL_MS = 30_000
const MAX_RETRIES = 3
const HEARTBEAT_PATH = path.join(__dirname, 'heartbeat-state.json')

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

// ── Telegram ──

async function tg(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  const token = TELEGRAM_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

// ── Heartbeat ──

function writeHeartbeat(status, extra = {}) {
  const state = {
    script: SCRIPT_NAME,
    status,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    ...extra,
  }
  try {
    fs.writeFileSync(HEARTBEAT_PATH, JSON.stringify(state, null, 2))
  } catch (_) { /* best-effort */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPATCH TABLE — maps workflow.event_type → handler function
//
// Each handler receives the event row and returns { success: bool, result?: string }
// Handlers that need to call external scripts do so via require() and module.exports.
// Phase 2 will add real handlers. For now, all are logged + chained.
// ═══════════════════════════════════════════════════════════════════════════

const HANDLERS = {
  // ── Workflow 1: Intake ──
  'intake.email_processed': async (event) => {
    // Logged by email-intake.js after processing. Chain triggers classification.
    return { success: true, result: `Intake processed for ${event.trigger_id}` }
  },
  'intake.document_attached': async (event) => {
    return { success: true, result: `Document attached: ${event.payload?.docType || 'unknown'}` }
  },

  // ── Workflow 2: Classification ──
  'classify.product_needs_classification': async (event) => {
    const { spawn } = require('child_process')

    const products = event.payload?.products || []
    const companyId = event.company_id
    const triggerId = event.trigger_id

    if (products.length === 0) {
      return { success: true, result: 'No products in payload — nothing to classify' }
    }

    if (!companyId) {
      return { success: false, result: 'Missing company_id — cannot classify without tenant scope' }
    }

    if (VERBOSE) console.log(`  [classify handler] ${products.length} products from ${companyId} (trigger: ${triggerId})`)

    // Fire-and-forget: spawn a child process per product.
    // Each child runs auto-classifier in single-product mode (--desc=).
    // We don't await — the child runs independently and writes its own results to the DB.
    // If the child crashes, only that product fails — workflow processor stays alive.

    let dispatched = 0
    let skipped = 0

    for (const product of products) {
      const description = product.description || product.descripcion
      const cveProveedor = product.cve_proveedor || product.cveProveedor
      const cveProducto = product.cve_producto || product.cveProducto

      if (!description) {
        skipped++
        continue
      }

      const args = [
        path.join(__dirname, 'auto-classifier.js'),
        '--desc=' + description,
        '--cve-cliente=' + companyId,
        '--company-id=' + companyId,
        '--trigger-id=' + triggerId,
      ]
      if (cveProveedor) args.push('--cve-proveedor=' + cveProveedor)
      if (cveProducto) args.push('--cve-producto=' + cveProducto)

      try {
        const child = spawn('node', args, {
          detached: true,
          stdio: 'ignore',
          cwd: path.join(__dirname, '..'), // repo root so .env.local resolves
        })
        child.unref()
        dispatched++
      } catch (spawnErr) {
        console.error(`  [classify handler] failed to spawn for product:`, spawnErr.message)
      }
    }

    if (dispatched === 0 && products.length > 0) {
      return { success: false, result: `All ${products.length} products failed to dispatch (${skipped} had no description)` }
    }

    return {
      success: true,
      result: `Dispatched ${dispatched} classifications (${skipped} skipped, ${products.length} total) for ${triggerId}`,
    }
  },
  'classify.classification_complete': async (event) => {
    const fraccion = event.payload?.fraccion
    const confidence = event.payload?.confidence || 0
    const description = event.payload?.description || event.payload?.descripcion || ''
    const tmecEligible = event.payload?.tmec_eligible || false
    const traficoId = event.trigger_id
    const companyId = event.company_id

    if (!fraccion) {
      return { success: true, result: 'No fracción in payload — skipping duty calc' }
    }

    // Look up trafico to get valor (importe_total = USD value)
    const { data: trafico } = await supabase
      .from('traficos')
      .select('importe_total, company_id')
      .eq('trafico', traficoId)
      .eq('company_id', companyId)
      .maybeSingle()

    const valorUSD = trafico?.importe_total || 0

    // If no valor_aduana, create a draft awaiting manual input
    if (!valorUSD || valorUSD <= 0) {
      await supabase.from('pedimento_drafts').insert({
        trafico_id: traficoId,
        company_id: companyId,
        status: 'awaiting_valor_aduana',
        needs_manual_intervention: true,
        created_by: 'workflow-processor',
        draft_data: {
          fraccion,
          confidence,
          description,
          tmec_eligible: tmecEligible,
          note: 'Valor aduana no disponible — requiere entrada manual',
          calculated_by: 'workflow-processor',
          calculated_at: new Date().toISOString(),
        },
      })

      await emitEvent('pedimento', 'duties_calculated', traficoId, companyId, {
        fraccion,
        status: 'awaiting_valor_aduana',
        needs_manual_intervention: true,
      }, event.id)

      return { success: true, result: `Awaiting valor_aduana for ${traficoId}` }
    }

    // Get current rates from system_config
    let rates
    try {
      const allRates = await getAllRates()
      rates = {
        exchangeRate: allRates.exchangeRate,
        dtaRates: allRates.dtaRates,
        ivaRate: allRates.ivaRate,
      }
    } catch (e) {
      console.error(`[pedimento] Failed to get rates: ${e.message}`)
      return { success: false, result: `Rate lookup failed: ${e.message}` }
    }

    // Look up IGI rate from tariff_rates if not in payload
    let igiRate = event.payload?.igi_rate
    if (igiRate === undefined || igiRate === null) {
      const tariff = await lookupTariffRate(fraccion, supabase)
      igiRate = tariff?.igi_rate || 0
    }

    // Look up historical DTA for better multi-partida accuracy
    const regimen = 'A1' // Standard import
    const dtaOverride = await lookupHistoricalDTA(companyId, regimen, supabase)

    // Calculate contributions (cascading IVA — NEVER flat)
    const contributions = calculateContributions(valorUSD, regimen, igiRate, rates, {
      tmec: tmecEligible,
      dtaOverride: dtaOverride || undefined,
    })

    // Persist to pedimento_drafts
    const { error: insertErr } = await supabase.from('pedimento_drafts').insert({
      trafico_id: traficoId,
      company_id: companyId,
      status: 'duties_calculated',
      created_by: 'workflow-processor',
      needs_manual_intervention: false,
      draft_data: {
        fraccion,
        confidence,
        description,
        tmec_eligible: tmecEligible,
        regimen,
        contributions,
        valor_aduana_usd: valorUSD,
        valor_aduana_mxn: contributions.valor_aduana_mxn,
        tipo_cambio: contributions.tipo_cambio,
        igi_rate: igiRate,
        igi_amount: contributions.igi.amount_mxn,
        dta_amount: contributions.dta.amount_mxn,
        iva_base: contributions.iva.base_mxn,
        iva_amount: contributions.iva.amount_mxn,
        total_contribuciones_mxn: contributions.total_contribuciones_mxn,
        calculated_by: 'workflow-processor',
        calculated_at: new Date().toISOString(),
      },
    })

    if (insertErr) {
      console.error(`[pedimento] Draft insert failed: ${insertErr.message}`)
      return { success: false, result: `Draft insert failed: ${insertErr.message}` }
    }

    // Emit next event in the chain
    await emitEvent('pedimento', 'duties_calculated', traficoId, companyId, {
      fraccion,
      valor_aduana_usd: valorUSD,
      total_contribuciones_mxn: contributions.total_contribuciones_mxn,
      tmec_eligible: tmecEligible,
      confidence,
    }, event.id)

    if (VERBOSE) {
      console.log(`  Duties: IGI=${contributions.igi.amount_mxn} DTA=${contributions.dta.amount_mxn} IVA=${contributions.iva.amount_mxn} Total=${contributions.total_contribuciones_mxn}`)
    }

    return { success: true, result: `Duties calculated for ${traficoId}: $${contributions.total_contribuciones_mxn} MXN` }
  },
  'classify.needs_human_review': async (event) => {
    batcher.queueReview({
      trigger_id: event.trigger_id,
      company_id: event.company_id,
      description: event.payload?.descripcion || event.payload?.description || event.payload?.cve_producto || '',
      options: event.payload?.topOptions || [],
    })
    return { success: true, result: 'Review queued in batcher' }
  },

  // ── Workflow 3: Documents ──
  'docs.document_received': async (event) => {
    const traficoId = event.trigger_id || event.payload?.trafico_id
    const companyId = event.company_id
    const docType = event.payload?.docType || event.payload?.doc_type || 'unknown'
    const fileUrl = event.payload?.file_url || null

    if (!traficoId) {
      return { success: false, result: 'No trafico_id in event' }
    }

    // Record document receipt in expediente_documentos if not already there
    if (fileUrl) {
      const fileName = event.payload?.file_name || fileUrl.split('/').pop() || 'document'
      await supabase.from('expediente_documentos').upsert({
        pedimento_id: traficoId,
        doc_type: docType,
        file_name: fileName,
        file_url: fileUrl,
        company_id: companyId,
        uploaded_by: 'workflow-processor',
        uploaded_at: new Date().toISOString(),
      }, { onConflict: 'pedimento_id,doc_type' }).then(() => {}, (e) => {
        console.error(`[docs.document_received] upsert error: ${e.message}`)
      })
    }

    if (VERBOSE) console.log(`  Doc received: ${docType} for ${traficoId}`)
    // chainNext() will trigger docs.completeness_check via workflow_chains
    return { success: true, result: `Doc received: ${docType} for ${traficoId}` }
  },

  'docs.completeness_check': async (event) => {
    const traficoId = event.trigger_id || event.payload?.trafico_id
    const companyId = event.company_id

    if (!traficoId) {
      return { success: false, result: 'No trafico_id for completeness check' }
    }

    const REQUIRED_DOCS = ['factura_comercial', 'packing_list', 'pedimento_detallado', 'cove', 'acuse_cove', 'doda']

    // Query existing documents for this trafico
    const { data: docs, error: docsErr } = await supabase
      .from('expediente_documentos')
      .select('doc_type')
      .eq('pedimento_id', traficoId)
      .eq('company_id', companyId)

    if (docsErr) {
      return { success: false, result: `Docs query failed: ${docsErr.message}` }
    }

    const presentTypes = new Set((docs || []).map(d => d.doc_type).filter(Boolean))
    const missingDocs = REQUIRED_DOCS.filter(r => !presentTypes.has(r))
    const completePct = Math.round(((REQUIRED_DOCS.length - missingDocs.length) / REQUIRED_DOCS.length) * 100)

    if (missingDocs.length === 0) {
      // All docs present — emit expediente_complete
      await emitEvent('docs', 'expediente_complete', traficoId, companyId, {
        completeness_pct: 100,
        present: Array.from(presentTypes),
      }, event.id)
      return { success: true, result: `Expediente complete for ${traficoId}: 100%` }
    } else {
      // Missing docs — emit solicitation_needed
      await emitEvent('docs', 'solicitation_needed', traficoId, companyId, {
        missingTypes: missingDocs,
        completeness_pct: completePct,
        present: Array.from(presentTypes),
      }, event.id)
      return { success: true, result: `Expediente ${completePct}% for ${traficoId}: missing ${missingDocs.join(', ')}` }
    }
  },
  'docs.expediente_complete': async (event) => {
    const { validateCompleteness } = require('./lib/document-types')

    const traficoId = event.trigger_id || event.payload?.trafico_id
    const companyId = event.company_id

    if (!traficoId) {
      return { success: false, result: 'No trafico_id in trigger_id or payload' }
    }

    // Query documents for this trafico
    const { data: docs, error: docsErr } = await supabase
      .from('documents')
      .select('document_type')
      .eq('trafico_id', traficoId)
      .eq('company_id', companyId)

    if (docsErr) {
      return { success: false, result: `Documents query failed: ${docsErr.message}` }
    }

    const presentLabels = (docs || []).map(d => d.document_type).filter(Boolean)
    const validation = validateCompleteness(presentLabels)

    const docsValidation = {
      ...validation,
      validated_at: new Date().toISOString(),
    }

    // Persist to pedimento_drafts.draft_data.docs_validation
    // First check if a draft already exists for this trafico
    const { data: existingDraft } = await supabase
      .from('pedimento_drafts')
      .select('id, draft_data')
      .eq('trafico_id', traficoId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingDraft) {
      // Update existing draft with docs_validation
      const updatedDraftData = {
        ...(existingDraft.draft_data || {}),
        docs_validation: docsValidation,
      }
      await supabase
        .from('pedimento_drafts')
        .update({ draft_data: updatedDraftData, updated_at: new Date().toISOString() })
        .eq('id', existingDraft.id)
    } else {
      // Create a new draft with docs_validation only
      await supabase.from('pedimento_drafts').insert({
        trafico_id: traficoId,
        company_id: companyId,
        status: 'docs_validated',
        created_by: 'workflow-processor',
        needs_manual_intervention: validation.blocked,
        draft_data: { docs_validation: docsValidation },
      })
    }

    // Emit next event based on validation result
    if (validation.blocked) {
      await emitEvent('docs', 'blocked', traficoId, companyId, {
        missing_critical: validation.missing_critical,
        missing_required: validation.missing_required,
        completeness_pct: validation.completeness_pct,
      }, event.id)

      if (VERBOSE) {
        console.log(`  Docs blocked: missing critical = ${validation.missing_critical.join(', ')}`)
      }
    } else {
      await emitEvent('docs', 'ready_for_pedimento', traficoId, companyId, {
        completeness_pct: validation.completeness_pct,
        present: validation.present,
        missing_optional: validation.missing_optional,
      }, event.id)
    }

    await tg(
      `${validation.blocked ? '🔴' : '📋'} <b>Docs validation: ${validation.blocked ? 'BLOCKED' : 'READY'}</b>\n` +
      `Tráfico: ${traficoId}\n` +
      `Completeness: ${validation.completeness_pct}% (${validation.present.length}/${validation.total_types})\n` +
      (validation.blocked ? `Missing critical: ${validation.missing_critical.join(', ')}\n` : '') +
      `— CRUZ Workflow`
    )

    return {
      success: true,
      result: validation.blocked
        ? `Docs blocked for ${traficoId}: missing ${validation.missing_critical.join(', ')}`
        : `Docs ready for ${traficoId}: ${validation.completeness_pct}% complete`,
    }
  },
  'docs.solicitation_needed': async (event) => {
    const traficoId = event.trigger_id || event.payload?.trafico_id
    const companyId = event.company_id
    const missingDocs = event.payload?.missingTypes || []

    if (!traficoId || missingDocs.length === 0) {
      return { success: true, result: 'No missing docs to solicit' }
    }

    // Create documento_solicitudes rows for each missing doc
    const solicitations = missingDocs.map(docType => ({
      trafico_id: traficoId,
      company_id: companyId,
      doc_type: docType,
      status: 'solicitado',
      created_at: new Date().toISOString(),
    }))

    await supabase.from('documento_solicitudes').upsert(solicitations, {
      onConflict: 'trafico_id,doc_type',
    }).then(() => {}, (e) => {
      console.error(`[docs.solicitation_needed] upsert error: ${e.message}`)
    })

    // Telegram alert for missing docs
    await tg(
      `📋 <b>Documentos faltantes</b>\n` +
      `Tráfico: ${traficoId}\n` +
      `Empresa: ${companyId}\n` +
      `Faltan: ${missingDocs.map(d => d.replace(/_/g, ' ')).join(', ')}\n` +
      `Completeness: ${event.payload?.completeness_pct || 0}%\n` +
      `— CRUZ Workflow`
    )

    // Emit solicitation_sent for audit trail
    await emitEvent('docs', 'solicitation_sent', traficoId, companyId, {
      solicited_docs: missingDocs,
      solicited_at: new Date().toISOString(),
    }, event.id)

    return { success: true, result: `Solicitation created for ${missingDocs.length} docs: ${missingDocs.join(', ')}` }
  },

  'docs.solicitation_sent': async (event) => {
    // Audit trail — solicitation was sent, log and continue
    const traficoId = event.trigger_id || event.payload?.trafico_id
    if (VERBOSE) console.log(`  Solicitation sent for ${traficoId}: ${(event.payload?.solicited_docs || []).join(', ')}`)
    return { success: true, result: `Solicitation audit logged for ${traficoId}` }
  },

  // ── Workflow 4: Pedimento ──
  'pedimento.expediente_complete': async (event) => {
    const traficoId = event.trigger_id || event.payload?.trafico_id
    const companyId = event.company_id

    if (!traficoId) {
      return { success: false, result: 'No trafico_id for pedimento.expediente_complete' }
    }

    // Chain to duties calculation — the classify.classification_complete handler
    // already calculates duties and upserts pedimento_drafts, so we just need to
    // verify a draft exists and emit ready_for_approval
    const { data: draft } = await supabase
      .from('pedimento_drafts')
      .select('id, draft_data, status')
      .eq('trafico_id', traficoId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (draft && draft.draft_data?.duties) {
      // Draft with duties exists — emit ready_for_approval
      await emitEvent('pedimento', 'ready_for_approval', traficoId, companyId, {
        score: draft.draft_data.score || 0,
        duties: draft.draft_data.duties,
      }, event.id)
      return { success: true, result: `Pedimento draft ready for ${traficoId}, score ${draft.draft_data.score || 0}` }
    }

    // No draft with duties yet — emit duties_calculated to trigger calculation
    await emitEvent('pedimento', 'duties_calculated', traficoId, companyId, {
      trafico_id: traficoId,
    }, event.id)
    return { success: true, result: `Duties calculation triggered for ${traficoId}` }
  },

  'pedimento.duties_calculated': async (event) => {
    const traficoId = event.trigger_id || event.payload?.trafico_id
    const companyId = event.company_id

    if (!traficoId) {
      return { success: true, result: 'No trafico_id — skipping' }
    }

    // Check if pedimento_drafts has a complete draft
    const { data: draft } = await supabase
      .from('pedimento_drafts')
      .select('id, draft_data, status')
      .eq('trafico_id', traficoId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!draft) {
      if (VERBOSE) console.log(`  No draft found for ${traficoId} — waiting for classification`)
      return { success: true, result: `No draft yet for ${traficoId} — will be created by classification` }
    }

    const duties = draft.draft_data?.duties || draft.draft_data?.contributions
    if (!duties) {
      if (VERBOSE) console.log(`  Draft exists but no duties calculated for ${traficoId}`)
      return { success: true, result: `Draft incomplete for ${traficoId} — awaiting classification` }
    }

    // Draft with duties exists — emit ready_for_approval
    await emitEvent('pedimento', 'ready_for_approval', traficoId, companyId, {
      score: draft.draft_data.score || 0,
      duties,
    }, event.id)

    return { success: true, result: `Duties verified for ${traficoId}: ready for approval` }
  },
  'pedimento.ready_for_approval': async (event) => {
    const score = event.payload?.score || 0
    await tg(
      `✅ <b>Pedimento listo para aprobación</b>\n` +
      `Tráfico: ${event.trigger_id}\n` +
      `Score: ${score}/100\n` +
      `Responde /aprobar para transmitir\n` +
      `— CRUZ Workflow`
    )
    return { success: true, result: `Approval requested, score: ${score}` }
  },
  'pedimento.approved': async (event) => {
    const traficoId = event.trigger_id || event.payload?.trafico_id
    const companyId = event.company_id

    // Update draft status to approved
    if (traficoId) {
      await supabase
        .from('pedimento_drafts')
        .update({ status: 'approved', reviewed_by: 'tito', updated_at: new Date().toISOString() })
        .eq('trafico_id', traficoId)
        .eq('company_id', companyId)
        .eq('status', 'draft')
        .then(() => {}, (e) => console.error(`[pedimento.approved] update error: ${e.message}`))

      await tg(
        `✅ <b>Pedimento aprobado por Tito</b>\n` +
        `Tráfico: ${traficoId}\n` +
        `Empresa: ${companyId}\n` +
        `→ Procediendo a cruce\n` +
        `— CRUZ Workflow`
      )
    }

    // chainNext() will emit crossing.pedimento_paid via workflow_chains
    return { success: true, result: `Pedimento approved for ${traficoId}` }
  },

  // ── Workflow 5: Crossing ──
  'crossing.pedimento_paid': async (event) => {
    const traficoId = event.trigger_id || event.payload?.trafico_id
    const companyId = event.company_id

    if (!traficoId) {
      return { success: true, result: 'No trafico_id for crossing' }
    }

    // Query latest bridge times for crossing recommendation
    const { data: bridges } = await supabase
      .from('bridge_intelligence')
      .select('bridge_name, wait_time_minutes, updated_at')
      .order('updated_at', { ascending: false })
      .limit(10)

    const bestBridge = (bridges || []).reduce((best, b) => {
      if (!best || (b.wait_time_minutes || 999) < (best.wait_time_minutes || 999)) return b
      return best
    }, null)

    const bridgeName = bestBridge?.bridge_name || 'World Trade'
    const waitMin = bestBridge?.wait_time_minutes || null

    // Emit dispatch_ready with bridge recommendation
    await emitEvent('crossing', 'dispatch_ready', traficoId, companyId, {
      recommended_bridge: bridgeName,
      wait_minutes: waitMin,
      carrier: event.payload?.carrier || 'Por asignar',
    }, event.id)

    return { success: true, result: `Crossing scheduled for ${traficoId} via ${bridgeName} (${waitMin ? waitMin + ' min wait' : 'unknown wait'})` }
  },
  'crossing.dispatch_ready': async (event) => {
    const carrier = event.payload?.carrier || 'TBD'
    const bridge = event.payload?.bridge || 'World Trade'
    await tg(
      `🌉 <b>Despacho listo</b>\n` +
      `Tráfico: ${event.trigger_id}\n` +
      `Transportista: ${carrier}\n` +
      `Puente: ${bridge}\n` +
      `— CRUZ Workflow`
    )
    return { success: true, result: `Dispatch: ${carrier} via ${bridge}` }
  },
  'crossing.crossing_complete': async (event) => {
    const traficoId = event.trigger_id || event.payload?.trafico_id
    const companyId = event.company_id

    if (!traficoId) {
      return { success: true, result: 'No trafico_id for crossing complete' }
    }

    // Update traficos status to Cruzado
    const now = new Date().toISOString()
    await supabase
      .from('traficos')
      .update({ estatus: 'Cruzado', fecha_cruce: now, updated_at: now })
      .eq('trafico', traficoId)
      .eq('company_id', companyId)
      .then(() => {}, (e) => console.error(`[crossing.crossing_complete] update error: ${e.message}`))

    await tg(
      `🌉 <b>Cruce completado</b>\n` +
      `Tráfico: ${traficoId}\n` +
      `Empresa: ${companyId}\n` +
      `Estatus: Cruzado ✅\n` +
      `— CRUZ Workflow`
    )

    // chainNext() will emit post_op.crossing_complete via workflow_chains
    return { success: true, result: `Crossing complete for ${traficoId} — marked Cruzado` }
  },

  // ── Workflow 6: Post-Op ──
  'post_op.crossing_complete': async (event) => {
    const traficoId = event.trigger_id || event.payload?.trafico_id
    const companyId = event.company_id

    if (!traficoId) {
      return { success: true, result: 'No trafico_id for post-op' }
    }

    // Calculate operation score
    const { data: trafico } = await supabase
      .from('traficos')
      .select('fecha_llegada, fecha_cruce, pedimento, importe_total')
      .eq('trafico', traficoId)
      .eq('company_id', companyId)
      .maybeSingle()

    let score = 50 // base score
    let transitDays = null

    if (trafico?.fecha_llegada && trafico?.fecha_cruce) {
      transitDays = Math.round((new Date(trafico.fecha_cruce).getTime() - new Date(trafico.fecha_llegada).getTime()) / 86400000)
      // Speed bonus: under 7 days = +20, under 14 = +10
      if (transitDays <= 7) score += 20
      else if (transitDays <= 14) score += 10
    }
    // Pedimento assigned = +15
    if (trafico?.pedimento) score += 15
    // Has value = +10
    if (Number(trafico?.importe_total) > 0) score += 10

    // Check doc completeness
    const { count: docCount } = await supabase
      .from('expediente_documentos')
      .select('id', { count: 'exact', head: true })
      .eq('pedimento_id', traficoId)
      .eq('company_id', companyId)

    // Docs present = +5 per doc, max 25
    score += Math.min((docCount || 0) * 5, 25)
    score = Math.min(score, 100)

    // Emit operation_scored
    await emitEvent('post_op', 'operation_scored', traficoId, companyId, {
      score,
      transit_days: transitDays,
      doc_count: docCount || 0,
    }, event.id)

    return { success: true, result: `Post-op scored ${traficoId}: ${score}/100 (${transitDays ?? '?'} days transit)` }
  },
  'post_op.operation_scored': async (event) => {
    const score = event.payload?.score || 0
    return { success: true, result: `Operation scored: ${score}/100` }
  },

  // ── Workflow 7: Invoice ──
  'invoice.operation_accumulated': async (event) => {
    const traficoId = event.trigger_id || event.payload?.trafico_id
    const companyId = event.company_id
    const score = event.payload?.score || 0

    // Log the accumulation — actual billing is a future feature
    if (VERBOSE) console.log(`  Invoice accumulated: ${traficoId} (score ${score})`)

    // Log to operational_decisions for Operational Brain
    await logDecision({
      trafico: traficoId,
      company_id: companyId,
      decision_type: 'invoice',
      decision: 'operation_accumulated',
      reasoning: `Tráfico ${traficoId} completed pipeline with score ${score}/100. Cost accumulated for monthly invoice.`,
    }).catch(() => {})

    return { success: true, result: `Operation accumulated for ${traficoId} (score ${score}/100) — end of pipeline` }
  },
  'invoice.invoice_ready': async (event) => {
    await tg(
      `💰 <b>Factura lista</b>\n` +
      `${event.trigger_id}\n` +
      `Empresa: ${event.company_id}\n` +
      `Requiere aprobación de Tito\n` +
      `— CRUZ Workflow`
    )
    return { success: true, result: 'Invoice ready for approval' }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSOR — poll, dispatch, chain
// ═══════════════════════════════════════════════════════════════════════════

async function processEvent(event) {
  const handlerKey = `${event.workflow}.${event.event_type}`
  const handler = HANDLERS[handlerKey]

  if (!handler) {
    console.warn(`  ⚠️ No handler for ${handlerKey} — marking completed (passthrough)`)
    await updateEventStatus(event.id, 'completed', {})
    // Still chain — some events are just routing markers
    await chainNext(event)
    return
  }

  // Mark processing
  await updateEventStatus(event.id, 'processing', {
    attempt_count: (event.attempt_count || 0) + 1,
  })

  try {
    if (DRY_RUN) {
      console.log(`  [DRY] Would process: ${handlerKey} for ${event.trigger_id}`)
      await updateEventStatus(event.id, 'completed')
      return
    }

    const result = await handler(event)

    if (result.success) {
      await updateEventStatus(event.id, 'completed')
      if (VERBOSE) console.log(`  ✅ ${handlerKey}: ${result.result}`)

      // Log decision for operational brain
      await logDecision({
        trafico: event.trigger_id,
        company_id: event.company_id,
        decision_type: event.workflow,
        decision: `${event.event_type}_processed`,
        reasoning: result.result,
      }).catch(() => {})

      // Chain to next workflow(s)
      const chained = await chainNext(event)
      if (chained.length > 0 && VERBOSE) {
        console.log(`  🔗 Chained ${chained.length} event(s): ${chained.map(c => `${c.workflow}.${c.event_type}`).join(', ')}`)
      }
    } else {
      throw new Error(result.result || 'Handler returned failure')
    }
  } catch (err) {
    const attempts = (event.attempt_count || 0) + 1
    console.error(`  ❌ ${handlerKey} failed (attempt ${attempts}): ${err.message}`)

    if (attempts >= MAX_RETRIES) {
      // Dead letter — alert and stop retrying
      await updateEventStatus(event.id, 'dead_letter', {
        error_message: err.message,
        attempt_count: attempts,
      })
      await tg(
        `🔴 <b>Workflow Dead Letter</b>\n` +
        `Event: ${handlerKey}\n` +
        `Tráfico: ${event.trigger_id || 'N/A'}\n` +
        `Error: ${err.message}\n` +
        `Intentos: ${attempts}/${MAX_RETRIES}\n` +
        `— CRUZ Workflow`
      )
    } else {
      // Reset to pending for retry
      await updateEventStatus(event.id, 'pending', {
        error_message: err.message,
        attempt_count: attempts,
      })
    }
  }
}

async function pollCycle() {
  const cycleId = crypto.randomBytes(4).toString('hex')
  const cycleStart = Date.now()

  // Check if processor is paused
  const { data: config } = await supabase.from('system_config')
    .select('value')
    .eq('key', 'workflow_processor_status')
    .single()

  if (config?.value?.paused) {
    if (VERBOSE) console.log('  ⏸️ Processor paused via system_config')
    return 0
  }

  const events = await fetchPendingEvents(20)

  if (events.length === 0) {
    if (VERBOSE) console.log(`  [${cycleId}] No pending events`)
    writeHeartbeat('idle', { cycle_id: cycleId })
    return 0
  }

  console.log(`\n⚡ Cycle ${cycleId}: ${events.length} pending event(s)`)

  for (const event of events) {
    await processEvent(event)
  }

  const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1)
  console.log(`  Cycle ${cycleId}: ${events.length} processed in ${elapsed}s`)

  writeHeartbeat('active', {
    cycle_id: cycleId,
    events_processed: events.length,
    elapsed_s: parseFloat(elapsed),
  })

  // Log to pipeline_log
  if (!DRY_RUN) {
    await supabase.from('pipeline_log').insert({
      step: `${SCRIPT_NAME}:cycle`,
      status: 'success',
      input_summary: JSON.stringify({
        cycle_id: cycleId,
        events_processed: events.length,
        elapsed_s: parseFloat(elapsed),
      }),
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {})
  }

  return events.length
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''
  console.log(`\n⚡ ${prefix}CRUZ 2.0 Workflow Processor`)
  console.log('═'.repeat(55))
  console.log(`  Mode: ${ONCE ? 'single cycle' : `polling every ${POLL_INTERVAL_MS / 1000}s`}`)
  console.log(`  Handlers registered: ${Object.keys(HANDLERS).length}`)
  console.log(`  Max retries: ${MAX_RETRIES}`)
  console.log()

  if (ONCE) {
    await pollCycle()
    return
  }

  // Daemon mode — poll continuously
  writeHeartbeat('starting')

  const poll = async () => {
    try {
      await pollCycle()
    } catch (err) {
      console.error(`Poll error: ${err.message}`)
      await tg(`🔴 <b>Workflow Processor Error</b>: ${err.message}`)
      writeHeartbeat('error', { error: err.message })
    }
    setTimeout(poll, POLL_INTERVAL_MS)
  }

  await poll()
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>WORKFLOW PROCESSOR FATAL</b>: ${err.message}\n— CRUZ 🤖`)
  writeHeartbeat('fatal', { error: err.message })
  process.exit(1)
})
