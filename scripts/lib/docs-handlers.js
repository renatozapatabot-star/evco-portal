// scripts/lib/docs-handlers.js
// Real handlers for intake.document_attached and docs.solicitation_sent events.
// Idempotent: checks for existing rows/events before writing.
// Draft-based: solicitations create approval drafts, never send email directly.

const { emitEvent, supabase } = require('./workflow-emitter')
const { logDecision } = require('../decision-logger')
const { buildSolicitationEmail, buildSubject, docLabel } = require('./email-templates')

// ── Handler 1: intake.document_attached ─────────────────────────────────────

async function handleDocumentAttached(event) {
  const { trigger_id, company_id, payload, id: eventId } = event

  // 1. Validate required fields
  if (!company_id) {
    return { success: false, result: 'Missing company_id — cannot attach document without tenant scope' }
  }

  if (!payload) {
    return { success: false, result: 'Empty payload — cannot process document attachment' }
  }

  const docType = (payload.document_type || payload.docType || '').toUpperCase()
  const filename = payload.filename || null
  const mimeType = payload.mime_type || null
  const fileUrl = payload.document_url || payload.file_url || null
  const entradaId = payload.entrada_id || null
  const traficoId = payload.trafico_id || trigger_id
  const cveCliente = payload.cve_cliente || null

  if (!docType) {
    return { success: false, result: 'Missing document_type in payload' }
  }

  // 2. Verify tráfico exists and is tenant-scoped
  const { data: trafico } = await supabase
    .from('traficos')
    .select('trafico, company_id, estatus')
    .eq('company_id', company_id)
    .eq('trafico', traficoId)
    .maybeSingle()

  // 3. Idempotency — check if document already exists for this tráfico + type
  const { data: existingDoc } = await supabase
    .from('expediente_documentos')
    .select('id')
    .eq('pedimento_id', traficoId)
    .eq('doc_type', docType)
    .limit(1)

  const alreadyExisted = existingDoc && existingDoc.length > 0

  if (!alreadyExisted) {
    // 4. Insert into expediente_documentos
    const { error: insertErr } = await supabase
      .from('expediente_documentos')
      .insert({
        pedimento_id: traficoId,
        doc_type: docType,
        nombre: filename,
        file_url: fileUrl,
      })

    if (insertErr) {
      // Tolerate duplicate constraint violations (idempotency race condition)
      if (insertErr.code !== '23505' && !insertErr.message?.includes('duplicate')) {
        return { success: false, result: `expediente_documentos insert failed: ${insertErr.message}` }
      }
    }
  }

  // 5. Emit docs.document_received for downstream completeness check
  const emittedEvents = []

  const { data: existingReceived } = await supabase
    .from('workflow_events')
    .select('id')
    .eq('trigger_id', traficoId)
    .eq('workflow', 'docs')
    .eq('event_type', 'document_received')
    .limit(1)

  if (!existingReceived || existingReceived.length === 0) {
    const result = await emitEvent('docs', 'document_received', traficoId, company_id, {
      doc_type: docType,
      filename,
      mime_type: mimeType,
      file_url: fileUrl,
      entrada_id: entradaId,
    }, eventId)
    if (result.data) emittedEvents.push('docs.document_received')
  } else {
    emittedEvents.push('docs.document_received (already existed)')
  }

  // 6. Log decision
  await logDecision({
    trafico: traficoId,
    company_id,
    decision_type: 'intake',
    decision: 'document_attached_processed',
    reasoning: [
      `Doc type: ${docType}`,
      `Filename: ${filename || 'none'}`,
      `Tráfico: ${traficoId}`,
      `Tráfico found: ${trafico ? 'yes' : 'no'}`,
      `Already existed: ${alreadyExisted ? 'yes' : 'no'}`,
      `Events emitted: ${emittedEvents.length}`,
    ].join(' | '),
    dataPoints: {
      trigger_id,
      doc_type: docType,
      filename,
      mime_type: mimeType,
      trafico_id: traficoId,
      entrada_id: entradaId,
      trafico_found: !!trafico,
      already_existed: alreadyExisted,
      emitted_events: emittedEvents,
    },
  })

  const summary = [
    `Document ${docType} attached to ${traficoId}`,
    alreadyExisted ? '(already existed)' : '(inserted)',
    `${emittedEvents.length} downstream events`,
  ].join(', ')

  return { success: true, result: summary, emitted_events: emittedEvents }
}

