require('dotenv').config({ path: '.env.local' })

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const MODEL = 'qwen3.5:35b'

// All 61 document types CRUZ recognizes
const ALL_DOC_TYPES = [
  'factura_comercial', 'packing_list', 'bill_of_lading', 'purchase_order',
  'cove', 'mve_folio', 'comprobante_pago', 'cfdi_xml', 'vucem_acuse',
  'usmca_cert', 'eur1', 'pais_origen_declaration',
  'complemento_carta_porte', 'cfdi_traslado',
  'nom_cert', 'cofepris_permit', 'semarnat_permit', 'se_permit', 'immex_auth',
  'carta_porte', 'airway_bill', 'insurance_cert', 'bl_mexicano',
  'proof_of_payment', 'freight_invoice', 'bank_transfer',
  'poder_notarial', 'rfc_document', 'acta_constitutiva',
  'msds', 'technical_datasheet', 'photos', 'damage_report',
  'purchase_contract', 'maquila_agreement', 'supply_agreement',
  'rectificacion', 'escrito_libre', 'note_of_protest', 'inspection_report',
  'cert_analysis', 'cert_conformity', 'lab_test', 'fumigation_cert',
  'weighing_cert', 'temperature_log', 'seal_cert', 'manifest', 'devan_report',
]

// Fast path — classify by filename patterns before hitting Ollama
const FILENAME_PATTERNS = [
  { pattern: /factura|invoice|fact/i,        type: 'factura_comercial' },
  { pattern: /packing|pack_list|packinglist/i, type: 'packing_list' },
  { pattern: /bill_of_lading|bol|b\.l\./i,   type: 'bill_of_lading' },
  { pattern: /purchase_order|p\.o\.|orden/i,  type: 'purchase_order' },
  { pattern: /cove|carta_valor/i,             type: 'cove' },
  { pattern: /mve|manifestacion_valor/i,      type: 'mve_folio' },
  { pattern: /cfdi|xml|comprobante/i,         type: 'cfdi_xml' },
  { pattern: /usmca|tmec|t-mec|origen/i,      type: 'usmca_cert' },
  { pattern: /pedimento/i,                    type: 'comprobante_pago' },
  { pattern: /nom_cert|norma_oficial/i,       type: 'nom_cert' },
  { pattern: /carta_porte|cartaporte/i,       type: 'carta_porte' },
  { pattern: /msds|hds|safety_data/i,         type: 'msds' },
  { pattern: /poder_notarial|poder/i,         type: 'poder_notarial' },
  { pattern: /seguro|insurance/i,             type: 'insurance_cert' },
  { pattern: /flete|freight/i,               type: 'freight_invoice' },
  { pattern: /foto|photo|imagen/i,            type: 'photos' },
  { pattern: /dano|damage|danio/i,            type: 'damage_report' },
  { pattern: /immex/i,                        type: 'immex_auth' },
]

function classifyByFilename(filename) {
  if (!filename) return null
  const lower = filename.toLowerCase()
  for (const { pattern, type } of FILENAME_PATTERNS) {
    if (pattern.test(lower)) {
      return { type, confidence: 0.95, source: 'filename_pattern' }
    }
  }
  return null
}

async function checkOllama() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    })
    if (!res.ok) return false
    const data = await res.json()
    const hasModel = data.models?.some(m => m.name.includes('qwen'))
    return hasModel
  } catch {
    return false
  }
}

async function classifyWithOllama(filename, contentPreview) {
  const prompt = `You are a Mexico customs document classifier for a customs brokerage firm.

Classify this document into exactly ONE type from the list below.
Return ONLY the type name, nothing else. No explanation.

Document filename: ${filename || 'unknown'}
Content preview: ${contentPreview || 'not available'}

Document types:
${ALL_DOC_TYPES.join(', ')}

Return only one of the above type names:`

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 20 }
      }),
      signal: AbortSignal.timeout(15000)
    })

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)
    const data = await res.json()
    const response = data.response?.trim().toLowerCase().replace(/[^a-z_]/g, '')

    if (ALL_DOC_TYPES.includes(response)) {
      return { type: response, confidence: 0.88, source: 'qwen3.5:35b' }
    }

    // Partial match
    const partial = ALL_DOC_TYPES.find(t => response.includes(t) || t.includes(response))
    if (partial) {
      return { type: partial, confidence: 0.72, source: 'qwen3.5:35b_partial' }
    }

    return null
  } catch (e) {
    console.error('Ollama error:', e.message)
    return null
  }
}

async function classifyDocument(filename, contentPreview) {
  // Step 1: Try filename patterns first (free, instant)
  const patternResult = classifyByFilename(filename)
  if (patternResult) return patternResult

  // Step 2: Try Ollama (free, local, ~1-2 seconds)
  const ollamaAvailable = await checkOllama()
  if (ollamaAvailable) {
    const ollamaResult = await classifyWithOllama(filename, contentPreview)
    if (ollamaResult && ollamaResult.confidence >= 0.72) return ollamaResult
  }

  // Step 3: Fallback — unknown
  return { type: 'other_1', confidence: 0.0, source: 'fallback' }
}

async function runTest() {
  console.log('🤖 Testing Ollama Document Classifier...\n')

  const ollamaUp = await checkOllama()
  console.log(`Ollama (${OLLAMA_URL}): ${ollamaUp ? '✅ Connected' : '❌ Not running'}`)
  if (ollamaUp) console.log(`Model ${MODEL}: ✅ Available`)

  console.log('\n── Filename Pattern Tests (no Ollama needed):')
  const testFiles = [
    'NEXEO_FACTURA_2026-03.pdf',
    'packing_list_shipment_109.pdf',
    'EVCO_Bill_of_Lading_March.pdf',
    'USMCA_Certificate_Origin.pdf',
    'COVE287XWCZH5.pdf',
    'insurance_cargo_cert.pdf',
    'randomdocument_xyz.pdf',
  ]

  for (const filename of testFiles) {
    const result = await classifyDocument(filename, null)
    const icon = result.confidence >= 0.9 ? '✅' : result.confidence >= 0.7 ? '🟡' : '❓'
    console.log(`  ${icon} ${filename.padEnd(40)} → ${result.type} (${(result.confidence * 100).toFixed(0)}% · ${result.source})`)
  }

  if (ollamaUp) {
    console.log('\n── Ollama Test (ambiguous filename):')
    const result = await classifyDocument('document_scan_001.pdf', 'This is a certificate of origin for goods manufactured in the United States')
    console.log(`  Result: ${result.type} (${(result.confidence * 100).toFixed(0)}% · ${result.source})`)
  }

  console.log('\n✅ Classifier ready for GlobalPC pipeline')
}

module.exports = { classifyDocument, classifyByFilename, checkOllama }

if (require.main === module) {
  runTest().catch(console.error)
}
