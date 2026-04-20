// scripts/lib/invoice-handlers.js
// Real handlers for post_op.operation_scored, invoice.operation_accumulated,
// and invoice.invoice_ready events.
// Completes the autonomous chain: scored → accumulated → invoice ready.
// Idempotent, defensive, reuses fee schedule from system_config.

const { emitEvent, supabase } = require('./workflow-emitter')
const { logDecision } = require('../decision-logger')
const { getExchangeRate, getIVARate } = require('./rates')
const { sendEmail } = require('./email-send')
const { sendTelegram } = require('./telegram')

// ── Fee schedule (replicates auto-invoice.js pattern) ───────────────────────

const DEFAULT_FEES = {
  customs_service_base: 3500, // MXN per pedimento
  document_handling: 800,     // MXN per operation
  crossing_fee: 1200,         // MXN per crossing
  tmec_processing: 500,       // MXN if T-MEC applies
  currency: 'MXN',
}

async function getFeeSchedule() {
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'broker_fee_schedule')
    .maybeSingle()

  return data?.value || DEFAULT_FEES
}

// ── Billing period helpers (weekly Mon-Sun, America/Chicago) ────────────────

function getCurrentBillingPeriod() {
  const now = new Date()
  const cst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  const day = cst.getDay() // 0=Sun, 1=Mon, ..., 6=Sat

  // Monday of this week
  const monday = new Date(cst)
  monday.setDate(cst.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  // Sunday of this week
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const periodStart = monday.toISOString().split('T')[0]
  const periodEnd = sunday.toISOString().split('T')[0]

  // Has the period ended?
  const periodEnded = now > sunday

  return { periodStart, periodEnd, periodEnded }
}

// ── Invoice number generator (replicates auto-invoice.js pattern) ───────────

async function nextInvoiceNumber(companyId) {
  const year = new Date().getFullYear()
  const prefix = `RZ-${year}`

  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .like('invoice_number', `${prefix}-%`)

  const seq = String((count || 0) + 1).padStart(4, '0')
  return `${prefix}-${seq}`
}

// ── Handler 1: post_op.operation_scored ──────────────────────────────────────

async function handleOperationScored(event) {
  const { trigger_id, company_id, payload, id: eventId } = event

  if (!company_id) {
    return { success: false, result: 'Missing company_id' }
  }

  const traficoId = payload?.trafico_id || trigger_id
  if (!traficoId) {
    return { success: false, result: 'Missing trafico_id' }
  }

  const score = payload?.score || 0
  const transitDays = payload?.transit_days || null
  const docCount = payload?.doc_count || 0

  // Look up tráfico for billing context
  const { data: trafico } = await supabase
    .from('traficos')
    .select('trafico, company_id, regimen, pedimento, importe_total')
    .eq('trafico', traficoId)
    .eq('company_id', company_id)
    .maybeSingle()

  // Compute billable amount from fee schedule
  const fees = await getFeeSchedule()
  const regimen = (trafico?.regimen || '').toUpperCase()
  const isTMEC = ['ITE', 'ITR', 'IMD'].includes(regimen)

  let billableAmount = (fees.customs_service_base || 3500)
    + (fees.document_handling || 800)
    + (fees.crossing_fee || 1200)
  if (isTMEC) {
    billableAmount += (fees.tmec_processing || 500)
  }

  const feeBreakdown = {
    customs_service_base: fees.customs_service_base || 3500,
    document_handling: fees.document_handling || 800,
    crossing_fee: fees.crossing_fee || 1200,
    tmec_processing: isTMEC ? (fees.tmec_processing || 500) : 0,
    total: billableAmount,
    currency: 'MXN',
  }

  // Try to persist score (operation_scores may not exist yet)
  const { error: scoreErr } = await supabase
    .from('operation_scores')
    .insert({
      trafico_id: traficoId,
      company_id,
      score,
      transit_days: transitDays,
      doc_count: docCount,
      billable_amount: billableAmount,
      fee_breakdown: feeBreakdown,
    })

  if (scoreErr) {
    // Table may not exist — log warning, continue
    console.warn(`  [operation_scored] operation_scores insert skipped: ${scoreErr.message}`)
  }

  // Emit for invoice accumulation
  const emittedEvents = []
  const emitResult = await emitEvent('invoice', 'operation_accumulated', traficoId, company_id, {
    trafico_id: traficoId,
    billable_amount: billableAmount,
    score,
    fee_breakdown: feeBreakdown,
    regimen: regimen || null,
  }, eventId)
  if (emitResult.data) emittedEvents.push('invoice.operation_accumulated')

  await logDecision({
    trafico: traficoId,
    company_id,
    decision_type: 'invoice',
    decision: 'operation_scored_and_billed',
    reasoning: [
      `Tráfico: ${traficoId}`,
      `Score: ${score}/100`,
      `Transit: ${transitDays ?? '?'} days`,
      `Docs: ${docCount}`,
      `Billable: $${billableAmount} MXN`,
      `T-MEC: ${isTMEC ? 'yes' : 'no'}`,
    ].join(' | '),
    dataPoints: {
      trafico_id: traficoId,
      score,
      transit_days: transitDays,
      doc_count: docCount,
      billable_amount: billableAmount,
      fee_breakdown: feeBreakdown,
      emitted_events: emittedEvents,
    },
  })

  return {
    success: true,
    result: `Operation ${traficoId} scored ${score}/100, billable $${billableAmount} MXN`,
    emitted_events: emittedEvents,
  }
}

// ── Handler 2: invoice.operation_accumulated ────────────────────────────────

async function handleOperationAccumulated(event) {
  const { trigger_id, company_id, payload, id: eventId } = event

  if (!company_id) {
    return { success: false, result: 'Missing company_id' }
  }

  const traficoId = payload?.trafico_id || trigger_id
  if (!traficoId) {
    return { success: false, result: 'Missing trafico_id' }
  }

  const billableAmount = payload?.billable_amount || 0
  const score = payload?.score || 0
  const feeBreakdown = payload?.fee_breakdown || {}

  // Compute current billing period
  const { periodStart, periodEnd, periodEnded } = getCurrentBillingPeriod()

  // Find or create draft invoice for this company + period
  let { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, line_items, subtotal, company_id')
    .eq('company_id', company_id)
    .eq('status', 'draft')
    .eq('period_start', periodStart)
    .maybeSingle()

  if (!invoice) {
    // Create new draft invoice
    const invoiceNumber = await nextInvoiceNumber(company_id)
    const { data: newInvoice, error: createErr } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        company_id,
        period_start: periodStart,
        period_end: periodEnd,
        line_items: [],
        subtotal: 0,
        iva: 0,
        total: 0,
        currency: 'MXN',
        status: 'draft',
        due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      })
      .select('id, invoice_number, line_items, subtotal, company_id')
      .single()

    if (createErr) {
      return { success: false, result: `Invoice creation failed: ${createErr.message}` }
    }
    invoice = newInvoice
  }

  // Idempotency: check if trafico already in line_items
  const existingItems = invoice.line_items || []
  const alreadyAccumulated = existingItems.some(
    (item) => item.trafico_id === traficoId
  )

  if (alreadyAccumulated) {
    await logDecision({
      trafico: traficoId,
      company_id,
      decision_type: 'invoice',
      decision: 'operation_already_accumulated',
      reasoning: `Tráfico ${traficoId} already on invoice ${invoice.invoice_number}`,
      dataPoints: { trafico_id: traficoId, invoice_id: invoice.id },
    })
    return {
      success: true,
      result: `Tráfico ${traficoId} already on invoice ${invoice.invoice_number} — skipped`,
      emitted_events: [],
    }
  }

  // Append line item
  const lineItem = {
    trafico_id: traficoId,
    description: `Despacho aduanal — Tráfico ${traficoId}`,
    amount: billableAmount,
    currency: 'MXN',
    score,
    fee_breakdown: feeBreakdown,
    added_at: new Date().toISOString(),
  }

  const updatedItems = [...existingItems, lineItem]
  const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.amount || 0), 0)

  // Fetch exchange rate for USD equivalent (informational, not for billing)
  let usdEquivalent = null
  try {
    const fx = await getExchangeRate()
    if (fx?.rate > 0) {
      usdEquivalent = Math.round((newSubtotal / fx.rate) * 100) / 100
    }
  } catch (e) {
    console.warn(`  [accumulated] Exchange rate fetch failed: ${e.message}`)
  }

  // Update invoice
  const { error: updateErr } = await supabase
    .from('invoices')
    .update({
      line_items: updatedItems,
      subtotal: newSubtotal,
      notes: usdEquivalent ? `Equivalente USD: $${usdEquivalent}` : null,
    })
    .eq('id', invoice.id)

  if (updateErr) {
    return { success: false, result: `Invoice update failed: ${updateErr.message}` }
  }

  // Check if billing period ended → emit invoice_ready
  const emittedEvents = []
  if (periodEnded) {
    const emitResult = await emitEvent('invoice', 'invoice_ready', invoice.id, company_id, {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      line_item_count: updatedItems.length,
      subtotal: newSubtotal,
    }, eventId)
    if (emitResult.data) emittedEvents.push('invoice.invoice_ready')
  }

  await logDecision({
    trafico: traficoId,
    company_id,
    decision_type: 'invoice',
    decision: 'operation_accumulated',
    reasoning: [
      `Tráfico: ${traficoId}`,
      `Amount: $${billableAmount} MXN`,
      `Invoice: ${invoice.invoice_number}`,
      `Items: ${updatedItems.length}`,
      `Subtotal: $${newSubtotal} MXN`,
      `Period: ${periodStart} → ${periodEnd}`,
      `Period ended: ${periodEnded ? 'yes' : 'no'}`,
    ].join(' | '),
    dataPoints: {
      trafico_id: traficoId,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      billable_amount: billableAmount,
      subtotal: newSubtotal,
      usd_equivalent: usdEquivalent,
      item_count: updatedItems.length,
      period_ended: periodEnded,
      emitted_events: emittedEvents,
    },
  })

  return {
    success: true,
    result: `${traficoId} added to invoice ${invoice.invoice_number} ($${billableAmount} MXN, ${updatedItems.length} items, subtotal $${newSubtotal} MXN)`,
    emitted_events: emittedEvents,
  }
}

