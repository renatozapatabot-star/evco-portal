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

const { fetchPendingEvents, updateEventStatus, chainNext, supabase } = require('./lib/workflow-emitter')
const { logDecision } = require('./decision-logger')

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
    // Phase 2: require('./auto-classifier') and run for specific products
    const products = event.payload?.products || []
    if (VERBOSE) console.log(`  Classify: ${products.length} products for ${event.trigger_id}`)
    return { success: true, result: `Classification queued for ${products.length} products` }
  },
  'classify.classification_complete': async (event) => {
    return { success: true, result: `Classified: ${event.payload?.fraccion || 'pending'}` }
  },
  'classify.needs_human_review': async (event) => {
    // Telegram to Juan José with top options
    const options = event.payload?.topOptions || []
    const optStr = options.map((o, i) => `${i + 1}. ${o.fraccion} (${o.confidence}%)`).join('\n')
    await tg(
      `🔍 <b>Clasificación requiere revisión</b>\n` +
      `Tráfico: ${event.trigger_id}\n` +
      `Opciones:\n${optStr || '(sin sugerencias)'}\n` +
      `— CRUZ Workflow`
    )
    return { success: true, result: 'Human review requested via Telegram' }
  },

  // ── Workflow 3: Documents ──
  'docs.document_received': async (event) => {
    // Phase 2: require('./completeness-checker') for this tráfico
    return { success: true, result: `Doc received: ${event.payload?.docType || 'unknown'}` }
  },
  'docs.completeness_check': async (event) => {
    // Phase 2: run completeness check, emit expediente_complete or solicitation_needed
    return { success: true, result: 'Completeness check queued' }
  },
  'docs.expediente_complete': async (event) => {
    await tg(
      `📋 <b>Expediente completo</b>\n` +
      `Tráfico: ${event.trigger_id}\n` +
      `Empresa: ${event.company_id}\n` +
      `→ Zero-touch pipeline activado\n` +
      `— CRUZ Workflow`
    )
    return { success: true, result: `Expediente complete for ${event.trigger_id}` }
  },
  'docs.solicitation_needed': async (event) => {
    // Phase 2: require('./solicit-missing-docs') for specific docs
    const missing = event.payload?.missingTypes || []
    if (VERBOSE) console.log(`  Missing docs: ${missing.join(', ')}`)
    return { success: true, result: `Solicitation needed: ${missing.join(', ')}` }
  },
  'docs.solicitation_sent': async (event) => {
    return { success: true, result: 'Solicitation sent' }
  },

  // ── Workflow 4: Pedimento ──
  'pedimento.expediente_complete': async (event) => {
    // Phase 2: require('./zero-touch-pipeline') for this tráfico
    return { success: true, result: `Zero-touch evaluation for ${event.trigger_id}` }
  },
  'pedimento.duties_calculated': async (event) => {
    return { success: true, result: 'Duties calculated' }
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
    return { success: true, result: 'Pedimento approved by Tito' }
  },

  // ── Workflow 5: Crossing ──
  'crossing.pedimento_paid': async (event) => {
    // Phase 3: require('./crossing-prediction') for this tráfico
    return { success: true, result: 'Crossing optimization started' }
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
    return { success: true, result: 'Crossing complete' }
  },

  // ── Workflow 6: Post-Op ──
  'post_op.crossing_complete': async (event) => {
    // Phase 3: require('./post-operation-analysis') for this tráfico
    return { success: true, result: 'Post-op analysis started' }
  },
  'post_op.operation_scored': async (event) => {
    const score = event.payload?.score || 0
    return { success: true, result: `Operation scored: ${score}/100` }
  },

  // ── Workflow 7: Invoice ──
  'invoice.operation_accumulated': async (event) => {
    return { success: true, result: 'Operation accumulated for billing' }
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
