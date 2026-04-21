// scripts/lib/pedimento-handlers.js
// Real handler for pedimento.ready_for_approval events.
// Enriches the draft with approval metadata (confidence, flags, line count)
// and sets status='ready_for_approval' so the admin portal picks it up.
// Idempotent: skips if already queued or approved.

const { supabase } = require('./workflow-emitter')
const { logDecision } = require('../decision-logger')

async function handleReadyForApproval(event) {
  const { trigger_id, company_id, payload, id: eventId } = event

  // 1. Validate required fields
  if (!company_id) {
    return { success: false, result: 'Missing company_id — cannot queue for approval' }
  }

  const traficoId = payload?.trafico_id || trigger_id
  if (!traficoId) {
    return { success: false, result: 'Missing trafico_id — cannot queue for approval' }
  }

  // 2. Find the most recent draft for this tráfico
  const { data: draft, error: draftErr } = await supabase
    .from('pedimento_drafts')
    .select('id, draft_data, status, company_id')
    .eq('trafico_id', traficoId)
    .eq('company_id', company_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (draftErr) {
    return { success: false, result: `Draft query failed: ${draftErr.message}` }
  }

  if (!draft) {
    return { success: false, result: `No draft found for ${traficoId} in ${company_id}` }
  }

  // 3. Idempotency: skip if already queued or approved
  if (draft.status === 'ready_for_approval' || draft.status === 'approved') {
    await logDecision({
      trafico: traficoId,
      company_id,
      decision_type: 'approval',
      decision: 'pedimento_already_queued',
      reasoning: `Draft ${traficoId} already ${draft.status} — skipped`,
      dataPoints: { trafico_id: traficoId, current_status: draft.status },
    })
    return { success: true, result: `Draft ${traficoId} already ${draft.status} — skipped` }
  }

  // 4. Validate completeness: duties/contributions must exist
  const duties = draft.draft_data?.duties || draft.draft_data?.contributions
  if (!duties) {
    return {
      success: false,
      result: `Draft ${traficoId} missing duties/contributions — cannot queue for approval`,
    }
  }

  // 5. Compute average confidence from line items
  const products = draft.draft_data?.products || draft.draft_data?.classifications || []
  const confidences = products
    .map(p => typeof p.confidence === 'number' ? p.confidence : 0)
    .filter(c => c > 0)
  const avgConfidence = confidences.length > 0
    ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
    : 0

  // 6. Gather compliance flags
  const flags = [...(draft.draft_data?.flags || [])]
  const missingDocs = draft.draft_data?.missing_docs || []
  if (missingDocs.length > 0) {
    flags.push(`${missingDocs.length} documento(s) faltante(s)`)
  }

  // 7. Enrich draft_data with approval metadata
  const enrichedData = {
    ...draft.draft_data,
    approval_metadata: {
      confidence_avg: avgConfidence,
      confidence_tier: avgConfidence >= 95 ? 'alta' : avgConfidence >= 80 ? 'media' : 'baja',
      compliance_flags: flags,
      line_item_count: products.length,
      score: payload?.score || draft.draft_data?.score || 0,
      queued_at: new Date().toISOString(),
    },
  }

  // 8. Update draft status
  const { error: updateErr } = await supabase
    .from('pedimento_drafts')
    .update({
      status: 'ready_for_approval',
      draft_data: enrichedData,
    })
    .eq('id', draft.id)

  if (updateErr) {
    return { success: false, result: `Draft update failed: ${updateErr.message}` }
  }

  // 9. Log decision
  await logDecision({
    trafico: traficoId,
    company_id,
    decision_type: 'approval',
    decision: 'pedimento_queued_for_approval',
    reasoning: [
      `Tráfico: ${traficoId}`,
      `Confidence: ${avgConfidence}%`,
      `Tier: ${avgConfidence >= 95 ? 'alta' : avgConfidence >= 80 ? 'media' : 'baja'}`,
      `Flags: ${flags.length}`,
      `Products: ${products.length}`,
    ].join(' | '),
    dataPoints: {
      trafico_id: traficoId,
      draft_id: draft.id,
      confidence_avg: avgConfidence,
      flags,
      product_count: products.length,
      duties_present: true,
    },
  })

  const summary = [
    `Pedimento ${traficoId} queued for approval`,
    `confidence: ${avgConfidence}%`,
    `${products.length} products`,
    `${flags.length} flags`,
  ].join(', ')

  return { success: true, result: summary, emitted_events: [] }
}

module.exports = { handleReadyForApproval }
