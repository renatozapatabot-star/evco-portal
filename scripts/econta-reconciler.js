#!/usr/bin/env node

// ============================================================
// CRUZ eConta Reconciler — match operations vs accounting
// Uses aduanet_facturas (referencia→trafico) for operation matching
// and econta_cartera (cve_cliente) for receivables.
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
function fmtUSD(n) { return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) }

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

  // ── 1. Get completed tráficos ──
  const { data: operations } = await supabase
    .from('traficos')
    .select('trafico, pedimento, company_id, importe_total, estatus')
    .not('pedimento', 'is', null)
    .ilike('estatus', '%cruz%')
    .gte('fecha_llegada', '2024-01-01')
    .limit(5000)

  const ops = operations || []
  console.log(`  Completed tráficos: ${ops.length}`)

  // ── 2. Get aduanet_facturas (these have referencia = trafico ID) ──
  const { data: aduanetFacts } = await supabase
    .from('aduanet_facturas')
    .select('referencia, pedimento, valor_usd, clave_cliente')
    .gte('fecha_pago', '2024-01-01')
    .limit(5000)

  const aduanet = aduanetFacts || []
  console.log(`  Aduanet facturas: ${aduanet.length}`)

  // Build match sets from aduanet facturas
  // Two formats: "1648-Y4316" (matches trafico directly) and "4598RZ2121" (clave prefix)
  const invoicedTraficoSet = new Set()
  const invoicedClaveSet = new Set() // clave_cliente values that have ANY invoice
  for (const f of aduanet) {
    if (f.referencia && f.referencia.includes('-')) invoicedTraficoSet.add(f.referencia)
    if (f.clave_cliente) invoicedClaveSet.add(f.clave_cliente)
  }

  // Match: tráfico has a matching aduanet factura by referencia
  // OR the client has invoices (clave match = at least billed at client level)
  const matched = []
  const unbilled = []
  for (const op of ops) {
    const opClave = op.trafico.split('-')[0] // Extract clave prefix
    if (invoicedTraficoSet.has(op.trafico) || invoicedClaveSet.has(opClave)) {
      matched.push(op)
    } else {
      unbilled.push(op)
    }
  }

  console.log(`  Matched: ${matched.length}`)
  console.log(`  Unbilled: ${unbilled.length}`)

  // ── 3. Get econta_cartera for receivables ──
  const { data: cartera } = await supabase
    .from('econta_cartera')
    .select('consecutivo, cve_cliente, importe, saldo, fecha')
    .gt('saldo', 0)
    .limit(5000)

  const crt = cartera || []
  const now = Date.now()
  const overdue30 = crt.filter(c => c.fecha && (now - new Date(c.fecha).getTime()) > 30 * 86400000)
  const overdue60 = crt.filter(c => c.fecha && (now - new Date(c.fecha).getTime()) > 60 * 86400000)
  const overdue90 = crt.filter(c => c.fecha && (now - new Date(c.fecha).getTime()) > 90 * 86400000)
  const totalPendiente = crt.reduce((s, c) => s + (Number(c.saldo) || 0), 0)

  console.log(`  Cartera pendiente: ${fmtMXN(totalPendiente)} (${crt.length} items)`)
  console.log(`  Overdue >30d: ${overdue30.length} | >60d: ${overdue60.length} | >90d: ${overdue90.length}`)

  // ── 4. Get econta_facturas totals ──
  const { data: econtaFacts } = await supabase
    .from('econta_facturas')
    .select('total')
    .gte('fecha', '2024-01-01')
    .limit(5000)

  const totalFacturado = (econtaFacts || []).reduce((s, f) => s + (Number(f.total) || 0), 0)
  console.log(`  eConta facturado (2024+): ${fmtMXN(totalFacturado)}`)

  // ── 5. Unbilled value ──
  const unbilledValue = unbilled.reduce((s, o) => s + (Number(o.importe_total) || 0), 0)

  // ── 6. By-client breakdown ──
  const byClient = {}
  for (const op of unbilled) {
    byClient[op.company_id] = (byClient[op.company_id] || 0) + 1
  }
  const topUnbilled = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // ── 7. Save ──
  if (!DRY_RUN) {
    await supabase.from('benchmarks').upsert([
      { metric: 'reconciliation_matched', dimension: 'fleet', value: matched.length, sample_size: ops.length, period: new Date().toISOString().split('T')[0] },
      { metric: 'reconciliation_unbilled', dimension: 'fleet', value: unbilled.length, sample_size: ops.length, period: new Date().toISOString().split('T')[0] },
      { metric: 'reconciliation_pending_mxn', dimension: 'fleet', value: Math.round(totalPendiente), sample_size: crt.length, period: new Date().toISOString().split('T')[0] },
    ], { onConflict: 'metric,dimension' }).then(() => {}, () => {})
  }

  // ── 8. Telegram ──
  const lines = [
    `💰 <b>Conciliación eConta</b>`,
    ``,
    `📊 <b>Operaciones vs Facturación</b>`,
    `  Completados: ${ops.length}`,
    `  Con factura: <b>${matched.length}</b> (${ops.length > 0 ? Math.round(matched.length / ops.length * 100) : 0}%)`,
    `  Sin factura: ${unbilled.length} (${fmtUSD(unbilledValue)} valor mercancía)`,
    ``,
    `💳 <b>Cartera</b>`,
    `  Pendiente cobro: <b>${fmtMXN(totalPendiente)}</b>`,
    overdue90.length > 0 ? `  🔴 ${overdue90.length} vencidas >90 días` : '',
    overdue60.length > 0 && overdue90.length === 0 ? `  🟡 ${overdue60.length} vencidas >60 días` : '',
    overdue30.length > 0 && overdue60.length === 0 ? `  🟡 ${overdue30.length} vencidas >30 días` : '',
    ``,
    unbilled.length > 0 ? `⚠️ <b>Sin factura por cliente:</b>` : '',
    ...topUnbilled.map(([cid, count]) => `  • ${cid}: ${count}`),
    ``,
    `— CRUZ 🦀`,
  ].filter(Boolean)

  await sendTelegram(lines.join('\n'))

  console.log(`\n✅ ${matched.length}/${ops.length} matched (${Math.round(matched.length / Math.max(1, ops.length) * 100)}%)`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
