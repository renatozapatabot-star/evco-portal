// scripts/lib/crossing-handlers.js
// Real handler for crossing.dispatch_ready events.
// Idempotent: checks carrier_dispatches before inserting.
// Replicates cruz-crossing.js dispatch logic (that script exports nothing).

const { emitEvent, supabase } = require('./workflow-emitter')
const { logDecision } = require('../decision-logger')

// ── Handler 3: crossing.dispatch_ready ──────────────────────────────────────

async function handleDispatchReady(event) {
  const { trigger_id, company_id, payload, id: eventId } = event

  // 1. Validate required fields
  if (!company_id) {
    return { success: false, result: 'Missing company_id — cannot dispatch without tenant scope' }
  }

  if (!payload) {
    return { success: false, result: 'Empty payload — cannot process dispatch' }
  }

  const traficoId = payload.trafico_id || trigger_id
  const cveCliente = payload.cve_cliente || null
  const pedimentoNumber = payload.pedimento_number || null
  const destination = payload.destination || null
  const scheduledCrossingTime = payload.scheduled_crossing_time || null

  // 2. Look up tráfico and confirm crossing-ready status
  const { data: trafico } = await supabase
    .from('traficos')
    .select('trafico, company_id, estatus, pedimento, transportista_mexicano')
    .eq('company_id', company_id)
    .eq('trafico', traficoId)
    .maybeSingle()

  if (!trafico) {
    return { success: false, result: `Tráfico ${traficoId} not found for company ${company_id}` }
  }

  const status = (trafico.estatus || '').toLowerCase()
  const isCrossingReady = status.includes('pagado') || status.includes('listo_para_cruce')

  if (!isCrossingReady) {
    return {
      success: false,
      result: `Tráfico ${traficoId} status is '${trafico.estatus}' — not ready for crossing dispatch`,
    }
  }

  // 3. Idempotency — check for existing dispatch
  const { data: existingDispatch } = await supabase
    .from('carrier_dispatches')
    .select('id, carrier_name, status')
    .eq('trafico_id', traficoId)
    .in('status', ['dispatched', 'confirmed'])
    .limit(1)

  if (existingDispatch && existingDispatch.length > 0) {
    const existing = existingDispatch[0]

    await logDecision({
      trafico: traficoId,
      company_id,
      decision_type: 'crossing_choice',
      decision: 'dispatch_already_exists',
      reasoning: `Carrier ${existing.carrier_name} already ${existing.status} for ${traficoId}`,
      dataPoints: { trafico_id: traficoId, existing_carrier: existing.carrier_name, existing_status: existing.status },
    })

    return {
      success: true,
      result: `Dispatch already exists for ${traficoId}: ${existing.carrier_name} (${existing.status})`,
      emitted_events: [],
    }
  }

  // 4. Query carriers for this company
  const { data: carriers } = await supabase
    .from('carrier_scoreboard')
    .select('carrier_name, carrier_phone, reputation_score')
    .eq('company_id', company_id)
    .order('reputation_score', { ascending: false })
    .limit(3)

  const emittedEvents = []

  // 5. If no carriers configured, emit needs_assignment and return cleanly
  if (!carriers || carriers.length === 0) {
    const emitResult = await emitEvent('crossing', 'dispatch_needs_assignment', traficoId, company_id, {
      reason: `No carriers configured for company ${company_id}`,
      trafico_id: traficoId,
      pedimento: pedimentoNumber || trafico.pedimento,
    }, eventId)
    if (emitResult.data) emittedEvents.push('crossing.dispatch_needs_assignment')

    await logDecision({
      trafico: traficoId,
      company_id,
      decision_type: 'crossing_choice',
      decision: 'dispatch_needs_carrier_assignment',
      reasoning: `No carriers in carrier_scoreboard for ${company_id} | Routed to manual assignment`,
      dataPoints: { trafico_id: traficoId, company_id },
    })

    return {
      success: true,
      result: `No carriers for ${company_id} — routed to manual assignment`,
      emitted_events: emittedEvents,
    }
  }

  // 6. Get best bridge from bridge_intelligence
  const { data: bridges } = await supabase
    .from('bridge_intelligence')
    .select('bridge_name, commercial_wait_minutes, status, lanes_open, fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(4)

  const bestBridge = (bridges && bridges.length > 0)
    ? bridges.reduce((a, b) => (a.commercial_wait_minutes || 999) < (b.commercial_wait_minutes || 999) ? a : b)
    : { bridge_name: 'World Trade Bridge', commercial_wait_minutes: null }

  // 7. Pick top carrier and build dispatch message
  const carrier = carriers[0]
  const waitStr = bestBridge.commercial_wait_minutes
    ? `${bestBridge.commercial_wait_minutes} min espera`
    : 'sin datos de espera'

  const dispatchMessage = `Tráfico ${traficoId} listo para cruce en ${bestBridge.bridge_name} (${waitStr}). Pedimento: ${pedimentoNumber || trafico.pedimento || 'pendiente'}.`

  // 8. Insert carrier dispatch record
  const { error: dispatchErr } = await supabase.from('carrier_dispatches').insert({
    trafico_id: traficoId,
    carrier_name: carrier.carrier_name,
    carrier_phone: carrier.carrier_phone || null,
    company_id,
    status: 'dispatched',
    message_sent: dispatchMessage,
  })

  if (dispatchErr) {
    if (dispatchErr.code !== '23505' && !dispatchErr.message?.includes('duplicate')) {
      return { success: false, result: `carrier_dispatches insert failed: ${dispatchErr.message}` }
    }
  }

  // 9. Emit crossing.dispatch_sent
  const emitResult = await emitEvent('crossing', 'dispatch_sent', traficoId, company_id, {
    carrier: carrier.carrier_name,
    carrier_phone: carrier.carrier_phone,
    bridge: bestBridge.bridge_name,
    wait_minutes: bestBridge.commercial_wait_minutes,
    dispatched_at: new Date().toISOString(),
  }, eventId)
  if (emitResult.data) emittedEvents.push('crossing.dispatch_sent')

  // 10. Log decision with alternatives
  await logDecision({
    trafico: traficoId,
    company_id,
    decision_type: 'crossing_choice',
    decision: 'carrier_dispatched',
    reasoning: [
      `Tráfico: ${traficoId}`,
      `Carrier: ${carrier.carrier_name} (score: ${carrier.reputation_score})`,
      `Bridge: ${bestBridge.bridge_name} (${waitStr})`,
      `Pedimento: ${pedimentoNumber || trafico.pedimento || 'N/A'}`,
      `Alternatives: ${carriers.length - 1}`,
    ].join(' | '),
    alternatives: carriers.slice(1).map(c => ({
      option: c.carrier_name,
      score: c.reputation_score,
      reason_rejected: 'Lower reputation score',
    })),
    dataPoints: {
      trafico_id: traficoId,
      carrier: carrier.carrier_name,
      carrier_phone: carrier.carrier_phone,
      reputation_score: carrier.reputation_score,
      bridge: bestBridge.bridge_name,
      wait_minutes: bestBridge.commercial_wait_minutes,
      all_carriers: carriers.map(c => ({ name: c.carrier_name, score: c.reputation_score })),
      emitted_events: emittedEvents,
    },
  })

  const summary = [
    `Dispatched ${carrier.carrier_name} for ${traficoId}`,
    `via ${bestBridge.bridge_name} (${waitStr})`,
    `${emittedEvents.length} events emitted`,
  ].join(', ')

  return { success: true, result: summary, emitted_events: emittedEvents }
}

module.exports = { handleDispatchReady }
