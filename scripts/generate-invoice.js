#!/usr/bin/env node

// ============================================================
// CRUZ Invoice Generator — auto-bills completed tráficos
// Generates monthly invoices per client for brokerage services.
// Cron: 0 8 1 * * (1st of month at 8 AM — after monthly report)
// Run: node scripts/generate-invoice.js [--dry-run] [--month=2026-03]
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const MONTH_ARG = process.argv.find(a => a.startsWith('--month='))?.split('=')[1]
const TELEGRAM_CHAT = '-5085543275'
const IVA_RATE = 0.16

// Default fee schedule (should be in system_config per client)
const DEFAULT_FEES = {
  brokerage_per_trafico: 850,     // MXN per tráfico
  document_processing: 350,       // MXN per tráfico
  customs_clearance: 500,         // MXN per tráfico
  tmec_cert_review: 200,          // MXN per T-MEC operation
}

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (DRY_RUN || !token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

function fmtMXN(n) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

async function generateForClient(company, monthStart, monthEnd, year, month) {
  const { company_id, name } = company

  // Get completed tráficos in period
  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico, estatus, regimen, importe_total')
    .eq('company_id', company_id)
    .gte('fecha_cruce', monthStart)
    .lt('fecha_cruce', monthEnd)
    .ilike('estatus', '%cruz%')

  const completed = traficos || []
  if (completed.length === 0) return null

  const tmecCount = completed.filter(t => {
    const r = (t.regimen || '').toUpperCase()
    return r === 'ITE' || r === 'ITR' || r === 'IMD'
  }).length

  // Build line items
  const lineItems = [
    { concept: 'Honorarios de agente aduanal', qty: completed.length, unit_price: DEFAULT_FEES.brokerage_per_trafico, total: completed.length * DEFAULT_FEES.brokerage_per_trafico },
    { concept: 'Procesamiento de documentos', qty: completed.length, unit_price: DEFAULT_FEES.document_processing, total: completed.length * DEFAULT_FEES.document_processing },
    { concept: 'Despacho aduanal', qty: completed.length, unit_price: DEFAULT_FEES.customs_clearance, total: completed.length * DEFAULT_FEES.customs_clearance },
  ]

  if (tmecCount > 0) {
    lineItems.push({ concept: 'Revisión certificado T-MEC', qty: tmecCount, unit_price: DEFAULT_FEES.tmec_cert_review, total: tmecCount * DEFAULT_FEES.tmec_cert_review })
  }

  const subtotal = lineItems.reduce((s, l) => s + l.total, 0)
  const iva = Math.round(subtotal * IVA_RATE * 100) / 100
  const total = subtotal + iva

  // Generate invoice number: RZ-YYYY-MM-NNN
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`)
  const seq = String((count || 0) + 1).padStart(3, '0')
  const invoiceNumber = `RZ-${year}-${String(month).padStart(2, '0')}-${seq}`

  // Due date: 30 days from generation
  const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const invoice = {
    invoice_number: invoiceNumber,
    company_id,
    period_start: monthStart,
    period_end: monthEnd,
    line_items: lineItems,
    subtotal,
    iva,
    total,
    currency: 'MXN',
    status: 'draft',
    due_date: dueDate,
    notes: `${completed.length} tráficos despachados · Patente 3596 · Aduana 240`,
  }

  if (!DRY_RUN) {
    await supabase.from('invoices').insert(invoice).then(() => {}, () => {})
  }

  return { ...invoice, client_name: name, traficos_count: completed.length }
}

async function main() {
  // Determine period
  let year, month
  if (MONTH_ARG) {
    const [y, m] = MONTH_ARG.split('-').map(Number)
    year = y; month = m
  } else {
    const prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
    year = prev.getFullYear(); month = prev.getMonth() + 1
  }

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const nextM = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
  const monthEnd = `${nextM.y}-${String(nextM.m).padStart(2, '0')}-01`
  const monthNames = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

  console.log(`💰 CRUZ Invoice Generator — ${monthNames[month]} ${year}`)
  console.log(`  Period: ${monthStart} → ${monthEnd} · ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const { data: companies } = await supabase
    .from('companies')
    .select('company_id, name')
    .not('portal_password', 'is', null)
    .eq('active', true)

  const invoices = []
  for (const company of (companies || [])) {
    const invoice = await generateForClient(company, monthStart, monthEnd, year, month)
    if (invoice) {
      invoices.push(invoice)
      console.log(`  ✅ ${invoice.client_name}: ${invoice.invoice_number} · ${invoice.traficos_count} tráficos · ${fmtMXN(invoice.total)}`)
    }
  }

  if (invoices.length > 0) {
    const totalBilled = invoices.reduce((s, i) => s + i.total, 0)
    await sendTelegram([
      `💰 <b>Facturas generadas — ${monthNames[month]} ${year}</b>`,
      ``,
      `${invoices.length} factura(s) por <b>${fmtMXN(totalBilled)}</b> MXN`,
      ...invoices.map(i => `  • ${i.client_name}: ${fmtMXN(i.total)} (${i.traficos_count} tráficos)`),
      ``,
      `Pendiente revisión y aprobación`,
      `— CRUZ 🦀`,
    ].join('\n'))
  }

  console.log(`\n✅ ${invoices.length} invoices generated`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
