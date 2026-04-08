/**
 * CRUZ Document Type Registry
 *
 * Canonical document types for Mexican customs operations (Patente 3596).
 * Source of truth: doc-classifier.js 16 types + GlobalPC document_type labels.
 *
 * The `documents` table uses GlobalPC labels (e.g., "FACTURA", "LISTA DE EMPAQUE").
 * The `document_classifications` table uses normalized keys (e.g., "FACTURA_COMERCIAL").
 * This module bridges both worlds.
 */

// Criticality levels for document completeness validation
// CRITICAL = blocks pedimento filing — cannot proceed without these
// REQUIRED = needed before crossing but pedimento can draft without them
// OPTIONAL = supplementary, nice-to-have
const CRITICALITY = {
  CRITICAL: 'critical',
  REQUIRED: 'required',
  OPTIONAL: 'optional',
}

/**
 * Canonical document types with criticality and GlobalPC label mappings.
 * The `labels` array maps GlobalPC document_type values to canonical types.
 */
const DOCUMENT_TYPES = [
  // ── CRITICAL: blocks pedimento filing ──
  { key: 'FACTURA_COMERCIAL',    criticality: CRITICALITY.CRITICAL, labels: ['FACTURA', 'FACTURA DOLARES', 'FACTURA PESOS'] },
  { key: 'LISTA_EMPAQUE',       criticality: CRITICALITY.CRITICAL, labels: ['LISTA DE EMPAQUE'] },
  { key: 'CONOCIMIENTO_EMBARQUE', criticality: CRITICALITY.CRITICAL, labels: ['INBOND'] },
  { key: 'MANIFESTACION_VALOR', criticality: CRITICALITY.CRITICAL, labels: ['MANIFESTACION DE VALOR'] },

  // ── REQUIRED: needed before crossing ──
  { key: 'CERTIFICADO_ORIGEN',  criticality: CRITICALITY.REQUIRED, labels: ['TLC'] },
  { key: 'CARTA_PORTE',         criticality: CRITICALITY.REQUIRED, labels: ['CARTA'] },
  { key: 'PEDIMENTO',           criticality: CRITICALITY.REQUIRED, labels: ['PEDIMENTO', 'PEDIMENTO DETALLADO', 'PEDIMENTO SIMPLIFICADO'] },
  { key: 'HOJA_CALCULO',        criticality: CRITICALITY.REQUIRED, labels: ['HOJA DE CALCULO'] },

  // ── OPTIONAL: supplementary ──
  { key: 'NOM',                 criticality: CRITICALITY.OPTIONAL, labels: ['SOLICITUD NOM-050-SCFI-2004'] },
  { key: 'COA',                 criticality: CRITICALITY.OPTIONAL, labels: [] },
  { key: 'ORDEN_COMPRA',        criticality: CRITICALITY.OPTIONAL, labels: [] },
  { key: 'ENTRADA_BODEGA',      criticality: CRITICALITY.OPTIONAL, labels: [] },
  { key: 'GUIA_EMBARQUE',       criticality: CRITICALITY.OPTIONAL, labels: [] },
  { key: 'PERMISO',             criticality: CRITICALITY.OPTIONAL, labels: [] },
  { key: 'PROFORMA',            criticality: CRITICALITY.OPTIONAL, labels: [] },
  { key: 'DODA_PREVIO',         criticality: CRITICALITY.OPTIONAL, labels: ['QR DODA'] },

  // ── Electronic filing docs (always present for completed ops) ──
  { key: 'ACUSE_COVE',          criticality: CRITICALITY.OPTIONAL, labels: ['ACUSE DE COVE', 'ACUSE DE COVE (OFICIAL VUCEM)'] },
  { key: 'DETALLE_COVE',        criticality: CRITICALITY.OPTIONAL, labels: ['DETALLE DE COVE'] },
  { key: 'XML_COVE',            criticality: CRITICALITY.OPTIONAL, labels: ['XML DE COVE'] },
  { key: 'ACUSE_EDOCUMENT',     criticality: CRITICALITY.OPTIONAL, labels: ['ACUSE DE E-DOCUMENT', 'ACUSE DE E-DOCUMENT (OFICIAL VUCEM)'] },
  { key: 'XML_FACTURA',         criticality: CRITICALITY.OPTIONAL, labels: ['XML DE FACTURA'] },
  { key: 'ARCHIVOS_VALIDACION', criticality: CRITICALITY.OPTIONAL, labels: ['ARCHIVOS DE VALIDACION'] },
  { key: 'CARTA_SOLICITUD',     criticality: CRITICALITY.OPTIONAL, labels: ['CARTA DE SOLICITUD'] },
]

// Build reverse lookup: GlobalPC label → canonical key
const LABEL_TO_KEY = {}
for (const dt of DOCUMENT_TYPES) {
  for (const label of dt.labels) {
    LABEL_TO_KEY[label] = dt.key
  }
}

/**
 * Validate document completeness for a trafico.
 *
 * @param {string[]} presentLabels - GlobalPC document_type values found for the trafico
 * @returns {{ total_types: number, present: string[], missing_critical: string[], missing_required: string[], missing_optional: string[], completeness_pct: number, blocked: boolean }}
 */
function validateCompleteness(presentLabels) {
  // Map GlobalPC labels to canonical keys
  const presentKeys = new Set()
  for (const label of presentLabels) {
    const key = LABEL_TO_KEY[label]
    if (key) presentKeys.add(key)
  }

  const missing_critical = []
  const missing_required = []
  const missing_optional = []
  const present = []

  for (const dt of DOCUMENT_TYPES) {
    if (presentKeys.has(dt.key)) {
      present.push(dt.key)
    } else {
      if (dt.criticality === CRITICALITY.CRITICAL) missing_critical.push(dt.key)
      else if (dt.criticality === CRITICALITY.REQUIRED) missing_required.push(dt.key)
      else missing_optional.push(dt.key)
    }
  }

  const criticalAndRequired = DOCUMENT_TYPES.filter(
    d => d.criticality === CRITICALITY.CRITICAL || d.criticality === CRITICALITY.REQUIRED
  ).length
  const presentCriticalAndRequired = present.filter(k => {
    const dt = DOCUMENT_TYPES.find(d => d.key === k)
    return dt && (dt.criticality === CRITICALITY.CRITICAL || dt.criticality === CRITICALITY.REQUIRED)
  }).length

  return {
    total_types: DOCUMENT_TYPES.length,
    present,
    missing_critical,
    missing_required,
    missing_optional,
    completeness_pct: criticalAndRequired > 0
      ? Math.round((presentCriticalAndRequired / criticalAndRequired) * 100)
      : 0,
    blocked: missing_critical.length > 0,
  }
}

module.exports = {
  DOCUMENT_TYPES,
  CRITICALITY,
  LABEL_TO_KEY,
  validateCompleteness,
}
