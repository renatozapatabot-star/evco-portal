// scripts/lib/intake-handlers.js
// Real handler for intake.email_processed events.
// Idempotent: checks for existing downstream events before emitting.

const { emitEvent, supabase } = require('./workflow-emitter')
const { logDecision } = require('../decision-logger')

async function handleEmailProcessed(event) {
  const { trigger_id, company_id, payload, id: eventId } = event

  // 1. Validate required payload fields
  if (!company_id) {
    await emitEvent('classify', 'needs_human_review', trigger_id, 'unknown', {
      reason: 'Missing company_id in intake event',
      raw_payload: payload,
    }, eventId)
    return { success: true, result: 'Missing company_id — routed to human review' }
  }

  if (!payload) {
    return { success: false, result: 'Empty payload — cannot process' }
  }

  const products = payload.products || []
  const supplier = payload.supplier || null
  const invoiceNumber = payload.invoice_number || null
  const value = payload.value || null
  const currency = payload.currency || null
  const confidenceTier = payload.confidence_tier || 'insufficient'

  // 2. Find associated tráfico (created by email-intake.js autoCreateTrafico)
  //    trigger_id is the draft ID; tráficos link back via created_by/reference
  let traficoRecord = null
  const { data: trafico } = await supabase
    .from('traficos')
    .select('trafico, company_id, proveedor, cve_proveedor, estatus')
    .eq('company_id', company_id)
    .eq('created_by', 'CRUZ')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fallback: search by supplier name + recent timestamp
  if (!trafico && supplier) {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: recentTrafico } = await supabase
      .from('traficos')
      .select('trafico, company_id, proveedor, cve_proveedor, estatus')
      .eq('company_id', company_id)
      .ilike('proveedor', `%${supplier}%`)
      .gte('created_at', fiveMinAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    traficoRecord = recentTrafico
  } else {
    traficoRecord = trafico
  }

  // 3. Try to find matching entrada (from GlobalPC sync) by tráfico link
  let entradaRecord = null
  if (traficoRecord) {
    const { data: entrada } = await supabase
      .from('entradas')
      .select('id, cve_entrada, trafico')
      .eq('company_id', company_id)
      .eq('trafico', traficoRecord.trafico)
      .maybeSingle()
    entradaRecord = entrada
  }

  // 4. Idempotent downstream event emission
  //    Check if email-intake.js already emitted classify/docs events for this trigger_id
  const emittedEvents = []

  // 4a. Check for existing classify events
  const { data: existingClassify } = await supabase
    .from('workflow_events')
    .select('id')
    .eq('trigger_id', trigger_id)
    .eq('workflow', 'classify')
    .eq('event_type', 'product_needs_classification')
    .limit(1)

  if ((!existingClassify || existingClassify.length === 0) && products.length > 0) {
    // Only emit for products needing classification (no fraccion)
    const needsClassification = products.filter(p => !p.fraccion)
    if (needsClassification.length > 0) {
      const result = await emitEvent('classify', 'product_needs_classification', trigger_id, company_id, {
        products: needsClassification.map(p => ({
          description: p.description,
          cve_proveedor: traficoRecord?.cve_proveedor || null,
        })),
      }, eventId)
      if (result.data) emittedEvents.push('classify.product_needs_classification')
    }
  } else if (existingClassify?.length > 0) {
    emittedEvents.push('classify.product_needs_classification (already existed)')
  }

  // 4b. Check for existing docs events — we don't have attachment filenames
  //     in the payload, so we can't emit new ones. Just note if they exist.
  const { data: existingDocs } = await supabase
    .from('workflow_events')
    .select('id')
    .eq('trigger_id', trigger_id)
    .eq('workflow', 'docs')
    .eq('event_type', 'document_received')
    .limit(1)

  if (existingDocs?.length > 0) {
    emittedEvents.push(`docs.document_received (already existed)`)
  }

  // 5. Log detailed decision to operational_decisions
  await logDecision({
    trafico: traficoRecord?.trafico || trigger_id,
    company_id,
    decision_type: 'intake',
    decision: 'email_intake_processed',
    reasoning: [
      `Supplier: ${supplier || 'unknown'}`,
      `Invoice: ${invoiceNumber || 'none'}`,
      `Value: ${value ? `${value} ${currency}` : 'unknown'}`,
      `Confidence: ${confidenceTier}`,
      `Products: ${products.length}`,
      `Tráfico linked: ${traficoRecord?.trafico || 'none'}`,
      `Entrada found: ${entradaRecord?.cve_entrada || 'none'}`,
      `Events emitted: ${emittedEvents.length}`,
    ].join(' | '),
    dataPoints: {
      trigger_id,
      supplier,
      invoice_number: invoiceNumber,
      value,
      currency,
      confidence_tier: confidenceTier,
      product_count: products.length,
      trafico: traficoRecord?.trafico || null,
      entrada: entradaRecord?.cve_entrada || null,
      emitted_events: emittedEvents,
    },
  })

  const summary = [
    `Intake processed: ${trigger_id}`,
    traficoRecord ? `tráfico=${traficoRecord.trafico}` : 'no tráfico found',
    entradaRecord ? `entrada=${entradaRecord.cve_entrada}` : 'no entrada',
    `${emittedEvents.length} downstream events`,
    `confidence=${confidenceTier}`,
  ].join(', ')

  return { success: true, result: summary, emitted_events: emittedEvents }
}

module.exports = { handleEmailProcessed }
