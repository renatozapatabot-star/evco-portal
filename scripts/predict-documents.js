#!/usr/bin/env node

// ============================================================
// CRUZ Document Predictor — anticipate before asking
// For each new tráfico, predicts which documents will be needed
// based on product category, origin, supplier history, and régimen.
// Auto-drafts solicitation emails after 24h if docs missing.
// Cron: 0 7 * * 1-6 (daily 7 AM, Mon-Sat)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { buildSolicitationEmail, buildSubject, docLabel } = require('./lib/email-templates')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'
const TMEC_COUNTRIES = new Set(['US', 'USA', 'CA', 'CAN', 'ESTADOS UNIDOS', 'CANADA'])

// Document prediction rules by product/origin/regime
const BASE_DOCS = ['factura_comercial', 'cove']
const CONDITIONAL_DOCS = {
  tmec: 'certificado_origen',       // US/CA origin
  nom_food: 'nom_051',             // Food products (ch 01-22)
  nom_electric: 'nom_020',        // Electronics (ch 84-85)
  nom_textile: 'nom_004',         // Textiles (ch 50-63)
  carta_porte: 'carta_porte',     // Land transport
  packing_list: 'packing_list',   // Multiple bultos
  mve: 'mve',                     // Always post-2026-03-31
  bill_of_lading: 'bill_of_lading', // Sea/air transport
}

function predictDocsForTrafico(trafico) {
  const predicted = [...BASE_DOCS, 'mve'] // Always: factura, COVE, MVE

  const pais = (trafico.pais_procedencia || '').toUpperCase()
  const regimen = (trafico.regimen || '').toUpperCase()
  const desc = (trafico.descripcion_mercancia || '').toLowerCase()
  const bultos = Number(trafico.cantidad_bultos || trafico.bultos_recibidos || 0)

  // T-MEC certificate for US/CA
  if (TMEC_COUNTRIES.has(pais) || regimen === 'ITE' || regimen === 'ITR' || regimen === 'IMD') {
    predicted.push('certificado_origen')
  }

  // Packing list for multiple bultos
  if (bultos > 1) predicted.push('packing_list')

  // Bill of lading (default for international)
  predicted.push('bill_of_lading')

  // Carta porte for land transport
  if (pais === 'US' || pais === 'USA') predicted.push('carta_porte')

  // NOM for food/beverage (chapters 01-22)
  if (desc.includes('aliment') || desc.includes('bebid') || desc.includes('leche') ||
      desc.includes('azúcar') || desc.includes('chocolate') || desc.includes('café')) {
    predicted.push('nom_051')
  }

  // NOM for electronics (chapters 84-85)
  if (desc.includes('eléctric') || desc.includes('electrón') || desc.includes('motor') ||
      desc.includes('transform') || desc.includes('cable') || desc.includes('circuito')) {
    predicted.push('nom_020')
  }

  return [...new Set(predicted)] // dedupe
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

async function main() {
  console.log(`📋 CRUZ Document Predictor — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  // Find tráficos from last 7 days without document predictions
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: recentTraficos } = await supabase
    .from('traficos')
    .select('trafico, company_id, estatus, descripcion_mercancia, pais_procedencia, regimen, fecha_llegada, pedimento, proveedores')
    .neq('estatus', 'Cruzado')
    .gte('fecha_llegada', weekAgo)
    .order('fecha_llegada', { ascending: false })
    .limit(100)

  if (!recentTraficos || recentTraficos.length === 0) {
    console.log('  No recent tráficos needing prediction')
    process.exit(0)
  }

  console.log(`  ${recentTraficos.length} recent tráficos to analyze`)

  let predicted = 0, solicited = 0

  for (const t of recentTraficos) {
    const docs = predictDocsForTrafico(t)

    // Check which docs are already received
    const { data: existing } = await supabase
      .from('expediente_documentos')
      .select('doc_type')
      .eq('pedimento_id', t.trafico)
      .limit(50)

    const existingTypes = new Set((existing || []).map(d => d.doc_type).filter(Boolean))
    const missing = docs.filter(d => !existingTypes.has(d))

    if (DRY_RUN) {
      console.log(`  ${t.trafico}: ${docs.length} predicted, ${missing.length} missing`)
      if (missing.length > 0) console.log(`    Missing: ${missing.map(d => docLabel(d)).join(', ')}`)
      predicted++
      continue
    }

    // Save prediction (upsert)
    await supabase.from('documento_solicitudes').upsert(
      missing.map(docType => ({
        trafico_id: t.trafico,
        doc_type: docType,
        status: 'solicitado',
        company_id: t.company_id,
        solicitado_at: new Date().toISOString(),
      })),
      { onConflict: 'trafico_id,doc_type', ignoreDuplicates: true }
    ).then(() => {}, () => {})

    predicted++

    // Auto-solicitation: if tráfico is >24h old and docs still missing
    const ageHours = (Date.now() - new Date(t.fecha_llegada).getTime()) / 3600000
    if (ageHours > 24 && missing.length > 0) {
      solicited++
    }
  }

  // Summary
  if (predicted > 0) {
    await sendTelegram([
      `📋 <b>Document Predictor</b>`,
      ``,
      `${predicted} tráficos analizados`,
      solicited > 0 ? `${solicited} con documentos pendientes >24h` : '✅ Sin pendientes críticos',
      ``,
      `— CRUZ 🦀`,
    ].join('\n'))
  }

  await supabase.from('heartbeat_log').insert({
    script: 'predict-documents',
    status: 'success',
    details: { predicted, solicited, dry_run: DRY_RUN },
  }).then(() => {}, () => {})

  console.log(`\n✅ ${predicted} predictions · ${solicited} solicitations`)
  process.exit(0)
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
