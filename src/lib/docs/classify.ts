/**
 * V2 Doc Intelligence · Phase 2 — unified smart classification.
 *
 * Single entry point for document classification across every ingress
 * path (banco-facturas upload, expedientes ingest, /api/documentos/*).
 * Two layers:
 *
 *   1. classifyByHeuristic — pure, no LLM. Reads filename + MIME
 *      (optionally a sniff of the first bytes). Catches the obvious
 *      cases: CFDI XML, files named "pedimento_*.pdf", carta-porte
 *      variants, RFC constancias. ~70% of real invoice-bank traffic
 *      resolves here at confidence ≥ 0.8 — zero Anthropic spend.
 *
 *   2. classifyDocumentSmart — orchestrator. Runs heuristics first;
 *      falls through to the Vision extractor (vision/classify.ts)
 *      only when the heuristic is unsure (confidence < 0.7) OR the
 *      caller explicitly needs field extraction (amount, supplier,
 *      line items). A document_classifications row is written in
 *      both paths so the audit trail is identical regardless of
 *      source.
 *
 * The 9-type SmartDocType union is the canonical catalog. Two mapping
 * functions project it to the legacy unions so existing consumers
 * (vision/classify.ts's VisionDocType and docs/vision-classifier.ts's
 * DocType) keep working without a breaking-change rename.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  classifyDocumentWithVision,
  type VisionDocType,
  type VisionExtraction,
} from '@/lib/vision/classify'
import type { DocType as LegacyEightTypeDoc } from '@/lib/docs/vision-classifier'
import { isCFDIFile } from '@/lib/cfdi/parser'

export const SMART_DOC_TYPES = [
  'factura',
  'packing_list',
  'bl',
  'awb',
  'carta_porte',
  'certificado_origen',
  'pedimento',
  'rfc',
  'nom',
  'other',
] as const

export type SmartDocType = (typeof SMART_DOC_TYPES)[number]

export interface HeuristicResult {
  type: SmartDocType | 'unknown'
  confidence: number
  reason: string
}

export interface SmartClassifyParams {
  /** Public URL in the expedientes bucket — required for the Vision path. */
  fileUrl: string
  /** Original filename (used for heuristics). */
  filename: string
  /** Original MIME type (used for heuristics). */
  mimeType: string
  companyId: string
  linkToInvoiceBankId?: string | null
  linkToExpedienteDocId?: string | null
  actor?: string | null
  /**
   * Small sniff from the head of the file (first ~2KB as UTF-8) used
   * to detect CFDI 4.0 <cfdi:Comprobante> signatures without a round
   * trip to storage. Optional — callers that already have the bytes
   * in hand pass them; others skip and the heuristic falls back to
   * filename/MIME only.
   */
  sniffHead?: string | null
  /** Threshold below which we escalate to Vision. Default 0.7. */
  minHeuristicConfidence?: number
  /**
   * When true, run Vision even if heuristics are confident — needed
   * when the caller also wants field extraction (supplier, amount,
   * line items). banco-facturas/upload passes true; bulk inbox
   * classifiers pass false to save tokens.
   */
  alwaysExtract?: boolean
}

export interface SmartClassifyResult {
  smartType: SmartDocType
  confidence: number
  source: 'heuristic' | 'vision' | 'vision_fallback'
  reason: string
  extraction: VisionExtraction | null
  classificationId: string | null
  error: string | null
  notConfigured: boolean
}

// ---------------------------------------------------------------------------
// Heuristic layer — pure
// ---------------------------------------------------------------------------

