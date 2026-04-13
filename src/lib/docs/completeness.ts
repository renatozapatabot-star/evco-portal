/**
 * Completeness + compliance rules for auto-classified customs documents.
 *
 * Pure function. No I/O. Runs after Claude Vision extraction.
 * Output maps 1:1 to the green/amber/red cards rendered by /documentos/auto.
 *
 * Rule sources:
 * - CLAUDE.md customs rules: fracción dots preserved, pedimento spaces,
 *   explicit MXN/USD, IVA base composition (not enforced here — that's
 *   for later pipeline steps, this is document intake).
 * - core-invariants #7–#10: pedimento format, fracción format, currency label.
 */

import type { VisionExtraction } from '@/lib/vision/classify'

export type DocumentoStatus = 'ready' | 'review' | 'missing'

export interface CompletenessResult {
  status: DocumentoStatus
  issues: string[]
}

const FRACCION_REGEX = /^\d{4}\.\d{2}\.\d{2}$/
const PEDIMENTO_REGEX = /^\d{2}\s\d{2}\s\d{4}\s\d{7}$/

function checkFactura(extracted: VisionExtraction): string[] {
  const issues: string[] = []
  if (!extracted.supplier) issues.push('Falta proveedor / razón social')
  if (!extracted.invoice_number) issues.push('Falta número de factura')
  if (!extracted.invoice_date) issues.push('Falta fecha de emisión')
  if (extracted.amount === null) issues.push('Falta importe total')
  if (!extracted.currency) issues.push('Falta moneda explícita (MXN o USD)')

  const hasLineItems = extracted.line_items.length > 0
  if (!hasLineItems) {
    issues.push('No se detectaron partidas')
  } else {
    const withFraccion = extracted.line_items.filter((l) => l.fraccion)
    if (withFraccion.length === 0) {
      issues.push('Ninguna partida tiene fracción arancelaria')
    } else {
      const badFormat = withFraccion.filter((l) => l.fraccion && !FRACCION_REGEX.test(l.fraccion))
      if (badFormat.length > 0) {
        issues.push(`Fracción con formato inválido (esperado XXXX.XX.XX): ${badFormat[0].fraccion}`)
      }
    }
  }
  return issues
}

function checkPackingList(extracted: VisionExtraction): string[] {
  const issues: string[] = []
  if (!extracted.supplier) issues.push('Falta emisor')
  if (!extracted.invoice_number) issues.push('Falta referencia / número')
  if (extracted.line_items.length === 0) issues.push('No se detectaron partidas')
  return issues
}

function checkCertificateOfOrigin(extracted: VisionExtraction): string[] {
  const issues: string[] = []
  if (!extracted.supplier) issues.push('Falta emisor / productor')
  if (!extracted.invoice_date) issues.push('Falta fecha de emisión')
  if (extracted.line_items.length === 0) {
    issues.push('No se detectaron partidas cubiertas')
  } else {
    const withFraccion = extracted.line_items.filter((l) => l.fraccion)
    if (withFraccion.length === 0) {
      issues.push('Ninguna partida tiene fracción arancelaria')
    }
  }
  return issues
}

function checkBol(extracted: VisionExtraction): string[] {
  const issues: string[] = []
  if (!extracted.supplier) issues.push('Falta transportista / carrier')
  if (!extracted.invoice_number) issues.push('Falta número de BL / guía')
  return issues
}

export function runCompleteness(extraction: VisionExtraction): CompletenessResult {
  if (!extraction.doc_type) {
    return {
      status: 'missing',
      issues: ['Tipo de documento no reconocido'],
    }
  }

  let issues: string[]
  switch (extraction.doc_type) {
    case 'invoice':
      issues = checkFactura(extraction)
      break
    case 'packing_list':
      issues = checkPackingList(extraction)
      break
    case 'certificate_of_origin':
      issues = checkCertificateOfOrigin(extraction)
      break
    case 'bol':
      issues = checkBol(extraction)
      break
    case 'other':
      return {
        status: 'review',
        issues: ['Documento no clasificado como aduanal estándar'],
      }
  }

  if (issues.length === 0) return { status: 'ready', issues: [] }
  const critical = issues.some(
    (m) => m.startsWith('Falta proveedor') || m.startsWith('No se detectaron partidas'),
  )
  return { status: critical ? 'missing' : 'review', issues }
}

export function labelForDocType(docType: VisionExtraction['doc_type']): string {
  switch (docType) {
    case 'invoice':
      return 'Factura comercial'
    case 'packing_list':
      return 'Packing list'
    case 'certificate_of_origin':
      return 'Certificado de origen'
    case 'bol':
      return 'Bill of Lading'
    case 'other':
      return 'Otro documento'
    default:
      return 'No reconocido'
  }
}

/**
 * Pedimento reference detector. Scans concatenated extraction strings
 * for a valid `DD AD PPPP SSSSSSS` pattern. Non-destructive — dots in
 * fracciones and digits in invoice numbers won't match this format.
 */
export function findPedimentoReference(extraction: VisionExtraction): string | null {
  const haystacks: Array<string | null> = [
    extraction.invoice_number,
    extraction.supplier,
    ...extraction.line_items.map((l) => l.description),
  ]
  for (const text of haystacks) {
    if (!text) continue
    const m = text.match(/\b\d{2}\s\d{2}\s\d{4}\s\d{7}\b/)
    if (m && PEDIMENTO_REGEX.test(m[0])) return m[0]
  }
  return null
}
