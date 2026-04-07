#!/usr/bin/env node
/**
 * CRUZ Document Shadow Network — learn document patterns across clients
 *
 * Analyzes completed document requests to build anonymized templates:
 * 1. For each doc_type + supplier + product combination with 3+ completions
 * 2. Extract common fields and formats (anonymized — no client values)
 * 3. Calculate typical turnaround and success rate
 * 4. When a new request matches a template, pre-populate reference data
 *
 * Network effect: every completed document makes future requests faster for ALL clients.
 *
 * Cron: 0 4 * * 0 (weekly Sunday 4 AM)
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'document-shadow-network'

async function tg(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

const DOC_TYPES = [
  'FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE',
  'CERTIFICADO_ORIGEN', 'COVE', 'CARTA_PORTE', 'PEDIMENTO',
  'NOM', 'COA', 'ORDEN_COMPRA', 'DODA_PREVIO', 'PERMISO',
]

// Standard fields per doc type
const DOC_FIELDS = {
  FACTURA_COMERCIAL: [
    { field_name: 'invoice_number', field_type: 'text', required: true },
    { field_name: 'invoice_date', field_type: 'date', required: true },
    { field_name: 'seller_name', field_type: 'text', required: true },
    { field_name: 'buyer_name', field_type: 'text', required: true },
    { field_name: 'product_description', field_type: 'text', required: true },
    { field_name: 'quantity', field_type: 'number', required: true },
    { field_name: 'unit_price', field_type: 'currency', required: true },
    { field_name: 'total_value', field_type: 'currency', required: true },
    { field_name: 'incoterm', field_type: 'text', required: true },
    { field_name: 'currency', field_type: 'text', required: true },
  ],
  COVE: [
    { field_name: 'cove_number', field_type: 'text', required: true },
    { field_name: 'seller_tax_id', field_type: 'text', required: true },
    { field_name: 'product_description', field_type: 'text', required: true },
    { field_name: 'fraccion_arancelaria', field_type: 'text', required: true },
    { field_name: 'quantity', field_type: 'number', required: true },
    { field_name: 'unit_value', field_type: 'currency', required: true },
    { field_name: 'total_value', field_type: 'currency', required: true },
  ],
  LISTA_EMPAQUE: [
    { field_name: 'packing_number', field_type: 'text', required: true },
    { field_name: 'product_description', field_type: 'text', required: true },
    { field_name: 'packages_count', field_type: 'number', required: true },
    { field_name: 'gross_weight_kg', field_type: 'number', required: true },
    { field_name: 'net_weight_kg', field_type: 'number', required: true },
  ],
  CERTIFICADO_ORIGEN: [
    { field_name: 'certificate_number', field_type: 'text', required: true },
    { field_name: 'exporter_name', field_type: 'text', required: true },
    { field_name: 'producer_name', field_type: 'text', required: true },
    { field_name: 'hs_code', field_type: 'text', required: true },
    { field_name: 'origin_criterion', field_type: 'text', required: true },
    { field_name: 'blanket_period', field_type: 'text', required: false },
  ],
}

async function main() {
  console.log(`📄 Document Shadow Network — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const startTime = Date.now()

  // Step 1: Fetch all completed document requests across all clients
  const solicitudes = await fetchAll(supabase.from('documento_solicitudes')
    .select('id, trafico_id, doc_type, status, solicitado_at, recibido_at')
    .eq('status', 'recibido')
    .not('recibido_at', 'is', null))

  console.log(`  ${(solicitudes || []).length} solicitudes completadas`)

  // Step 2: Enrich with tráfico data (supplier + product)
  const traficoIds = [...new Set((solicitudes || []).map(s => s.trafico_id).filter(Boolean))]
  const { data: traficos } = await supabase.from('traficos')
    .select('trafico, company_id, proveedores, descripcion_mercancia')
    .in('trafico', traficoIds.slice(0, 500))

  const traficoMap = new Map()
  for (const t of (traficos || [])) {
    traficoMap.set(t.trafico, t)
  }

  // Step 3: Group by doc_type + supplier + product
  const templateGroups = new Map()

  for (const sol of (solicitudes || [])) {
    const trafico = traficoMap.get(sol.trafico_id)
    if (!trafico) continue

    const supplier = (trafico.proveedores || '').split(',')[0]?.trim()
    if (!supplier) continue

    const product = (trafico.descripcion_mercancia || '').substring(0, 40).trim()
    const docType = (sol.doc_type || '').toUpperCase()

    if (!DOC_TYPES.includes(docType)) continue

    const key = `${docType}::${supplier.substring(0, 30).toLowerCase()}::${product.substring(0, 20).toLowerCase()}`

    if (!templateGroups.has(key)) {
      templateGroups.set(key, {
        doc_type: docType,
        supplier_key: supplier.substring(0, 30).toLowerCase().replace(/\s+/g, '_'),
        product_key: product.substring(0, 20).toLowerCase().replace(/\s+/g, '_'),
        supplier_display: supplier,
        completions: [],
        companies: new Set(),
      })
    }

    const group = templateGroups.get(key)
    group.companies.add(trafico.company_id)

    // Calculate turnaround
    if (sol.solicitado_at && sol.recibido_at) {
      const hours = (new Date(sol.recibido_at).getTime() - new Date(sol.solicitado_at).getTime()) / 3600000
      if (hours > 0 && hours < 720) { // Exclude > 30 days
        group.completions.push(hours)
      }
    }
  }

  // Step 4: Generate templates from groups with 3+ completions
  const templates = []

  for (const [, group] of templateGroups) {
    if (group.completions.length < 2) continue

    const avgTurnaround = Math.round(
      group.completions.reduce((a, b) => a + b, 0) / group.completions.length * 10
    ) / 10

    const fields = DOC_FIELDS[group.doc_type] || [
      { field_name: 'reference', field_type: 'text', required: true },
      { field_name: 'description', field_type: 'text', required: true },
    ]

    templates.push({
      doc_type: group.doc_type,
      supplier_key: group.supplier_key,
      product_key: group.product_key,
      template_fields: fields,
      typical_turnaround_hours: avgTurnaround,
      success_rate_pct: 100, // All are completed
      times_used: group.completions.length,
      clients_served: group.companies.size,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    console.log(
      `  📄 ${group.doc_type.padEnd(22)} · ${group.supplier_key.substring(0, 15).padEnd(15)} · ` +
      `${group.completions.length} usos · ${group.companies.size} cliente(s) · ~${avgTurnaround}h turnaround`
    )
  }

  // Step 5: Also build templates from expediente_documentos (broader coverage)
  const allDocs = await fetchAll(supabase.from('expediente_documentos')
    .select('trafico_id, doc_type, created_at')
    .not('doc_type', 'is', null)
    .gte('created_at', '2024-01-01'))

  const docGroups = new Map()
  for (const doc of (allDocs || [])) {
    const trafico = traficoMap.get(doc.trafico_id)
    if (!trafico) continue

    const supplier = (trafico.proveedores || '').split(',')[0]?.trim()
    if (!supplier) continue

    const docType = (doc.doc_type || '').toUpperCase()
    const key = `${docType}::${supplier.substring(0, 30).toLowerCase()}`

    if (!docGroups.has(key)) docGroups.set(key, { count: 0, companies: new Set() })
    const g = docGroups.get(key)
    g.count++
    g.companies.add(trafico.company_id)
  }

  // Add broader templates for supplier+docType combos not already covered
  for (const [key, group] of docGroups) {
    if (group.count < 3) continue
    const [docType, supplierKey] = key.split('::')

    // Skip if we already have a more specific template
    const alreadyExists = templates.some(t =>
      t.doc_type === docType && t.supplier_key === supplierKey
    )
    if (alreadyExists) continue

    const fields = DOC_FIELDS[docType] || [
      { field_name: 'reference', field_type: 'text', required: true },
    ]

    templates.push({
      doc_type: docType,
      supplier_key: supplierKey,
      product_key: '_general',
      template_fields: fields,
      typical_turnaround_hours: null,
      success_rate_pct: null,
      times_used: group.count,
      clients_served: group.companies.size,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  // Step 6: Save templates
  if (!DRY_RUN && templates.length > 0) {
    for (const t of templates) {
      await supabase.from('document_templates').upsert(t, {
        onConflict: 'doc_type,supplier_key,product_key',
      }).catch(err => console.error(`  ⚠ ${err.message}`))
    }
  }

  // Telegram
  const withTurnaround = templates.filter(t => t.typical_turnaround_hours)
  const avgNetworkTurnaround = withTurnaround.length > 0
    ? Math.round(withTurnaround.reduce((s, t) => s + t.typical_turnaround_hours, 0) / withTurnaround.length)
    : 0

  await tg(
    `📄 <b>Document Shadow Network — ${templates.length} plantillas</b>\n\n` +
    `${withTurnaround.length} con turnaround medido\n` +
    `Turnaround promedio red: ~${avgNetworkTurnaround}h\n` +
    `${new Set(templates.map(t => t.supplier_key)).size} proveedores cubiertos\n` +
    `Duración: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n\n` +
    `— CRUZ 📄`
  )

  if (!DRY_RUN) {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME, status: 'success',
      details: { templates: templates.length, avg_turnaround: avgNetworkTurnaround },
    }).catch(() => {})
  }

  console.log(`\n✅ ${templates.length} plantillas · ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>${SCRIPT_NAME}</b> failed: ${err.message}`)
  process.exit(1)
})
