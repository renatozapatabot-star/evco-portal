/**
 * CFDI 4.0 parser — extracts invoice fields from Mexican SAT-issued XML.
 *
 * Transport-agnostic: takes a UTF-8 string, returns fields shaped like
 * `InvoiceExtractedFields` so the invoice-bank insertion path can consume
 * it interchangeably with the Vision extractor.
 *
 * Unknown complement namespaces (Addenda, CartaPorte, etc.) are ignored —
 * we only parse the `cfdi:` base document. Line items are returned but
 * not yet persisted; the invoice_bank row schema only stores totals.
 *
 * Rules enforced:
 *   · currency normalized to 'MXN' | 'USD' | null
 *   · total parsed as number; returns null on non-numeric
 *   · confidence fixed at 0.98 (CFDI is authoritative — no LLM guessing)
 */

import { XMLParser } from 'fast-xml-parser'
import type { InvoiceExtractedFields } from '@/lib/invoice-bank'

export interface CFDILineItem {
  noIdentificacion: string | null
  descripcion: string | null
  cantidad: number | null
  valorUnitario: number | null
  importe: number | null
  fraccionArancelaria: string | null
}

export interface ParsedCFDI extends InvoiceExtractedFields {
  folio: string | null
  fecha: string | null
  rfcEmisor: string | null
  rfcReceptor: string | null
  tipoComprobante: string | null
  lineas: CFDILineItem[]
}

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => name === 'Concepto' || name === 'InformacionAduanera',
})

function pickString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function pickNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[^0-9.\-]/g, '')
  if (cleaned.length === 0) return null
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeCurrency(moneda: string | null): 'MXN' | 'USD' | null {
  if (!moneda) return null
  const upper = moneda.toUpperCase()
  if (upper === 'MXN' || upper === 'USD') return upper
  return null
}

function extractFraccion(infoAduanera: unknown): string | null {
  if (!infoAduanera) return null
  const list = Array.isArray(infoAduanera) ? infoAduanera : [infoAduanera]
  for (const ia of list) {
    if (ia && typeof ia === 'object') {
      const fr = pickString((ia as Record<string, unknown>).FraccionArancelaria)
      if (fr) return fr
    }
  }
  return null
}

/**
 * Parse a CFDI 4.0 XML string. Throws if the root is not a `Comprobante`
 * — the caller catches and marks the row for manual review.
 */
export function parseCFDI(xml: string): ParsedCFDI {
  const doc = PARSER.parse(xml) as Record<string, unknown>
  const comprobante = doc.Comprobante as Record<string, unknown> | undefined
  if (!comprobante || typeof comprobante !== 'object') {
    throw new Error('CFDI: nodo Comprobante no encontrado')
  }

  const emisor = (comprobante.Emisor ?? {}) as Record<string, unknown>
  const receptor = (comprobante.Receptor ?? {}) as Record<string, unknown>
  const conceptosRoot = (comprobante.Conceptos ?? {}) as Record<string, unknown>
  const conceptos = Array.isArray(conceptosRoot.Concepto)
    ? (conceptosRoot.Concepto as unknown[])
    : conceptosRoot.Concepto != null
      ? [conceptosRoot.Concepto as unknown]
      : []

  const folio = pickString(comprobante.Folio) ?? pickString(comprobante.Serie)
  const total = pickNumber(comprobante.Total)
  const currency = normalizeCurrency(pickString(comprobante.Moneda))
  const fecha = pickString(comprobante.Fecha)
  const tipoComprobante = pickString(comprobante.TipoDeComprobante)

  const supplierName =
    pickString(emisor.Nombre) ?? pickString(emisor.Rfc)
  const rfcEmisor = pickString(emisor.Rfc)
  const rfcReceptor = pickString(receptor.Rfc)

  const lineas: CFDILineItem[] = conceptos.map((raw) => {
    const c = (raw ?? {}) as Record<string, unknown>
    return {
      noIdentificacion: pickString(c.NoIdentificacion),
      descripcion: pickString(c.Descripcion),
      cantidad: pickNumber(c.Cantidad),
      valorUnitario: pickNumber(c.ValorUnitario),
      importe: pickNumber(c.Importe),
      fraccionArancelaria: extractFraccion(c.InformacionAduanera),
    }
  })

  return {
    invoice_number: folio,
    supplier_name: supplierName,
    amount: total,
    currency,
    confidence: 0.98,
    folio,
    fecha,
    rfcEmisor,
    rfcReceptor,
    tipoComprobante,
    lineas,
  }
}

export function isCFDIFile(fileName: string, mimeType: string): boolean {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith('.xml')) return true
  if (mimeType === 'application/xml' || mimeType === 'text/xml') return true
  return false
}