/** Case-insensitive substring that matches whole-word-ish (hyphen/space/underscore or end). */
function hasToken(haystack: string, needle: string): boolean {
  const re = new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`, 'i')
  return re.test(haystack)
}

/**
 * Pure heuristic classification. No LLM, no network, no Supabase.
 * Returns { type: 'unknown', confidence: 0 } when signals are absent —
 * the caller decides whether to escalate to Vision.
 */
export function classifyByHeuristic(args: {
  filename: string
  mimeType: string
  sniffHead?: string | null
}): HeuristicResult {
  const rawName = args.filename.toLowerCase()
  // Collapse separators so multi-word needles ("bill of lading",
  // "carta porte") match regardless of dash/underscore/dot variants.
  const name = rawName.replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()
  const mime = args.mimeType.toLowerCase()
  const sniff = (args.sniffHead ?? '').toLowerCase()

  // Strongest signal: CFDI 4.0 XML byte signature.
  if (sniff.includes('cfdi:comprobante') || sniff.includes('<comprobante')) {
    return { type: 'factura', confidence: 0.98, reason: 'firma CFDI en el XML' }
  }

  // XML + factura-ish filename = almost always a CFDI even without sniff.
  // isCFDIFile needs the raw name (with extension) — separator-normalized
  // form has the "." collapsed to a space.
  if (isCFDIFile(rawName, mime)) {
    if (hasToken(name, 'factura') || hasToken(name, 'cfdi') || hasToken(name, 'inv')) {
      return { type: 'factura', confidence: 0.92, reason: 'XML con nombre de factura' }
    }
    return { type: 'factura', confidence: 0.75, reason: 'XML (probable CFDI)' }
  }

  // Pedimento — SAT-filed entry.
  if (hasToken(name, 'pedimento') || hasToken(name, 'pedim')) {
    return { type: 'pedimento', confidence: 0.9, reason: 'nombre contiene "pedimento"' }
  }

  // Carta porte / CartaPorte — land transport complement.
  if (
    hasToken(name, 'carta porte') ||
    hasToken(name, 'cartaporte') ||
    hasToken(name, 'carta-porte') ||
    /\bcp[-_ ]?\d+/.test(name)
  ) {
    return { type: 'carta_porte', confidence: 0.88, reason: 'nombre contiene "carta porte"' }
  }

  // Bill of Lading.
  if (
    hasToken(name, 'bl') ||
    hasToken(name, 'bol') ||
    hasToken(name, 'bill of lading') ||
    hasToken(name, 'conocimiento')
  ) {
    return { type: 'bl', confidence: 0.82, reason: 'nombre contiene BL/BoL' }
  }

  // Airway Bill.
  if (hasToken(name, 'awb') || hasToken(name, 'airway') || hasToken(name, 'guia aerea')) {
    return { type: 'awb', confidence: 0.85, reason: 'nombre contiene AWB/guía aérea' }
  }

  // Packing list / lista de empaque.
  if (
    hasToken(name, 'packing') ||
    hasToken(name, 'packinglist') ||
    hasToken(name, 'lista empaque') ||
    hasToken(name, 'empaque')
  ) {
    return { type: 'packing_list', confidence: 0.85, reason: 'nombre contiene "packing"/"empaque"' }
  }

  // Certificate of Origin / T-MEC / USMCA.
  if (
    hasToken(name, 'certificado origen') ||
    hasToken(name, 'cert origen') ||
    hasToken(name, 't mec') ||
    hasToken(name, 'tmec') ||
    hasToken(name, 'usmca') ||
    /\bco[ ]?\d+/.test(name)
  ) {
    return {
      type: 'certificado_origen',
      confidence: 0.85,
      reason: 'nombre contiene certificado de origen / T-MEC',
    }
  }

  // RFC constancia / situación fiscal.
  if (
    hasToken(name, 'rfc') ||
    hasToken(name, 'constancia') ||
    hasToken(name, 'situacion fiscal') ||
    hasToken(name, 'sit fiscal')
  ) {
    return { type: 'rfc', confidence: 0.8, reason: 'nombre contiene RFC/constancia' }
  }

  // Invoice (non-CFDI PDF/image).
  if (
    hasToken(name, 'factura') ||
    hasToken(name, 'invoice') ||
    hasToken(name, 'inv') ||
    /^inv\b/.test(name)
  ) {
    return { type: 'factura', confidence: 0.78, reason: 'nombre sugiere factura/invoice' }
  }

  // NOM certificate.
  if (hasToken(name, 'nom') || /\bnom[ ]?\d+/.test(name)) {
    return { type: 'nom', confidence: 0.7, reason: 'nombre contiene NOM' }
  }

  return { type: 'unknown', confidence: 0, reason: 'sin señales en filename/MIME' }
}

// ---------------------------------------------------------------------------
// Legacy-union bridges — keep existing callers compiling
// ---------------------------------------------------------------------------

/**
 * Project a SmartDocType down to the 5-type union used by
 * `document_classifications.doc_type` + vision/classify.ts. Types that
 * don't have a direct legacy equivalent fall through to 'other'.
 */
export function smartToLegacyVision(s: SmartDocType): VisionDocType {
  switch (s) {
    case 'factura':
      return 'invoice'
    case 'packing_list':
      return 'packing_list'
    case 'bl':
    case 'awb':
      return 'bol'
    case 'certificado_origen':
      return 'certificate_of_origin'
    default:
      return 'other'
  }
}

/**
 * Project a SmartDocType up to the 8-type legacy classifier union
 * (docs/vision-classifier.ts) used by DocTypePill + /api/docs/classify.
 * Lossless for the 8 shared types.
 */
export function smartToLegacyClassifier(s: SmartDocType): LegacyEightTypeDoc {
  switch (s) {
    case 'factura':
      return 'factura'
    case 'bl':
    case 'awb':
      return 'bill_of_lading'
    case 'packing_list':
      return 'packing_list'
    case 'certificado_origen':
      return 'certificado_origen'
    case 'carta_porte':
      return 'carta_porte'
    case 'pedimento':
      return 'pedimento'
    case 'rfc':
      return 'rfc_constancia'
    default:
      return 'other'
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function insertHeuristicOnlyRow(
  supabase: SupabaseClient,
  params: SmartClassifyParams,
  heuristic: HeuristicResult,
): Promise<string | null> {
  // Persist heuristic-only decisions to the same audit table Vision
  // writes to — so the Document Inbox reads one unified source.
  if (heuristic.type === 'unknown') return null
  const row = {
    company_id: params.companyId,
    expediente_document_id: params.linkToExpedienteDocId ?? null,
    invoice_bank_id: params.linkToInvoiceBankId ?? null,
    file_url: params.fileUrl,
    doc_type: smartToLegacyVision(heuristic.type),
    supplier: null,
    invoice_number: null,
    invoice_date: null,
    currency: null,
    amount: null,
    line_items: null,
    raw_response: { source: 'heuristic', reason: heuristic.reason, smart_type: heuristic.type },
    model: 'heuristic',
    confidence: heuristic.confidence,
    error: null,
  }
  const { data, error } = await supabase
    .from('document_classifications')
    .insert(row)
    .select('id')
    .single()
  if (error || !data) return null
  return (data.id as string) ?? null
}

/**
 * Classify a document with heuristics first, Vision second.
 *
 * Always resolves — never throws. Callers inspect `source` to
 * understand which path ran and `confidence` to decide whether to
 * surface a "verificar" chip in the UI.
 */
export async function classifyDocumentSmart(
  params: SmartClassifyParams,
): Promise<SmartClassifyResult> {
  const threshold = params.minHeuristicConfidence ?? 0.7
  const heuristic = classifyByHeuristic({
    filename: params.filename,
    mimeType: params.mimeType,
    sniffHead: params.sniffHead,
  })

  const heuristicConfident =
    heuristic.type !== 'unknown' && heuristic.confidence >= threshold
  const needExtraction = params.alwaysExtract === true

  // Fast path: heuristic is confident AND the caller doesn't need
  // field extraction. Persist a heuristic-only row and skip Vision.
  if (heuristicConfident && !needExtraction) {
    const supabase = getSupabase()
    const id = await insertHeuristicOnlyRow(supabase, params, heuristic)
    return {
      smartType: heuristic.type as SmartDocType,
      confidence: heuristic.confidence,
      source: 'heuristic',
      reason: heuristic.reason,
      extraction: null,
      classificationId: id,
      error: null,
      notConfigured: false,
    }
  }

  // Vision path.
  const visionResult = await classifyDocumentWithVision({
    fileUrl: params.fileUrl,
    companyId: params.companyId,
    linkToInvoiceBankId: params.linkToInvoiceBankId ?? null,
    linkToExpedienteDocId: params.linkToExpedienteDocId ?? null,
    actor: params.actor ?? null,
  })

  // If Vision returned nothing usable but heuristics had a guess, take
  // the heuristic's guess as the final answer — better than 'other'.
  if (!visionResult.extraction && heuristic.type !== 'unknown') {
    return {
      smartType: heuristic.type as SmartDocType,
      confidence: heuristic.confidence,
      source: 'vision_fallback',
      reason: `vision no extrajo — ${heuristic.reason}`,
      extraction: null,
      classificationId: visionResult.id,
      error: visionResult.error,
      notConfigured: visionResult.notConfigured,
    }
  }

  const smartFromVision = visionDocTypeToSmart(visionResult.extraction?.doc_type ?? null)
  return {
    smartType: smartFromVision ?? (heuristic.type === 'unknown' ? 'other' : heuristic.type),
    // Vision doesn't return a confidence today; use 0.85 when it
    // resolved a doc_type, else 0.5.
    confidence: visionResult.extraction?.doc_type ? 0.85 : 0.5,
    source: 'vision',
    reason: visionResult.extraction?.doc_type
      ? 'vision extraction'
      : 'vision extrajo sin doc_type',
    extraction: visionResult.extraction,
    classificationId: visionResult.id,
    error: visionResult.error,
    notConfigured: visionResult.notConfigured,
  }
}

function visionDocTypeToSmart(v: VisionDocType | null): SmartDocType | null {
  switch (v) {
    case 'invoice':
      return 'factura'
    case 'packing_list':
      return 'packing_list'
    case 'bol':
      return 'bl'
    case 'certificate_of_origin':
      return 'certificado_origen'
    case 'other':
      return 'other'
    default:
      return null
  }
}
