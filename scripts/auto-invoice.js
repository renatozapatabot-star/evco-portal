#!/usr/bin/env node
/**
 * CRUZ Auto-Invoice Generator — Build 214
 * ============================================================================
 * When a tráfico completes (status = Cruzado/Liberado), CRUZ auto-generates
 * an invoice with broker fees, T-MEC savings, and sends for Tito's approval.
 *
 * Cron: 0 8 * * 1-6 (daily 8 AM, weekdays + Saturday)
 *
 * Patente 3596 · Aduana 240
 * ============================================================================
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { getAllRates } = require('./lib/rates')

const SCRIPT_NAME = 'auto-invoice'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const { withSyncLog } = require('./lib/sync-log')

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sendTelegram(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG skip]', msg.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
    })
  } catch (e) { console.error('Telegram error:', e.message) }
}

function todayCST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

// ── Fee schedule (from system_config — fallback defaults) ────────────────────

async function getFeeSchedule() {
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'broker_fee_schedule')
    .maybeSingle()

  if (data?.value) return data.value

  // Fallback — standard fee schedule
  return {
    customs_service_base: 3500, // MXN per pedimento
    document_handling: 800,     // MXN per operation
    crossing_fee: 1200,         // MXN per crossing
    tmec_processing: 500,       // MXN if T-MEC applies
    iva_rate: 0.16,
    currency: 'MXN',
  }
}

// ── Generate invoice number ──────────────────────────────────────────────────

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

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`\nCRUZ Auto-Invoice Generator`)
  console.log(`  ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}\n`)

  const companyId = process.env.DEFAULT_COMPANY_ID || 'evco'
  const fees = await getFeeSchedule()
  const rates = await getAllRates()

  // Find tráficos that completed (Cruzado/Liberado) without an invoice
  const { data: completed, error } = await supabase
    .from('traficos')
    .select('trafico, proveedor, importe_total, moneda, regimen, fraccion_arancelaria, fecha_cruce')
    .eq('company_id', companyId)
    .in('estatus', ['Cruzado', 'Liberado'])
    .not('fecha_cruce', 'is', null)
    .order('fecha_cruce', { ascending: false })
    .limit(50)

  if (error) {
    await sendTelegram(`🔴 <b>${SCRIPT_NAME}</b> query failed: ${error.message}`)
    throw new Error(`Query failed: ${error.message}`)
  }

  if (!completed || completed.length === 0) {
    console.log('No completed tráficos without invoices.\n')
    return
  }

  // Check which already have invoices
  const traficoIds = completed.map(t => t.trafico)
  const { data: existingInvoices } = await supabase
    .from('invoices')
    .select('line_items')
    .eq('company_id', companyId)

  // Extract tráficos that already have invoices
  const invoicedTraficos = new Set()
  for (const inv of (existingInvoices || [])) {
    const items = inv.line_items || []
    for (const item of items) {
      if (item.trafico_id) invoicedTraficos.add(item.trafico_id)
    }
  }

  const needsInvoice = completed.filter(t => !invoicedTraficos.has(t.trafico))
  console.log(`${needsInvoice.length} tráfico(s) need invoicing\n`)

  let created = 0

  for (const traf of needsInvoice) {
    const isTMEC = ['ITE', 'ITR', 'IMD'].includes((traf.regimen || '').toUpperCase())
    const valorUSD = traf.importe_total || 0

    // Calculate line items
    const lineItems = [
      {
        description: `Servicios de despacho aduanal — ${traf.trafico}`,
        trafico_id: traf.trafico,
        amount: fees.customs_service_base,
        currency: 'MXN',
      },
      {
        description: 'Manejo de documentos',
        amount: fees.document_handling,
        currency: 'MXN',
      },
      {
        description: 'Servicio de cruce',
        amount: fees.crossing_fee,
        currency: 'MXN',
      },
    ]

    if (isTMEC) {
      lineItems.push({
        description: 'Procesamiento T-MEC',
        amount: fees.tmec_processing,
        currency: 'MXN',
      })

      // Calculate T-MEC savings (IGI that would have been paid)
      const hypotheticalIGI = Math.round(valorUSD * rates.exchangeRate * 0.05 * 100) / 100 // Assume 5% avg IGI
      if (hypotheticalIGI > 0) {
        lineItems.push({
          description: `Ahorro T-MEC generado (IGI evitado: $${hypotheticalIGI.toLocaleString('en-US')} MXN)`,
          amount: 0, // Informational line — not charged
          currency: 'MXN',
          is_savings: true,
        })
      }
    }

    const subtotal = lineItems.reduce((s, item) => s + (item.is_savings ? 0 : item.amount), 0)
    const ivaAmount = Math.round(subtotal * fees.iva_rate * 100) / 100
    const total = subtotal + ivaAmount

    // Generate invoice number
    const invoiceNumber = await nextInvoiceNumber(companyId)

    // Calculate due date (15 days from today)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 15)

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        company_id: companyId,
        period_start: traf.fecha_cruce,
        period_end: traf.fecha_cruce,
        line_items: lineItems,
        subtotal,
        iva: ivaAmount,
        total,
        currency: 'MXN',
        status: 'draft',
        due_date: dueDate.toISOString().split('T')[0],
      })
      .select('id, invoice_number')
      .single()

    if (invErr) {
      console.error(`  ⚠ Invoice for ${traf.trafico} failed: ${invErr.message}`)
      continue
    }

    console.log(`  ✅ ${invoiceNumber} · ${traf.trafico} · $${total.toLocaleString('en-US')} MXN`)

    // Notify Tito
    await sendTelegram(
      `💰 <b>Factura lista</b>\n` +
      `${invoiceNumber} · ${traf.trafico}\n` +
      `${traf.proveedor || 'Sin proveedor'}\n` +
      `Subtotal: $${subtotal.toLocaleString('en-US')} MXN\n` +
      `IVA: $${ivaAmount.toLocaleString('en-US')} MXN\n` +
      `<b>Total: $${total.toLocaleString('en-US')} MXN</b>\n` +
      (isTMEC ? 'T-MEC: ✅\n' : '') +
      `Vence: ${dueDate.toLocaleDateString('es-MX', { timeZone: 'America/Chicago' })}`
    )

    // Audit log
    await supabase.from('audit_log').insert({
      action: 'invoice_auto_generated',
      entity_type: 'invoice',
      entity_id: invoice.invoice_number,
      details: { trafico: traf.trafico, total, currency: 'MXN', tmec: isTMEC },
      company_id: companyId,
    }).then(() => {}, () => {})

    created++
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n${created} invoices created · ${elapsed}s`)

  // Heartbeat
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: 'success',
    details: { created, checked: needsInvoice.length, elapsed_s: parseFloat(elapsed) },
  }).then(() => {}, () => {})

  if (created > 0) {
    await sendTelegram(`✅ <b>Auto-Invoice</b> · ${created} facturas generadas · ${elapsed}s`)
  }
}

withSyncLog(supabase, { sync_type: 'auto_invoice', company_id: null }, run).catch(async err => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}`)
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME, status: 'failed',
    details: { error: err.message },
  }).then(() => {}, () => {})
  process.exit(1)
})
