#!/usr/bin/env node

// ============================================================
// CRUZ eConta Reconciler — match operations vs accounting
// Compares tráficos/pedimentos against eConta invoices/payments.
// Flags: unbilled operations, orphan invoices, overdue receivables.
// Cron: 0 4 * * 1 (Monday 4 AM)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'

function fmtMXN(n) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

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

async function main() {
  console.log(`💰 CRUZ eConta Reconciler — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  // ── 1. Get completed operations (with pedimentos) ──
  const { data: operations } = await supabase
    .from('traficos')
    .select('trafico, pedimento, company_id, importe_total, estatus, fecha_cruce')
    .not('pedimento', 'is', null)
    .ilike('estatus', '%cruz%')
    .gte('fecha_llegada', '2024-01-01')
    .limit(5000)

  const ops = operations || []
  console.log(`  Operations (cruzado + pedimento): ${ops.length}`)

  // ── 2. Get eConta invoices ──
  const { data: facturas } = await supabase
    .from('econta_facturas')
    .select('consecutivo, referencia, importe, saldo, moneda, fecha, company_id')
    .gte('fecha', '2024-01-01')
    .limit(5000)

  const facts = facturas || []
  console.log(`  eConta facturas: ${facts.length}`)

  // ── 3. Get cartera (receivables) ──
  const { data: cartera } = await supabase
    .from('econta_cartera')
    .select('consecutivo, referencia, importe, saldo, fecha, company_id')
    .gte('fecha', '2024-01-01')
    .limit(5000)

  const crt = cartera || []
  console.log(`  eConta cartera: ${crt.length}`)

  // ── 4. Match operations to invoices ──
  const invoiceRefs = new Set(facts.map(f => f.referencia).filter(Boolean))
  const operationRefs = new Set(ops.map(o => o.trafico))

  const unbilled = ops.filter(o => !invoiceRefs.has(o.trafico) && !invoiceRefs.has(o.pedimento))
  const orphanInvoices = facts.filter(f => f.referencia && !operationRefs.has(f.referencia))

  // ── 5. Overdue receivables ──
  const now = Date.now()
  const overdue30 = crt.filter(c => c.saldo > 0 && c.fecha && (now - new Date(c.fecha).getTime()) > 30 * 86400000)
  const overdue60 = crt.filter(c => c.saldo > 0 && c.fecha && (now - new Date(c.fecha).getTime()) > 60 * 86400000)
  const overdue90 = crt.filter(c => c.saldo > 0 && c.fecha && (now - new Date(c.fecha).getTime()) > 90 * 86400000)

  // ── 6. Totals ──
  const totalFacturado = facts.reduce((s, f) => s + (Number(f.importe) || 0), 0)
  const totalCobrado = facts.reduce((s, f) => s + (Number(f.importe) || 0) - (Number(f.saldo) || 0), 0)
  const totalPendiente = crt.reduce((s, c) => s + (Number(c.saldo) || 0), 0)
  const unbilledValue = unbilled.reduce((s, o) => s + (Number(o.importe_total) || 0), 0)

  console.log(`\n  Matched: ${ops.length - unbilled.length}`)
  console.log(`  Unbilled operations: ${unbilled.length} (${fmtMXN(unbilledValue)} USD valor mercancía)`)
  console.log(`  Orphan invoices: ${orphanInvoices.length}`)
  console.log(`  Overdue >30d: ${overdue30.length} | >60d: ${overdue60.length} | >90d: ${overdue90.length}`)
  console.log(`  Total facturado: ${fmtMXN(totalFacturado)}`)
  console.log(`  Total cobrado: ${fmtMXN(totalCobrado)}`)
  console.log(`  Pendiente cobro: ${fmtMXN(totalPendiente)}`)

  // ── 7. Save reconciliation ──
  if (!DRY_RUN) {
    await supabase.from('benchmarks').upsert([
      { metric: 'reconciliation_unbilled', dimension: 'fleet', value: unbilled.length, sample_size: ops.length, period: new Date().toISOString().split('T')[0] },
      { metric: 'reconciliation_overdue', dimension: 'fleet', value: overdue30.length, sample_size: crt.length, period: new Date().toISOString().split('T')[0] },
      { metric: 'reconciliation_pending', dimension: 'fleet', value: totalPendiente, sample_size: facts.length, period: new Date().toISOString().split('T')[0] },
    ], { onConflict: 'metric,dimension' }).then(() => {}, () => {})
  }

  // ── 8. Telegram ──
  if (unbilled.length > 0 || overdue30.length > 0) {
    const lines = [
      `💰 <b>Conciliación eConta</b>`,
      ``,
      `📊 <b>Resumen</b>`,
      `  Facturado: ${fmtMXN(totalFacturado)}`,
      `  Cobrado: ${fmtMXN(totalCobrado)}`,
      `  Pendiente: <b>${fmtMXN(totalPendiente)}</b>`,
      ``,
    ]

    if (unbilled.length > 0) {
      lines.push(`⚠️ <b>${unbilled.length} operaciones sin factura</b>`)
      unbilled.slice(0, 3).forEach(o => lines.push(`  • ${o.trafico} (${o.company_id})`))
    }

    if (overdue90.length > 0) lines.push(`🔴 ${overdue90.length} facturas vencidas >90 días`)
    else if (overdue60.length > 0) lines.push(`🟡 ${overdue60.length} facturas vencidas >60 días`)
    else if (overdue30.length > 0) lines.push(`🟡 ${overdue30.length} facturas vencidas >30 días`)

    lines.push(``, `— CRUZ 🦀`)
    await sendTelegram(lines.join('\n'))
  }

  console.log(`\n✅ Reconciliation complete`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
