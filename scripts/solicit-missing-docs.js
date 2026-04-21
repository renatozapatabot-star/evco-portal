#!/usr/bin/env node
/**
 * CRUZ — Automated Document Solicitation Draft Generator
 *
 * Queries traficos with incomplete expedientes, identifies which document
 * types are missing, drafts professional Spanish emails, and saves them
 * to pedimento_drafts with status='pending_approval'.
 *
 * CRUZ proposes. Tito approves. Nothing sends without approval.
 *
 * Flow:
 *   1. Query recent traficos → check expediente_documentos coverage
 *   2. For each tráfico with missing docs → draft solicitation email
 *   3. Save draft to pedimento_drafts (status='pending_approval')
 *   4. Insert documento_solicitudes rows (if not already present)
 *   5. Telegram notification: "X solicitudes listas para revisión"
 *   6. Tito reviews via /aprobar → solicitud-email.js sends
 *
 * Usage:
 *   node scripts/solicit-missing-docs.js            # Production run
 *   node scripts/solicit-missing-docs.js --dry-run   # Preview only, no DB writes
 *
 * Cron: 0 3 * * *  (3 AM nightly, after completeness-checker at 2:30 AM)
 *
 * Patente 3596 · Aduana 240 · Nuevo Laredo
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { buildSolicitationEmail, buildSubject, buildTelegramSummary, docLabel } = require('./lib/email-templates')

const { emitEvent } = require('./lib/workflow-emitter')
const SCRIPT_NAME = 'solicit-missing-docs'
const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Required documents per régimen ──
// Loaded from doc_requirements table (Build 0 migration).
// Falls back to hardcoded defaults if table is empty or query fails.

const FALLBACK_REQUIRED_DOCS = {
  DEFAULT: ['FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE'],
  A1: ['FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE', 'MANIFESTACION_VALOR'],
  ITE: ['FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE'],
  ITR: ['FACTURA_COMERCIAL', 'LISTA_EMPAQUE'],
  IMD: ['FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE', 'MANIFESTACION_VALOR'],
}

let REQUIRED_DOCS = null

async function loadDocRequirements() {
  try {
    const { data, error } = await supabase
      .from('doc_requirements')
      .select('fraccion_prefix, regimen, required_docs')
      .order('fraccion_prefix', { ascending: true })

    if (error || !data || data.length === 0) {
      console.log('  doc_requirements table empty — using fallback')
      REQUIRED_DOCS = FALLBACK_REQUIRED_DOCS
      return
    }

    // Build lookup: regimen → required_docs (use DEFAULT prefix entries)
    const lookup = {}
    for (const row of data) {
      if (row.fraccion_prefix === 'DEFAULT') {
        lookup[row.regimen] = row.required_docs
      }
    }
    lookup.DEFAULT = lookup.DEFAULT || FALLBACK_REQUIRED_DOCS.DEFAULT
    REQUIRED_DOCS = lookup
    console.log(`  Loaded doc_requirements: ${Object.keys(lookup).length} régimen(s)`)
  } catch (err) {
    console.error(`  doc_requirements load failed: ${err.message} — using fallback`)
    REQUIRED_DOCS = FALLBACK_REQUIRED_DOCS
  }
}

// ── Client contacts (multi-tenant ready) ──

const CLIENT_CONTACTS = {
  evco: {
    name: 'Ursula Banda',
    email: 'ursula.banda@evco.com.mx',
    company: 'EVCO Plastics de México',
  },
  // mafesa: { name: '...', email: '...', company: 'MAFESA' }
}

// ── Helpers ──

function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

async function sendTelegram(message) {
  if (DRY_RUN) { console.log('[TG dry-run]', message.replace(/<[^>]+>/g, '')); return }
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', message.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' }),
    })
  } catch (e) {
    console.error('Telegram error:', e.message)
  }
}

async function logPipeline(step, status, details) {
  if (DRY_RUN) return
  await supabase.from('pipeline_log').insert({
    step: `${SCRIPT_NAME}:${step}`,
    status,
    input_summary: JSON.stringify(details),
    timestamp: new Date().toISOString(),
    ...(status === 'error' && { error_message: details?.error || JSON.stringify(details) }),
  }).catch((err) => console.error('pipeline_log error:', err.message))
}

// ── Step 1: Find traficos with incomplete expedientes ──

async function findIncompleteExpedientes() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Get recent traficos that are still active (En Proceso)
  const { data: traficos, error } = await supabase
    .from('traficos')
    .select('id, trafico_id, company_id, regimen')
    .in('estatus', ['En Proceso', 'en proceso', 'EN PROCESO'])
    .gte('fecha_llegada', thirtyDaysAgo)
    .limit(500)

  if (error) throw new Error(`traficos query failed: ${error.message}`)
  if (!traficos || traficos.length === 0) return []

  // Batch-fetch all existing documents for these traficos
  const traficoIds = traficos.map(t => t.trafico_id)
  const docsByTrafico = {}

  for (let i = 0; i < traficoIds.length; i += 200) {
    const batch = traficoIds.slice(i, i + 200)
    const { data: docs } = await supabase
      .from('expediente_documentos')
      .select('pedimento_id, doc_type')
      .in('pedimento_id', batch)

    for (const doc of (docs || [])) {
      if (!docsByTrafico[doc.pedimento_id]) docsByTrafico[doc.pedimento_id] = new Set()
      docsByTrafico[doc.pedimento_id].add((doc.doc_type || '').toUpperCase())
    }
  }

  // Also check documento_solicitudes to avoid re-soliciting
  const { data: existingSolicitudes } = await supabase
    .from('documento_solicitudes')
    .select('trafico_id, doc_type, status')
    .in('trafico_id', traficoIds)
    .in('status', ['solicitado', 'recibido'])

  const alreadySolicited = new Set()
  for (const s of (existingSolicitudes || [])) {
    alreadySolicited.add(`${s.trafico_id}:${s.doc_type}`)
  }

  // Identify missing docs for each tráfico
  const incomplete = []

  for (const trafico of traficos) {
    const regimen = (trafico.regimen || '').toUpperCase()
    const required = REQUIRED_DOCS[regimen] || REQUIRED_DOCS.DEFAULT
    const existing = docsByTrafico[trafico.trafico_id] || new Set()

    const missing = required.filter(docType => {
      if (existing.has(docType)) return false
      // Skip if already solicited and not yet vencido
      if (alreadySolicited.has(`${trafico.trafico_id}:${docType}`)) return false
      return true
    })

    if (missing.length > 0) {
      incomplete.push({
        traficoId: trafico.trafico_id,
        companyId: trafico.company_id,
        regimen: regimen || 'DEFAULT',
        missingDocs: missing,
        existingDocs: [...existing],
        coverage: existing.size / required.length,
      })
    }
  }

  return incomplete
}

// ── Step 2: Create drafts for approval ──

async function createDrafts(incompleteList) {
  let draftsCreated = 0
  let solicitudesCreated = 0
  let skipped = 0
  const telegramItems = []

  for (const item of incompleteList) {
    const contact = CLIENT_CONTACTS[item.companyId]
    if (!contact) {
      console.log(`   ⚠️  No contact for ${item.companyId} — skipping ${item.traficoId}`)
      skipped++
      continue
    }

    // Build email HTML for the draft
    const emailHtml = buildSolicitationEmail({
      contactName: contact.name,
      companyName: contact.company,
      traficoId: item.traficoId,
      missingDocs: item.missingDocs,
      deadlineDays: 5,
    })

    const subject = buildSubject(item.traficoId, item.missingDocs.length)

    const draftData = {
      type: 'documento_solicitud',
      trafico_id: item.traficoId,
      company_id: item.companyId,
      contact: {
        name: contact.name,
        email: contact.email,
        company: contact.company,
      },
      missing_docs: item.missingDocs,
      missing_docs_labels: item.missingDocs.map(d => docLabel(d)),
      existing_docs: item.existingDocs,
      coverage_before: Math.round(item.coverage * 100),
      regimen: item.regimen,
      email: {
        subject,
        html: emailHtml,
        to: contact.email,
        from: 'Renato Zapata & Co. <ai@renatozapata.com>',
      },
      source: SCRIPT_NAME,
      generated_at: new Date().toISOString(),
    }

    if (DRY_RUN) {
      console.log(`   📝 [DRY-RUN] ${item.traficoId} → ${item.missingDocs.join(', ')}`)
      console.log(`      To: ${contact.email} | Coverage: ${Math.round(item.coverage * 100)}%`)
      draftsCreated++
      telegramItems.push({ traficoId: item.traficoId, missingDocs: item.missingDocs, contactName: contact.name })
      continue
    }

    // Insert draft — pending Tito's approval
    const { error: draftErr } = await supabase.from('pedimento_drafts').insert({
      trafico_id: item.traficoId,
      draft_data: draftData,
      status: 'pending_approval',
      created_by: 'CRUZ',
    })

    if (draftErr) {
      // Check for duplicate — same tráfico may already have a pending solicitation draft
      if (draftErr.code === '23505' || draftErr.message.includes('duplicate')) {
        console.log(`   ↩️  Draft already exists for ${item.traficoId} — skipping`)
        skipped++
        continue
      }
      console.error(`   ❌ Draft insert failed for ${item.traficoId}: ${draftErr.message}`)
      continue
    }

    draftsCreated++

    // Insert documento_solicitudes rows (unique constraint handles duplicates)
    for (const docType of item.missingDocs) {
      const { error: solErr } = await supabase.from('documento_solicitudes').insert({
        trafico_id: item.traficoId,
        doc_type: docType,
        company_id: item.companyId,
        status: 'solicitado',
      })

      if (solErr && !solErr.message.includes('duplicate') && !solErr.message.includes('unique') && solErr.code !== '23505') {
        console.error(`   ⚠️  Solicitud insert error: ${solErr.message}`)
      } else if (!solErr) {
        solicitudesCreated++
      }
    }

    // Audit log
    await supabase.from('audit_log').insert({
      action: 'documento_solicitud_draft_created',
      entity_type: 'pedimento_draft',
      entity_id: item.traficoId,
      details: {
        missing_docs: item.missingDocs,
        coverage_before: Math.round(item.coverage * 100),
        regimen: item.regimen,
        contact_email: contact.email,
      },
      company_id: item.companyId,
    }).catch(() => {})

    // Emit workflow event (CRUZ 2.0 orchestration)
    // Guard: if no missing docs, nothing to solicit — emit expediente_complete instead
    if (!Array.isArray(item.missingDocs) || item.missingDocs.length === 0) {
      await emitEvent('docs', 'expediente_complete', item.traficoId, item.companyId, {
        completeness_pct: 100,
        reason: 'solicit-missing-docs: nothing to solicit',
      })
    } else {
      await emitEvent('docs', 'solicitation_sent', item.traficoId, item.companyId, {
        missing_document_types: item.missingDocs,
        contact_email: contact.email,
        coverage_before: Math.round(item.coverage * 100),
      })
    }

    telegramItems.push({ traficoId: item.traficoId, missingDocs: item.missingDocs, contactName: contact.name })
    console.log(`   ✅ ${item.traficoId} → ${item.missingDocs.length} docs, draft saved`)
  }

  return { draftsCreated, solicitudesCreated, skipped, telegramItems }
}

// ── Main ──

async function run() {
  const startTime = Date.now()
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''

  console.log(`\n📄 ${prefix}CRUZ — Solicitud de Documentos Faltantes`)
  console.log(`   ${nowCST()}`)
  console.log(`   Patente 3596 · Aduana 240`)
  console.log('═'.repeat(55))

  await logPipeline('startup', 'success', { mode: DRY_RUN ? 'dry-run' : 'production' })

  // Load doc requirements from database (falls back to hardcoded defaults)
  await loadDocRequirements()

  // Step 1: Find incomplete expedientes
  console.log('\n── Paso 1: Identificar expedientes incompletos')
  const incomplete = await findIncompleteExpedientes()

  if (incomplete.length === 0) {
    console.log('   ✅ Todos los tráficos activos tienen documentación completa')
    await logPipeline('complete', 'success', { incomplete: 0 })
    process.exit(0)
  }

  console.log(`   Encontrados: ${incomplete.length} tráficos con documentos faltantes`)

  // Step 2: Create drafts
  console.log('\n── Paso 2: Generar borradores de solicitud')
  const { draftsCreated, solicitudesCreated, skipped, telegramItems } = await createDrafts(incomplete)

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '═'.repeat(55))
  console.log(`📊 ${prefix}RESUMEN`)
  console.log(`   Tráficos revisados: ${incomplete.length}`)
  console.log(`   Borradores creados: ${draftsCreated}`)
  console.log(`   Solicitudes de documentos: ${solicitudesCreated}`)
  console.log(`   Omitidos (duplicados/sin contacto): ${skipped}`)
  console.log(`   Duración: ${elapsed}s`)

  await logPipeline('complete', draftsCreated > 0 ? 'success' : 'partial', {
    traficos_checked: incomplete.length,
    drafts_created: draftsCreated,
    solicitudes_created: solicitudesCreated,
    skipped,
    duration_s: parseFloat(elapsed),
  })

  // Log to Operational Brain
  try {
    const { logDecision } = require('./decision-logger')
    if (telegramItems.length > 0) await logDecision({ decision_type: 'solicitation', decision: `${telegramItems.length} solicitudes creadas`, reasoning: 'Documentos faltantes detectados automáticamente' })
  } catch {}

  // Telegram notification — only if drafts were created
  if (telegramItems.length > 0) {
    await sendTelegram(buildTelegramSummary(telegramItems))
  }
}

run().catch(async (err) => {
  console.error('Fatal:', err)
  await logPipeline('fatal', 'error', { error: err.message })
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
