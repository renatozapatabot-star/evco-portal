/**
 * V2 Doc Intelligence · Phase 1 — duplicate-invoice detection.
 *
 * Pure scoring + Supabase-backed lookup. The upload route calls
 * `findDuplicates` after extracting invoice fields; the result is
 * returned to the caller verbatim so the UI can render a soft
 * "posible duplicado" chip per Renato IV's V1 policy (no hard
 * blocking — the user decides).
 *
 * Three buckets, in descending confidence:
 *   · exact  — same file_hash, OR same (supplier_rfc +
 *              normalized_invoice_number) within the tenant.
 *   · near   — same supplier + same amount/currency within ±60
 *              days. This catches re-issued invoices where the
 *              number changed but the economic content didn't.
 *   · fuzzy  — normalized invoice numbers within Levenshtein
 *              distance ≤ 2 AND supplier-name similarity ≥ 0.82.
 *              Covers OCR slips (INV-202-6/04 vs INV-2026/04).
 *
 * The pure helpers (normalize + Levenshtein + scoreCandidate) are
 * exported so tests can exercise the logic without touching
 * Supabase. `findDuplicates` is the one async entry point.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

/** What the caller needs about a match. Shaped to drop straight into a UI chip. */
export interface DuplicateMatch {
  id: string
  bucket: 'exact' | 'near' | 'fuzzy'
  score: number
  reasons: string[]
  invoice_number: string | null
  supplier_name: string | null
  amount: number | null
  currency: string | null
  received_at: string | null
  status: string | null
  file_url: string | null
}

export interface DuplicateSearch {
  companyId: string
  fileHash?: string | null
  invoiceNumber?: string | null
  supplierName?: string | null
  supplierRfc?: string | null
  amount?: number | null
  currency?: string | null
  invoiceDate?: string | null
  /** Ignore a specific row (e.g. the one we just inserted). */
  excludeId?: string | null
}

/** Row shape the scorer consumes. Mirrors the pedimento_facturas columns used. */
export interface DedupCandidateRow {
  id: string
  invoice_number: string | null
  normalized_invoice_number: string | null
  supplier_name: string | null
  supplier_rfc: string | null
  amount: number | null
  currency: string | null
  received_at: string | null
  status: string | null
  file_url: string | null
  file_hash: string | null
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** SHA-256 hex of bytes. Node crypto is available in every route runtime. */
export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex')
}

/**
 * Strip a supplier name down to a fuzzy-matchable form.
 * Removes legal suffixes (S.A., de C.V., LLC, Inc., Corp., Ltda., GmbH),
 * folds diacritics, collapses whitespace, lowercases.
 */
