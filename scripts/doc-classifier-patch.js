// This script patches doc-classifier.js
const fs = require('fs')
const file = require('path').join(__dirname, 'doc-classifier.js')
let code = fs.readFileSync(file, 'utf8')

// ── PATCH 1: Expand VALID_TYPES ──
const OLD_TYPES = `const VALID_TYPES = [
  'FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE',
  'CERTIFICADO_ORIGEN', 'CARTA_PORTE', 'MANIFESTACION_VALOR',
  'PEDIMENTO', 'NOM', 'COA', 'OTRO'
]`

const NEW_TYPES = `const VALID_TYPES = [
  'FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE',
  'CERTIFICADO_ORIGEN', 'CARTA_PORTE', 'MANIFESTACION_VALOR',
  'PEDIMENTO', 'NOM', 'COA', 'ORDEN_COMPRA', 'ENTRADA_BODEGA',
  'GUIA_EMBARQUE', 'PERMISO', 'PROFORMA', 'DODA_PREVIO', 'OTRO'
]`

if (!code.includes(OLD_TYPES)) {
  console.error('❌ Could not find VALID_TYPES block to patch')
  process.exit(1)
}
code = code.replace(OLD_TYPES, NEW_TYPES)
console.log('✅ PATCH 1: VALID_TYPES expanded (10 → 16 types)')

// ── PATCH 2: Improve classifier prompt ──
const OLD_PROMPT = `  const prompt = \`Classify this customs document. Reply with ONLY a JSON object, nothing else:
{"type": "FACTURA_COMERCIAL", "supplier": "company name or null", "confidence": 0.9}

Valid types: FACTURA_COMERCIAL, LISTA_EMPAQUE, CONOCIMIENTO_EMBARQUE, CERTIFICADO_ORIGEN, CARTA_PORTE, MANIFESTACION_VALOR, PEDIMENTO, NOM, COA, OTRO

Document text:
\${preview}\``

const NEW_PROMPT = `  const prompt = \`Classify this Mexican customs/trade document. Reply with ONLY a JSON object, nothing else.

Types and what they are:
- FACTURA_COMERCIAL: commercial invoice (any invoice, proforma invoice with values, "INV", "invoice", "factura")
- LISTA_EMPAQUE: packing list (weights, pieces, boxes, "packing list", "lista de empaque")
- CONOCIMIENTO_EMBARQUE: bill of lading, airway bill, tracking doc ("BL", "AWB", "BOL", "guia de embarque")
- CERTIFICADO_ORIGEN: certificate of origin, USMCA, T-MEC ("certificate of origin", "certificado")
- CARTA_PORTE: Mexican transport document ("carta porte", "CFDI traslado")
- MANIFESTACION_VALOR: customs value declaration ("manifestacion de valor", "MV_", "MVE")
- PEDIMENTO: Mexican customs filing ("pedimento", 15-digit number with spaces)
- NOM: Mexican standards compliance ("NOM-", "norma oficial")
- COA: certificate of analysis (lab results, chemical composition, "certificate of analysis")
- ORDEN_COMPRA: purchase order ("PO", "purchase order", "orden de compra", "PO #")
- ENTRADA_BODEGA: warehouse receipt, receiving doc ("entrada de bodega", "warehouse receipt", "recibo de almacen")
- GUIA_EMBARQUE: shipping guide, carrier tracking ("guia", "tracking", "carrier receipt")
- PERMISO: import/export permit, health permit ("permiso", "COFEPRIS", "permiso de salud")
- PROFORMA: proforma invoice without final values ("proforma", "pro forma", "PI-")
- DODA_PREVIO: pre-clearance document ("DODA", "despacho previo")
- OTRO: use ONLY if the document truly does not match any type above

Reply format:
{"type": "TYPE_HERE", "supplier": "company name or null", "confidence": 0.0}

Document text:
\${preview}\``

if (!code.includes('Classify this customs document. Reply with ONLY a JSON object')) {
  console.error('❌ Could not find prompt block to patch')
  process.exit(1)
}
code = code.replace(
  /  const prompt = `Classify this customs document[\s\S]*?\$\{preview\}`/,
  NEW_PROMPT
)
console.log('✅ PATCH 2: Prompt expanded with type descriptions')

// ── PATCH 3: Increase text preview from 500 to 800 chars ──
code = code.replace(
  'const preview = text.substring(0, 500)',
  'const preview = text.substring(0, 800)'
)
console.log('✅ PATCH 3: Preview increased 500 → 800 chars')

// ── Write ──
fs.writeFileSync(file, code)
console.log('\n✅ doc-classifier.js patched successfully')
console.log('   Types: 10 → 16')
console.log('   Prompt: descriptive with examples')
console.log('   Preview: 500 → 800 chars')
