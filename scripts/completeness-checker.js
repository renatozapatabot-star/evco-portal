#!/usr/bin/env node
/**
 * CRUZ Completeness Checker
 * No AI needed — pure logic.
 *
 * Checks entrada_lifecycle for:
 *   1. Entradas without tráfico linkage (24h/48h escalation)
 *   2. Entradas with tráfico but missing required docs (FACTURA + LISTA_EMPAQUE minimum)
 *
 * Inserts notifications and document requests.
 * Logs all actions to pipeline_log.
 *
 * Usage: node scripts/completeness-checker.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'completeness-checker'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── Helpers ────────────────────────────────────────────────

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', msg.replace(/<[^>]+>/g, '')); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function logPipeline(step, status, details, durationMs) {
  const entry = {
    step: `${SCRIPT_NAME}:${step}`,
    status,
    input_summary: typeof details === 'string' ? details : JSON.stringify(details),
    timestamp: new Date().toISOString(),
    ...(durationMs != null && { duration_ms: durationMs }),
    ...(status === 'error' && {
      error_message: typeof details === 'object' ? (details.error || JSON.stringify(details)) : details
    })
  }
  await supabase.from('pipeline_log').insert(entry).then(({ error }) => {
    if (error) console.error('pipeline_log insert error:', error.message)
  })
}

function hoursAgo(dateStr) {
  if (!dateStr) return Infinity
  return (Date.now() - new Date(dateStr).getTime()) / 3600000
}

// ─── Check 1: Entradas without tráfico (CRITICAL only) ─────
// Noise reduction: only notify when entrada is genuinely stuck.
// Before: every unlinked entrada >24h → 800+ notifications/week, 0% read rate.
// Now: only notify if >7 days unlinked, OR supplier is in top-20 by volume.

async function getTop20Suppliers(companyId) {
  const { data } = await supabase
    .from('entrada_lifecycle')
    .select('supplier')
    .eq('company_id', companyId)
    .not('supplier', 'is', null)

  if (!data || data.length === 0) return new Set()

  const counts = {}
  for (const row of data) {
    const s = (row.supplier || '').trim().toLowerCase()
    if (s) counts[s] = (counts[s] || 0) + 1
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20)
  return new Set(sorted.map(([name]) => name))
}

async function checkUnlinkedEntradas() {
  console.log('\n── Check 1: Entradas sin tráfico (CRITICAL only)')

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Fetch all unlinked entradas older than 24h (to count total, but only notify critical)
  const { data: entradas, error } = await supabase
    .from('entrada_lifecycle')
    .select('id, entrada_number, created_at, company_id, supplier')
    .is('trafico_id', null)
    .lt('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('   ❌ Query error:', error.message)
    await logPipeline('check_unlinked', 'error', { error: error.message })
    return { checked: 0, notifications: 0 }
  }

  if (!entradas || entradas.length === 0) {
    console.log('   ✅ No unlinked entradas')
    await logPipeline('check_unlinked', 'success', { unlinked: 0 })
    return { checked: 0, notifications: 0 }
  }

  // Build top-20 suppliers set for critical filter
  const companyIds = [...new Set(entradas.map(e => e.company_id))]
  const top20ByCompany = {}
  for (const cid of companyIds) {
    top20ByCompany[cid] = await getTop20Suppliers(cid)
  }

  const criticalRows = []
  let skipped = 0

  for (const entrada of entradas) {
    const isOlderThan7Days = entrada.created_at < sevenDaysAgo
    const supplierNorm = (entrada.supplier || '').trim().toLowerCase()
    const isTopSupplier = supplierNorm && top20ByCompany[entrada.company_id]?.has(supplierNorm)

    // Only notify if CRITICAL: >7 days unlinked OR top-20 supplier
    if (!isOlderThan7Days && !isTopSupplier) {
      skipped++
      continue
    }

    const reason = isOlderThan7Days ? '7+ días sin tráfico' : `proveedor clave: ${entrada.supplier}`
    criticalRows.push({
      company_id: entrada.company_id,
      type: SCRIPT_NAME,
      severity: 'critical',
      title: `Entrada sin tráfico — ${reason}`,
      description: `Entrada ${entrada.entrada_number}: ${reason}`,
      read: false
    })
  }

  // Batch insert (chunks of 200)
  let notifications = 0
  for (let i = 0; i < criticalRows.length; i += 200) {
    const batch = criticalRows.slice(i, i + 200)
    const { error: insertErr } = await supabase.from('notifications').insert(batch)
    if (insertErr) {
      console.error(`   ⚠️  Batch notification insert error: ${insertErr.message}`)
    } else {
      notifications += batch.length
    }
  }

  console.log(`   Found: ${entradas.length} unlinked entradas (>24h)`)
  console.log(`   Critical notifications: ${criticalRows.length}`)
  console.log(`   Skipped (below threshold): ${skipped}`)

  await logPipeline('check_unlinked', 'success', {
    total_unlinked: entradas.length,
    critical_notifications: criticalRows.length,
    skipped
  })

  return { checked: entradas.length, notifications }
}

// ─── Check 2: Missing required documents ────────────────────

async function checkMissingDocuments() {
  console.log('\n── Check 2: Documentos faltantes')

  // expediente_documentos uses pedimento_id not trafico_id — join via entrada's trafico_id
  // Get linked entradas (limit to recent ones for performance)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: entradas, error } = await supabase
    .from('entrada_lifecycle')
    .select('id, entrada_number, trafico_id, company_id')
    .not('trafico_id', 'is', null)
    .gte('created_at', thirtyDaysAgo)
    .limit(1000)

  if (error) {
    console.error('   ❌ Query error:', error.message)
    await logPipeline('check_docs', 'error', { error: error.message })
    return { checked: 0, requests: 0 }
  }

  if (!entradas || entradas.length === 0) {
    console.log('   ✅ No linked entradas to check')
    await logPipeline('check_docs', 'success', { linked: 0 })
    return { checked: 0, requests: 0 }
  }

  // Batch-fetch all docs for all tráficos at once
  const traficoIds = [...new Set(entradas.map(e => e.trafico_id))]
  const docsByTrafico = {}

  // Fetch in batches of 200 trafico IDs
  for (let i = 0; i < traficoIds.length; i += 200) {
    const batch = traficoIds.slice(i, i + 200)
    const { data: docs } = await supabase
      .from('expediente_documentos')
      .select('pedimento_id, doc_type')
      .in('pedimento_id', batch)

    for (const doc of (docs || [])) {
      if (!docsByTrafico[doc.pedimento_id]) docsByTrafico[doc.pedimento_id] = []
      docsByTrafico[doc.pedimento_id].push((doc.doc_type || '').toUpperCase())
    }
  }

  let requests = 0
  let complete = 0
  const solicitudes = []

  for (const entrada of entradas) {
    const types = docsByTrafico[entrada.trafico_id] || []
    const hasFactura = types.some(t =>
      t.includes('FACTURA') || t === 'FACTURA_COMERCIAL'
    )
    const hasListaEmpaque = types.some(t =>
      t.includes('LISTA_EMPAQUE') || t.includes('PACKING') || t === 'PACKING_LIST'
    )

    if (hasFactura && hasListaEmpaque) {
      complete++
      continue
    }

    if (!hasFactura) {
      solicitudes.push({
        trafico_id: entrada.trafico_id,
        doc_type: 'FACTURA_COMERCIAL',
        company_id: entrada.company_id,
        status: 'solicitado'
      })
    }
    if (!hasListaEmpaque) {
      solicitudes.push({
        trafico_id: entrada.trafico_id,
        doc_type: 'LISTA_EMPAQUE',
        company_id: entrada.company_id,
        status: 'solicitado'
      })
    }
  }

  // Insert solicitudes one by one — unique constraint rejects duplicates gracefully
  for (const sol of solicitudes) {
    const { error: reqErr } = await supabase
      .from('documento_solicitudes')
      .insert(sol)

    if (reqErr) {
      if (reqErr.message.includes('duplicate') || reqErr.message.includes('unique') || reqErr.code === '23505') {
        // Already requested — skip silently
      } else {
        console.error(`   ⚠️  Solicitud insert error: ${reqErr.message}`)
      }
    } else {
      requests++
    }
  }

  console.log(`   Checked: ${entradas.length} linked entradas (last 30 days)`)
  console.log(`   Complete (factura + lista): ${complete}`)
  console.log(`   Document requests upserted: ${requests}`)

  await logPipeline('check_docs', 'success', {
    linked_entradas: entradas.length,
    complete,
    requests_created: requests
  })

  return { checked: entradas.length, requests }
}

// ─── Main ───────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log('\n📋 CRUZ Completeness Checker')
  console.log('═'.repeat(50))

  await logPipeline('startup', 'success', { started_at: new Date().toISOString() })

  const unlinked = await checkUnlinkedEntradas()
  const docs = await checkMissingDocuments()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n' + '═'.repeat(50))
  console.log('📊 SUMMARY')
  console.log(`   Unlinked entradas checked: ${unlinked.checked}`)
  console.log(`   Notifications created: ${unlinked.notifications}`)
  console.log(`   Linked entradas checked: ${docs.checked}`)
  console.log(`   Document requests created: ${docs.requests}`)
  console.log(`   Duration: ${elapsed}s`)

  await logPipeline('complete', 'success', {
    unlinked_checked: unlinked.checked,
    notifications: unlinked.notifications,
    docs_checked: docs.checked,
    doc_requests: docs.requests,
    duration_s: parseFloat(elapsed)
  })

  // Only alert if there are urgent items
  if (unlinked.notifications > 0 || docs.requests > 0) {
    await tg([
      `📋 <b>COMPLETENESS CHECK</b>`,
      `Notificaciones: ${unlinked.notifications}`,
      `Solicitudes doc: ${docs.requests}`,
      `Duración: ${elapsed}s`,
      `— CRUZ 🦀`
    ].join('\n'))
  }
}

run().catch(async (err) => {
  console.error('Fatal error:', err)
  await logPipeline('fatal', 'error', { error: err.message })
  await tg(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