export function normalizeSupplierName(raw: string | null | undefined): string {
  if (!raw) return ''
  const stripSuffixes = /\b(s\.?\s*a\.?\s*(de\s*c\.?\s*v\.?)?|s\.?\s*de\s*r\.?\s*l\.?|llc|l\.?\s*l\.?\s*c\.?|inc\.?|corp\.?|corporation|company|co\.?|ltd\.?|ltda\.?|gmbh|spa|b\.?v\.?)\b\.?/gi
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(stripSuffixes, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Collapse an invoice number to lowercase alphanumeric.
 * "INV-2026/0417" → "inv20260417". Returns '' for null/empty.
 */
export function normalizeInvoiceNumber(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Iterative Levenshtein. O(n*m) space, good enough for invoice numbers. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const prev = new Array<number>(b.length + 1)
  const curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }
  return prev[b.length]
}

/** Supplier similarity in [0..1]. 1 = exact normalized match. */
export function supplierSimilarity(a: string, b: string): number {
  const na = normalizeSupplierName(a)
  const nb = normalizeSupplierName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const dist = levenshtein(na, nb)
  const max = Math.max(na.length, nb.length)
  return max === 0 ? 0 : 1 - dist / max
}

/**
 * Score one candidate row against the search target.
 * Returns null when nothing matched meaningfully — callers drop nulls.
 */
export function scoreCandidate(
  target: DuplicateSearch,
  row: DedupCandidateRow,
): DuplicateMatch | null {
  if (target.excludeId && row.id === target.excludeId) return null

  const reasons: string[] = []
  let bucket: DuplicateMatch['bucket'] | null = null
  let score = 0

  // ── Exact: identical file bytes ──
  if (target.fileHash && row.file_hash && target.fileHash === row.file_hash) {
    reasons.push('archivo idéntico (mismo SHA-256)')
    bucket = 'exact'
    score = 1
  }

  // ── Exact: same (RFC, normalized invoice number) ──
  const targetNorm = normalizeInvoiceNumber(target.invoiceNumber)
  if (
    !bucket &&
    target.supplierRfc &&
    row.supplier_rfc &&
    target.supplierRfc.toUpperCase() === row.supplier_rfc.toUpperCase() &&
    targetNorm &&
    row.normalized_invoice_number &&
    targetNorm === row.normalized_invoice_number
  ) {
    reasons.push('mismo RFC + mismo folio')
    bucket = 'exact'
    score = 0.98
  }

  // ── Near: same supplier + same amount/currency within ±60d ──
  const supplierScore = supplierSimilarity(
    target.supplierName ?? '',
    row.supplier_name ?? '',
  )
  const sameAmount =
    target.amount != null &&
    row.amount != null &&
    Math.abs(Number(target.amount) - Number(row.amount)) < 0.01
  const sameCurrency =
    !target.currency ||
    !row.currency ||
    target.currency.toUpperCase() === row.currency.toUpperCase()
  const withinWindow = withinDateWindow(target.invoiceDate, row.received_at, 60)

  if (
    !bucket &&
    supplierScore >= 0.85 &&
    sameAmount &&
    sameCurrency &&
    withinWindow
  ) {
    reasons.push('mismo proveedor + mismo monto dentro de 60 días')
    bucket = 'near'
    score = 0.8 + supplierScore * 0.1
  }

  // ── Fuzzy: invoice-number Levenshtein ≤ 2 + supplier similarity ≥ 0.82 ──
  if (!bucket && targetNorm && row.normalized_invoice_number) {
    const dist = levenshtein(targetNorm, row.normalized_invoice_number)
    const maxLen = Math.max(targetNorm.length, row.normalized_invoice_number.length)
    // Guard against tiny strings matching trivially (e.g. "1" vs "2").
    if (dist <= 2 && maxLen >= 5 && supplierScore >= 0.82) {
      reasons.push(
        `folio parecido (distancia ${dist}) y proveedor similar (${Math.round(supplierScore * 100)}%)`,
      )
      bucket = 'fuzzy'
      // Range: ~0.55 at the edge, ~0.75 at exact-norm match.
      score = 0.55 + (1 - dist / 3) * 0.2
    }
  }

  if (!bucket) return null
  return {
    id: row.id,
    bucket,
    score: Number(score.toFixed(3)),
    reasons,
    invoice_number: row.invoice_number,
    supplier_name: row.supplier_name,
    amount: row.amount,
    currency: row.currency,
    received_at: row.received_at,
    status: row.status,
    file_url: row.file_url,
  }
}

function withinDateWindow(
  a: string | null | undefined,
  b: string | null | undefined,
  days: number,
): boolean {
  if (!a || !b) return true // unknown dates don't kill the match
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return true
  return Math.abs(ta - tb) <= days * 86400_000
}

// ---------------------------------------------------------------------------
// Supabase-backed entry point
// ---------------------------------------------------------------------------

export interface FindDuplicatesResult {
  exact: DuplicateMatch[]
  near: DuplicateMatch[]
  fuzzy: DuplicateMatch[]
  total: number
}

/**
 * Look for duplicates in pedimento_facturas scoped to one tenant.
 *
 * The query fans out only to signals present on the target — e.g. no
 * `supplierRfc` means we skip the RFC index lookup entirely. Callers
 * pass whatever they've extracted; null inputs narrow the search but
 * never widen it to other tenants (company_id is always required).
 */
export async function findDuplicates(
  supabase: SupabaseClient,
  target: DuplicateSearch,
): Promise<FindDuplicatesResult> {
  const columns =
    'id, invoice_number, normalized_invoice_number, supplier_name, supplier_rfc, ' +
    'amount, currency, received_at, status, file_url, file_hash'

  const candidatesById = new Map<string, DedupCandidateRow>()
  const targetNorm = normalizeInvoiceNumber(target.invoiceNumber)

  // Hash hit (O(1) per tenant).
  if (target.fileHash) {
    const { data } = await supabase
      .from('pedimento_facturas')
      .select(columns)
      .eq('company_id', target.companyId)
      .eq('file_hash', target.fileHash)
      .limit(20)
    for (const row of (data ?? []) as unknown as DedupCandidateRow[]) candidatesById.set(row.id, row)
  }

  // RFC + normalized invoice number (O(log n)).
  if (target.supplierRfc && targetNorm) {
    const { data } = await supabase
      .from('pedimento_facturas')
      .select(columns)
      .eq('company_id', target.companyId)
      .eq('supplier_rfc', target.supplierRfc.toUpperCase())
      .eq('normalized_invoice_number', targetNorm)
      .limit(20)
    for (const row of (data ?? []) as unknown as DedupCandidateRow[]) candidatesById.set(row.id, row)
  }

  // Normalized invoice number alone — catches collisions across suppliers.
  if (targetNorm) {
    const { data } = await supabase
      .from('pedimento_facturas')
      .select(columns)
      .eq('company_id', target.companyId)
      .eq('normalized_invoice_number', targetNorm)
      .limit(20)
    for (const row of (data ?? []) as unknown as DedupCandidateRow[]) candidatesById.set(row.id, row)
  }

  // Supplier + amount window — catches reissued invoices.
  if (target.supplierName && target.amount != null) {
    const { data } = await supabase
      .from('pedimento_facturas')
      .select(columns)
      .eq('company_id', target.companyId)
      .ilike('supplier_name', `%${target.supplierName.slice(0, 30)}%`)
      .eq('amount', target.amount)
      .limit(20)
    for (const row of (data ?? []) as unknown as DedupCandidateRow[]) candidatesById.set(row.id, row)
  }

  const matches: DuplicateMatch[] = []
  for (const row of candidatesById.values()) {
    const match = scoreCandidate(target, row)
    if (match) matches.push(match)
  }
  matches.sort((a, b) => b.score - a.score)

  return {
    exact: matches.filter((m) => m.bucket === 'exact'),
    near: matches.filter((m) => m.bucket === 'near'),
    fuzzy: matches.filter((m) => m.bucket === 'fuzzy'),
    total: matches.length,
  }
}
