#!/usr/bin/env node

// ============================================================
// CRUZ Filing Processor — "está bien" moment
// Polls approved_pending drafts past the 5-second cancel window
// Finalizes approval → prepares filing data → updates status
// Sends Tito the confirmation: "Patente 3596 honrada."
//
// Run: node scripts/filing-processor.js
// Cron: * * * * * (every minute — fast finalization)
//
// When GlobalPC WRITE API is available (Mario Ramos):
// - Plug in createTraficoAsync() at Step 2
// - Plug in createFacturaAsync() at Step 3
// - Plug in createPedimentoAsync() at Step 4
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_CHAT = '-5085543275'
const CANCEL_WINDOW_MS = 6000 // 6 seconds (5s window + 1s buffer)
const SCRIPT_NAME = 'filing-processor'

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
    })
  } catch (e) { console.error('Telegram error:', e.message) }
}

// ── Filing steps ──────────────────────────────────────

async function processDraft(draft) {
  const dd = draft.draft_data || {}
  const ext = dd.extraction || {}
  const supplier = dd.supplier || ext.supplier_name || 'Desconocido'
  const valorUSD = dd.valor_total_usd || ext.total_value || 0
  const currency = ext.currency || dd.currency || 'USD'
  const products = dd.products || dd.classifications || []
  const confidence = typeof dd.confidence === 'object' ? dd.confidence?.score : dd.confidence || 0
  const regimen = dd.regimen || 'IMD'

  console.log(`  Processing: ${draft.id.substring(0, 8)} · ${supplier} · ${valorUSD} ${currency}`)

  // ── Step 1: Finalize approval status ──
  const { error: finalizeErr } = await supabase
    .from('pedimento_drafts')
    .update({
      status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', draft.id)
    .eq('status', 'approved_pending') // Only if still pending (race condition guard)

  if (finalizeErr) {
    console.error(`  ❌ Finalize failed: ${finalizeErr.message}`)
    return false
  }

  // ── Step 2: Create/link tráfico in Supabase ──
  // When GlobalPC WRITE API available: call createTraficoAsync() here
  let traficoId = draft.trafico_id
  if (!traficoId) {
    // Generate a provisional tráfico ID
    const clave = dd.email?.clave || '9254'
    const seq = Math.floor(Math.random() * 9000) + 1000
    traficoId = `${clave}-P${seq}`
  }

  // ── Step 3: Prepare factura data ──
  // When GlobalPC WRITE API available: call createFacturaAsync() here
  const facturaData = {
    trafico: traficoId,
    proveedor: supplier,
    valor_usd: valorUSD,
    currency,
    invoice_number: ext.invoice_number || null,
    incoterm: ext.incoterm || null,
    country: ext.supplier_country || null,
    products: products.map((p, i) => ({
      partida: i + 1,
      descripcion: p.description || p.descripcion || '',
      fraccion: p.fraccion || p.fraccion_arancelaria || '',
      cantidad: p.qty || p.quantity || p.cantidad || 0,
      valor_usd: p.valor_usd || p.total_value || 0,
      pais_origen: p.country_of_origin || p.pais_origen || '',
      confidence: p.confidence || 0,
    })),
    regimen,
    confidence_score: confidence,
    filed_at: new Date().toISOString(),
  }

  // ── Step 4: Update draft with filing data ──
  await supabase
    .from('pedimento_drafts')
    .update({
      status: 'transmitido',
      trafico_id: traficoId,
      draft_data: {
        ...dd,
        filing: facturaData,
        filed_at: new Date().toISOString(),
        filed_by: 'CRUZ',
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', draft.id)

  // ── Step 5: Audit log — full chain of custody ──
  await supabase.from('audit_log').insert({
    action: 'draft_filed',
    details: {
      draft_id: draft.id,
      trafico_id: traficoId,
      supplier,
      valor_usd: valorUSD,
      currency,
      products_count: products.length,
      confidence,
      regimen,
      channel: 'filing_processor',
      approved_by: draft.reviewed_by || 'tito',
      approved_at: draft.updated_at,
      filed_at: new Date().toISOString(),
      // GlobalPC integration status
      globalpc_status: 'pending_manual', // Change to 'submitted' when API available
    },
    actor: 'CRUZ',
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})

  // ── Step 6: Telegram confirmation — "está bien" ──
  const productLines = products.slice(0, 3).map((p, i) =>
    `  ${i + 1}. ${(p.description || p.descripcion || '').substring(0, 40)} · ${p.fraccion || '—'}`
  ).join('\n')

  await sendTelegram([
    `🦀 <b>Patente 3596 honrada. Gracias, Tito.</b>`,
    ``,
    `📋 Borrador → Transmitido`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Tráfico: <code>${traficoId}</code>`,
    `Proveedor: <b>${supplier}</b>`,
    `Valor: <b>$${Number(valorUSD).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${currency}</b>`,
    `Régimen: ${regimen}${regimen === 'IMD' ? ' (T-MEC ✅)' : ''}`,
    `Confianza: ${confidence}%`,
    products.length > 0 ? `\nProductos (${products.length}):` : '',
    products.length > 0 ? productLines : '',
    `━━━━━━━━━━━━━━━━━━━━`,
    `⏱️ Aprobado por ${draft.reviewed_by || 'Tito'}`,
    `📌 Pendiente ingreso manual en GlobalPC`,
    ``,
    `<i>Está bien.</i>`,
  ].filter(Boolean).join('\n'))

  console.log(`  ✅ Filed: ${traficoId} · ${supplier}`)
  return true
}

// ── Main ──────────────────────────────────────────────

async function main() {
  const ts = new Date().toISOString()

  // Find drafts in approved_pending that are past the 5-second cancel window
  const cutoff = new Date(Date.now() - CANCEL_WINDOW_MS).toISOString()

  const { data: pendingDrafts, error } = await supabase
    .from('pedimento_drafts')
    .select('id, trafico_id, draft_data, status, reviewed_by, updated_at, created_at')
    .eq('status', 'approved_pending')
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true })

  if (error) {
    console.error(`❌ Query failed: ${error.message}`)
    await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${error.message}`)
    process.exit(1)
  }

  if (!pendingDrafts || pendingDrafts.length === 0) {
    // Silent exit — no pending drafts
    process.exit(0)
  }

  console.log(`📋 Filing Processor — ${pendingDrafts.length} draft(s) ready`)

  let filed = 0
  let errors = 0

  for (const draft of pendingDrafts) {
    try {
      const success = await processDraft(draft)
      if (success) filed++
      else errors++
    } catch (err) {
      console.error(`  ❌ ${draft.id.substring(0, 8)}: ${err.message}`)
      errors++
    }
  }

  // Log run
  if (filed > 0 || errors > 0) {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME,
      status: errors > 0 ? 'partial' : 'success',
      details: { filed, errors, total: pendingDrafts.length },
    }).then(() => {}, () => {})
  }

  if (errors > 0) {
    await sendTelegram(`🟡 ${SCRIPT_NAME}: ${filed} filed, ${errors} errors`)
  }

  // Log to Operational Brain
  try {
    const { logDecision } = require('./decision-logger')
    await logDecision({ decision_type: 'approval', decision: `${filed} filed, ${errors} errors`, reasoning: 'Tito approved via Telegram' })
  } catch {}

  console.log(`✅ Filing complete: ${filed} filed, ${errors} errors`)
  process.exit(0)
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${err.message}`)
  process.exit(1)
})