// ── Handler 2: docs.solicitation_sent ───────────────────────────────────────

async function handleSolicitationSent(event) {
  const { trigger_id, company_id, payload, id: eventId } = event

  // 1. Validate required fields
  if (!company_id) {
    return { success: false, result: 'Missing company_id — cannot create solicitation without tenant scope' }
  }

  if (!payload) {
    return { success: false, result: 'Empty payload — cannot process solicitation' }
  }

  const traficoId = payload.trafico_id || trigger_id
  const cveCliente = payload.cve_cliente || null
  const cveProveedor = payload.cve_proveedor || null
  const missingDocTypes = payload.missing_document_types || payload.solicited_docs || []
  let supplierEmail = payload.supplier_email || null
  const dryRun = payload.dry_run === true

  if (!Array.isArray(missingDocTypes) || missingDocTypes.length === 0) {
    return { success: false, result: 'missing_document_types is empty or not an array' }
  }

  // 2. Look up supplier email if not provided
  if (!supplierEmail && cveProveedor) {
    const { data: proveedor } = await supabase
      .from('globalpc_proveedores')
      .select('email, razon_social')
      .eq('cve_proveedor', cveProveedor)
      .eq('cve_cliente', cveCliente || company_id)
      .maybeSingle()

    if (proveedor?.email) {
      supplierEmail = proveedor.email
    }
  }

  // 3. If no email found, route to human review — never guess
  if (!supplierEmail) {
    const emitResult = await emitEvent('docs', 'needs_human_review', traficoId, company_id, {
      reason: `No supplier email for ${cveProveedor || 'unknown proveedor'} — cannot send solicitation`,
      trafico_id: traficoId,
      missing_document_types: missingDocTypes,
    }, eventId)

    await logDecision({
      trafico: traficoId,
      company_id,
      decision_type: 'solicitation',
      decision: 'solicitation_needs_human_review',
      reasoning: `No supplier email for ${cveProveedor || 'unknown'} | Routed to human review`,
      dataPoints: { trafico_id: traficoId, cve_proveedor: cveProveedor, missing_docs: missingDocTypes },
    })

    return {
      success: true,
      result: `No supplier email for ${cveProveedor || 'unknown'} — routed to human review`,
      emitted_events: emitResult.data ? ['docs.needs_human_review'] : [],
    }
  }

  // 4. Idempotency — check which doc types are already solicited
  const { data: existingSolicitudes } = await supabase
    .from('documento_solicitudes')
    .select('doc_type')
    .eq('trafico_id', traficoId)
    .in('status', ['solicitado', 'recibido'])

  const alreadySolicited = new Set((existingSolicitudes || []).map(s => s.doc_type))
  const newDocTypes = missingDocTypes.filter(dt => !alreadySolicited.has(dt))

  if (newDocTypes.length === 0) {
    await logDecision({
      trafico: traficoId,
      company_id,
      decision_type: 'solicitation',
      decision: 'solicitation_skipped_all_already_solicited',
      reasoning: `All ${missingDocTypes.length} doc types already solicited for ${traficoId}`,
      dataPoints: { trafico_id: traficoId, already_solicited: [...alreadySolicited] },
    })

    return {
      success: true,
      result: `All ${missingDocTypes.length} doc types already solicited for ${traficoId} — skipped`,
      emitted_events: [],
    }
  }

  // 5. Dry-run: log and return without DB writes
  if (dryRun) {
    await logDecision({
      trafico: traficoId,
      company_id,
      decision_type: 'solicitation',
      decision: 'solicitation_dry_run',
      reasoning: [
        `Tráfico: ${traficoId}`,
        `Supplier: ${supplierEmail}`,
        `New docs to solicit: ${newDocTypes.join(', ')}`,
        `Already solicited: ${[...alreadySolicited].join(', ') || 'none'}`,
        `DRY RUN — no DB writes`,
      ].join(' | '),
      dataPoints: { trafico_id: traficoId, supplier_email: supplierEmail, new_doc_types: newDocTypes, dry_run: true },
    })

    return {
      success: true,
      result: `[DRY RUN] Would solicit ${newDocTypes.length} docs from ${supplierEmail} for ${traficoId}`,
      emitted_events: [],
      dry_run: true,
    }
  }

  // 6. Build solicitation email HTML and draft data
  const emailHtml = buildSolicitationEmail({
    contactName: supplierEmail.split('@')[0],
    companyName: company_id,
    traficoId,
    missingDocs: newDocTypes,
    deadlineDays: 5,
  })

  const subject = buildSubject(traficoId, newDocTypes.length)

  const draftData = {
    type: 'documento_solicitud',
    trafico_id: traficoId,
    company_id,
    contact: {
      email: supplierEmail,
      cve_proveedor: cveProveedor,
    },
    missing_docs: newDocTypes,
    missing_docs_labels: newDocTypes.map(d => docLabel(d)),
    email: {
      subject,
      html: emailHtml,
      to: supplierEmail,
      from: 'Renato Zapata & Co. <ai@renatozapata.com>',
    },
    source: 'workflow-processor:docs.solicitation_sent',
    generated_at: new Date().toISOString(),
  }

  // 7. Insert approval draft
  const { error: draftErr } = await supabase.from('pedimento_drafts').insert({
    trafico_id: traficoId,
    draft_data: draftData,
    status: 'pending_approval',
    created_by: 'CRUZ',
  })

  if (draftErr) {
    // Tolerate duplicates — same tráfico may already have a pending solicitation draft
    if (draftErr.code !== '23505' && !draftErr.message?.includes('duplicate')) {
      return { success: false, result: `Draft insert failed: ${draftErr.message}` }
    }
  }

  // 8. Insert documento_solicitudes rows (unique constraint handles duplicates)
  let solicitudesCreated = 0
  for (const docType of newDocTypes) {
    const { error: solErr } = await supabase.from('documento_solicitudes').insert({
      trafico_id: traficoId,
      doc_type: docType,
      company_id,
      status: 'solicitado',
      solicitado_a: supplierEmail,
    })

    if (solErr && solErr.code !== '23505' && !solErr.message?.includes('duplicate') && !solErr.message?.includes('unique')) {
      console.error(`  documento_solicitudes insert error for ${docType}: ${solErr.message}`)
    } else {
      solicitudesCreated++
    }
  }

  // 9. Emit solicitation_logged for SLA tracking
  const emittedEvents = []
  const emitResult = await emitEvent('docs', 'solicitation_logged', traficoId, company_id, {
    solicited_docs: newDocTypes,
    supplier_email: supplierEmail,
    solicited_at: new Date().toISOString(),
    draft_status: 'pending_approval',
  }, eventId)
  if (emitResult.data) emittedEvents.push('docs.solicitation_logged')

  // 10. Log decision
  await logDecision({
    trafico: traficoId,
    company_id,
    decision_type: 'solicitation',
    decision: 'solicitation_draft_created',
    reasoning: [
      `Tráfico: ${traficoId}`,
      `Supplier: ${supplierEmail}`,
      `Docs solicited: ${newDocTypes.join(', ')}`,
      `Already solicited (skipped): ${[...alreadySolicited].join(', ') || 'none'}`,
      `Draft: pending_approval`,
      `Solicitudes created: ${solicitudesCreated}`,
    ].join(' | '),
    dataPoints: {
      trafico_id: traficoId,
      supplier_email: supplierEmail,
      cve_proveedor: cveProveedor,
      new_doc_types: newDocTypes,
      already_solicited: [...alreadySolicited],
      solicitudes_created: solicitudesCreated,
      emitted_events: emittedEvents,
    },
  })

  const summary = [
    `Solicitation draft created for ${traficoId}`,
    `${newDocTypes.length} docs: ${newDocTypes.join(', ')}`,
    `to: ${supplierEmail}`,
    `status: pending_approval`,
  ].join(', ')

  return { success: true, result: summary, emitted_events: emittedEvents }
}

module.exports = { handleDocumentAttached, handleSolicitationSent }