// ── Handler 3: invoice.invoice_ready ────────────────────────────────────────

async function handleInvoiceReady(event) {
  const { trigger_id, company_id, payload, id: eventId } = event

  if (!company_id) {
    return { success: false, result: 'Missing company_id' }
  }

  const invoiceId = payload?.invoice_id || trigger_id
  if (!invoiceId) {
    return { success: false, result: 'Missing invoice_id' }
  }

  // Pull the invoice
  const { data: invoice, error: fetchErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('company_id', company_id)
    .maybeSingle()

  if (fetchErr || !invoice) {
    return { success: false, result: `Invoice ${invoiceId} not found: ${fetchErr?.message || 'no row'}` }
  }

  // Idempotency: skip if already finalized
  if (['sent', 'paid', 'ready_for_send'].includes(invoice.status)) {
    return {
      success: true,
      result: `Invoice ${invoice.invoice_number} already ${invoice.status} — skipped`,
      emitted_events: [],
    }
  }

  const lineItems = invoice.line_items || []
  const subtotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)

  // Fetch IVA rate from system_config. Refuse-to-calculate + Telegram
  // SEV-1 alert if rate is missing or expired — silent fallback to 0.16
  // produces incorrect invoices when SAT adjusts the rate or
  // system_config is stale (CLAUDE.md §FINANCIAL CONFIG + core-invariants
  // rule 17). Event handler returns success:false so the workflow
  // processor routes this back to the queue for a later retry once
  // system_config is refreshed.
  let ivaRate
  try {
    const iva = await getIVARate()
    ivaRate = iva?.rate
    if (typeof ivaRate !== 'number' || ivaRate <= 0) {
      throw new Error(`IVA rate invalid shape: ${JSON.stringify(iva)}`)
    }
  } catch (e) {
    await sendTelegram([
      `🔴 <b>invoice_ready · ABORT</b>`,
      ``,
      `Invoice <code>${invoice.invoice_number || invoiceId}</code> (${company_id})`,
      `cannot finalize — IVA rate unavailable.`,
      ``,
      `Error: <code>${e.message}</code>`,
      `Fix: update <code>system_config</code> key <code>iva_rate</code> + valid_to.`,
    ].join('\n'))
    return {
      success: false,
      result: `IVA rate unavailable — invoice ${invoice.invoice_number || invoiceId} finalization blocked: ${e.message}`,
    }
  }

  const ivaAmount = Math.round(subtotal * ivaRate * 100) / 100
  const total = Math.round((subtotal + ivaAmount) * 100) / 100

  // Generate invoice number if missing
  let invoiceNumber = invoice.invoice_number
  if (!invoiceNumber) {
    invoiceNumber = await nextInvoiceNumber(company_id)
  }

  const dueDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]

  // Update invoice with final totals
  const { error: updateErr } = await supabase
    .from('invoices')
    .update({
      invoice_number: invoiceNumber,
      subtotal,
      iva: ivaAmount,
      total,
      currency: 'MXN',
      due_date: dueDate,
      status: 'ready_for_send',
    })
    .eq('id', invoiceId)

  if (updateErr) {
    return { success: false, result: `Invoice finalization failed: ${updateErr.message}` }
  }

  // Threshold routing
  const emittedEvents = []
  const AUTO_SEND_THRESHOLD = 50000 // MXN

  if (total < AUTO_SEND_THRESHOLD) {
    // Auto-send for small invoices
    // Look up company contact for email
    const { data: company } = await supabase
      .from('companies')
      .select('name, contact_email')
      .eq('company_id', company_id)
      .maybeSingle()

    const recipientEmail = company?.contact_email
    if (recipientEmail) {
      const itemRows = lineItems.map((item, i) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${i + 1}</td>` +
        `<td style="padding:6px 12px;border-bottom:1px solid #eee">${item.description || item.trafico_id}</td>` +
        `<td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">$${(item.amount || 0).toLocaleString('es-MX')} MXN</td></tr>`
      ).join('')

      const htmlBody = `
        <div style="max-width:600px;margin:0 auto;font-family:sans-serif">
          <div style="border-bottom:3px solid #C9A84C;padding-bottom:12px;margin-bottom:24px">
            <h2 style="margin:0;font-size:18px;color:#1A1A1A">Renato Zapata & Company</h2>
            <p style="margin:4px 0 0;font-size:13px;color:#6B6B6B">Patente 3596 · Aduana 240 · Nuevo Laredo</p>
          </div>
          <h3 style="color:#1A1A1A">Factura ${invoiceNumber}</h3>
          <p style="color:#666">Período: ${invoice.period_start} — ${invoice.period_end}</p>
          <p style="color:#666">Fecha de vencimiento: ${dueDate}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead><tr style="background:#f5f5f5">
              <th style="padding:8px 12px;text-align:left">#</th>
              <th style="padding:8px 12px;text-align:left">Concepto</th>
              <th style="padding:8px 12px;text-align:right">Monto</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div style="text-align:right;margin-top:16px">
            <p>Subtotal: <strong>$${subtotal.toLocaleString('es-MX')} MXN</strong></p>
            <p>IVA (${Math.round(ivaRate * 100)}%): <strong>$${ivaAmount.toLocaleString('es-MX')} MXN</strong></p>
            <p style="font-size:18px;color:#C9A84C">Total: <strong>$${total.toLocaleString('es-MX')} MXN</strong></p>
          </div>
          <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
          <p style="font-size:12px;color:#999">CRUZ — Cross-Border Intelligence · ai@renatozapata.com</p>
        </div>
      `

      const emailResult = await sendEmail({
        to: recipientEmail,
        subject: `Factura ${invoiceNumber} — Renato Zapata & Company`,
        htmlBody,
      })

      if (emailResult.success) {
        await supabase
          .from('invoices')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', invoiceId)
      } else {
        // Email failed — emit needs_human_review instead of silently completing
        const emitResult = await emitEvent('invoice', 'needs_human_review', invoiceId, company_id, {
          invoice_id: invoiceId,
          reason: `Auto-send failed: ${emailResult.error}`,
        }, eventId)
        if (emitResult.data) emittedEvents.push('invoice.needs_human_review')
      }
    } else {
      // No contact email — route to admin
      const emitResult = await emitEvent('invoice', 'needs_admin_approval', invoiceId, company_id, {
        invoice_id: invoiceId,
        reason: 'No contact email found for company',
        total,
      }, eventId)
      if (emitResult.data) emittedEvents.push('invoice.needs_admin_approval')
    }
  } else {
    // Large invoice — route to Tito for approval
    const emitResult = await emitEvent('invoice', 'needs_admin_approval', invoiceId, company_id, {
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      total,
      reason: `Total $${total.toLocaleString('es-MX')} MXN exceeds auto-send threshold`,
    }, eventId)
    if (emitResult.data) emittedEvents.push('invoice.needs_admin_approval')
  }

  await logDecision({
    trafico: invoiceId,
    company_id,
    decision_type: 'invoice',
    decision: total < AUTO_SEND_THRESHOLD ? 'invoice_auto_sent' : 'invoice_needs_approval',
    reasoning: [
      `Invoice: ${invoiceNumber}`,
      `Items: ${lineItems.length}`,
      `Subtotal: $${subtotal} MXN`,
      `IVA: $${ivaAmount} MXN`,
      `Total: $${total} MXN`,
      `Threshold: $${AUTO_SEND_THRESHOLD} MXN`,
      `Route: ${total < AUTO_SEND_THRESHOLD ? 'auto-send' : 'admin approval'}`,
    ].join(' | '),
    dataPoints: {
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      line_item_count: lineItems.length,
      subtotal,
      iva: ivaAmount,
      total,
      currency: 'MXN',
      threshold: AUTO_SEND_THRESHOLD,
      emitted_events: emittedEvents,
    },
  })

  return {
    success: true,
    result: `Invoice ${invoiceNumber} finalized: $${total.toLocaleString('es-MX')} MXN (${lineItems.length} items)`,
    emitted_events: emittedEvents,
  }
}

module.exports = { handleOperationScored, handleOperationAccumulated, handleInvoiceReady }
