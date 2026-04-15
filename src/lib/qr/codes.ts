/**
 * ZAPATA AI · V1.5 F1 — Entrada QR codes.
 *
 * Short-code generation + QR rendering + scan resolution. A QR label is
 * created when the supplier confirms shipment (Block 4) and printed by
 * Vicente at the warehouse. On arrival he scans the label with his phone
 * (`/bodega/escanear`); the resolve helper looks up the short code, stamps
 * scanned_at + scanned_by + scan_location, and emits `warehouse_entry_received`
 * onto `workflow_events` so Block 7's corridor map pulses `rz_warehouse`.
 *
 * Pure lib — no Next request plumbing. Route handlers in
 * `src/app/api/qr/**` call these helpers.
 */

import { randomBytes } from 'node:crypto'
import QRCode from 'qrcode'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { WAREHOUSE_ENTRY_RECEIVED_EVENT } from '@/lib/warehouse-entries'

// Base32 without easily-confused glyphs (no 0/1/I/O). 10 chars = ~50 bits.
const BASE32_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SHORT_CODE_LEN = 10

/** Generate a URL-safe 10-character short code. */
export function generateShortCode(): string {
  const bytes = randomBytes(SHORT_CODE_LEN)
  let out = ''
  for (let i = 0; i < SHORT_CODE_LEN; i++) {
    out += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length]
  }
  return out
}

/** Parse a scanned payload (either raw code or URL) into a short code. */
export function parseScanPayload(payload: string): string | null {
  const trimmed = payload.trim()
  if (!trimmed) return null
  // URL form: .../e/<code>  or  ?c=<code>
  const urlMatch = trimmed.match(/(?:\/e\/|[?&]c=)([A-Z0-9]{6,16})/i)
  if (urlMatch) return urlMatch[1].toUpperCase()
  // Raw code form
  const rawMatch = trimmed.match(/^[A-Z0-9]{6,16}$/i)
  if (rawMatch) return trimmed.toUpperCase()
  return null
}

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase env missing for QR codes')
  }
  return createClient(url, key)
}

export interface CreateQrInput {
  traficoId: string
  companyId: string
  entradaId?: string | null
  generatedBy?: string | null
  /** Optional injected client — tests use this to skip Supabase. */
  client?: SupabaseClient
}

export interface CreateQrResult {
  code: string
  qrDataUrl: string
}

/**
 * Insert an entrada_qr_codes row and render a QR PNG data URL.
 * Retries once on unique-code collision (astronomically unlikely).
 */
export async function createEntradaQrCode(
  input: CreateQrInput,
): Promise<CreateQrResult> {
  const client = input.client ?? getServiceClient()

  // Retry loop — only re-runs on unique_violation.
  let code = generateShortCode()
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await client.from('entrada_qr_codes').insert({
      code,
      trafico_id: input.traficoId,
      company_id: input.companyId,
      entrada_id: input.entradaId ?? null,
      generated_by: input.generatedBy ?? null,
    })
    if (!error) break
    if (error.code !== '23505') {
      throw new Error(`qr insert failed: ${error.message}`)
    }
    code = generateShortCode()
    if (attempt === 2) {
      throw new Error('qr insert failed: repeated short-code collisions')
    }
  }

  const qrDataUrl = await QRCode.toDataURL(code, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
  })
  return { code, qrDataUrl }
}

export interface ResolveQrInput {
  code: string
  scannedBy: string
  location: string
  companyId: string
  client?: SupabaseClient
}

export interface ResolveQrSuccess {
  traficoId: string
  entradaId: string | null
  companyId: string
}

export interface ResolveQrError {
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'INTERNAL_ERROR'
  message: string
}

export type ResolveQrOutcome =
  | { data: ResolveQrSuccess; error: null }
  | { data: null; error: ResolveQrError }

/**
 * Look up a QR short code, stamp scan metadata, fire warehouse_entry_received.
 * Scoped to the caller's company_id — cross-tenant reads are rejected.
 */
export async function resolveEntradaQrCode(
  input: ResolveQrInput,
): Promise<ResolveQrOutcome> {
  const client = input.client ?? getServiceClient()
  const code = input.code.trim().toUpperCase()

  const { data: row, error: lookupErr } = await client
    .from('entrada_qr_codes')
    .select('id, code, trafico_id, company_id, entrada_id')
    .eq('code', code)
    .maybeSingle<{
      id: string
      code: string
      trafico_id: string
      company_id: string
      entrada_id: string | null
    }>()

  if (lookupErr) {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: lookupErr.message } }
  }
  if (!row) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Código no encontrado' } }
  }
  if (row.company_id !== input.companyId) {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Sin acceso al código' } }
  }

  const scannedAt = new Date().toISOString()

  await client
    .from('entrada_qr_codes')
    .update({
      scanned_at: scannedAt,
      scanned_by: input.scannedBy,
      scan_location: input.location,
    })
    .eq('id', row.id)

  await client.from('workflow_events').insert({
    workflow: 'warehouse',
    event_type: WAREHOUSE_ENTRY_RECEIVED_EVENT,
    trigger_id: row.trafico_id,
    company_id: row.company_id,
    payload: {
      trafico_id: row.trafico_id,
      entrada_id: row.entrada_id,
      qr_code: code,
      scan_location: input.location,
      scanned_by: input.scannedBy,
      scanned_at: scannedAt,
      source: 'qr_scan',
    },
    status: 'pending',
  })

  return {
    data: {
      traficoId: row.trafico_id,
      entradaId: row.entrada_id,
      companyId: row.company_id,
    },
    error: null,
  }
}
