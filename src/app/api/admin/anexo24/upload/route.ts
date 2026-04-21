/**
 * CRUZ · POST /api/admin/anexo24/upload
 *
 * Accepts a Formato 53 XLSX (multipart/form-data, field `file`) and ingests
 * it into `anexo24_parts` — upsert with supersede semantics. Admin/broker
 * role only. Optional `?tenant=<company_id>` lets an admin upload on
 * behalf of a client.
 *
 * Response:
 *   { data: { row_count, parts_touched, upserts, skips, errors, drift }, error: null }
 *
 * Audit trail:
 *   · `logDecision('anexo24_ingested', …)` per upload.
 *   · `sync_log` row with sync_type='anexo24_ingest' + status + counts.
 *   · `source_document_hash` stored per row so replays of the same XLSX
 *     are idempotent (the upsert naturally dedupes; the hash is forensic).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import {
  parseFormato53Xlsx,
  upsertAnexo24Parts,
  reconcileAnexo24Drift,
  hashBuffer,
} from '@/lib/anexo24/ingest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function jsonError(code: string, message: string, status = 500) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return jsonError('UNAUTHORIZED', 'Sesión inválida', 401)
  const isInternal = session.role === 'broker' || session.role === 'admin'
  if (!isInternal) return jsonError('FORBIDDEN', 'Solo admin o broker pueden subir Formato 53', 403)

  // Target tenant: ?tenant=… overrides session.companyId.
  const url = new URL(request.url)
  const tenantParam = url.searchParams.get('tenant')
  const targetCompanyId = tenantParam && tenantParam.trim().length > 0 ? tenantParam.trim() : session.companyId

  // Parse multipart form.
  let file: File | null = null
  try {
    const form = await request.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
  } catch (e) {
    return jsonError('VALIDATION_ERROR', `No pude leer el archivo: ${e instanceof Error ? e.message : String(e)}`, 400)
  }
  if (!file) return jsonError('VALIDATION_ERROR', 'Falta el campo file (XLSX)', 400)
  if (!/\.xlsx$/i.test(file.name)) {
    return jsonError('VALIDATION_ERROR', 'El archivo debe ser XLSX (Formato 53)', 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const hash = hashBuffer(buffer)

  // Open sync_log row for this ingest.
  const { data: syncLogRow } = await supabase
    .from('sync_log')
    .insert({
      sync_type: 'anexo24_ingest',
      company_id: targetCompanyId,
      started_at: new Date().toISOString(),
      status: 'running',
    })
    .select('id')
    .single()

  // Parse XLSX.
  let rows
  try {
    rows = parseFormato53Xlsx(buffer)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (syncLogRow?.id) {
      await supabase.from('sync_log').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: `parse: ${message}`,
      }).eq('id', syncLogRow.id)
    }
    return jsonError('PARSE_ERROR', `No pude leer el XLSX: ${message}`, 400)
  }

  if (rows.length === 0) {
    if (syncLogRow?.id) {
      await supabase.from('sync_log').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: 'Sin filas · archivo vacío o formato incorrecto',
      }).eq('id', syncLogRow.id)
    }
    return jsonError('PARSE_ERROR', 'El archivo no contiene filas de Formato 53', 400)
  }

  // Upsert.
  let summary
  try {
    summary = await upsertAnexo24Parts(supabase, targetCompanyId, rows, {
      source_document_url: null,
      source_document_hash: hash,
      ingested_by: `${session.companyId}:${session.role}:upload`,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (syncLogRow?.id) {
      await supabase.from('sync_log').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: `upsert: ${message}`,
      }).eq('id', syncLogRow.id)
    }
    return jsonError('UPSERT_ERROR', `Falló la inserción: ${message}`, 500)
  }

  // Drift report — best-effort (non-fatal).
  let drift = null
  try {
    drift = await reconcileAnexo24Drift(supabase, targetCompanyId)
  } catch {
    drift = null
  }

  // Close sync_log.
  if (syncLogRow?.id) {
    await supabase.from('sync_log').update({
      status: 'success',
      completed_at: new Date().toISOString(),
      rows_synced: summary.upserts + summary.skips,
    }).eq('id', syncLogRow.id)
  }

  await logDecision({
    company_id: targetCompanyId,
    decision_type: 'anexo_24_ingested',
    decision: `Formato 53 ingesta · ${summary.upserts} upsert · ${summary.skips} skip · ${summary.errors} error`,
    reasoning: `Admin upload por ${session.companyId}:${session.role}. SHA-256: ${hash}.`,
    dataPoints: {
      row_count: summary.xlsx_rows,
      parts_touched: summary.parts_touched,
      upserts: summary.upserts,
      skips: summary.skips,
      errors: summary.errors,
      file_name: file.name,
      file_hash: hash,
      drift_counts: drift ? {
        only_in_anexo24: drift.only_in_anexo24.length,
        only_in_globalpc: drift.only_in_globalpc.length,
        fraccion_mismatch: drift.fraccion_mismatch.length,
        description_mismatch: drift.description_mismatch.length,
      } : null,
    },
  }).catch(() => { /* non-fatal */ })

  return NextResponse.json({
    data: {
      row_count: summary.xlsx_rows,
      parts_touched: summary.parts_touched,
      upserts: summary.upserts,
      skips: summary.skips,
      errors: summary.errors,
      drift: drift ? {
        only_in_anexo24: drift.only_in_anexo24.length,
        only_in_globalpc: drift.only_in_globalpc.length,
        fraccion_mismatch: drift.fraccion_mismatch.length,
        description_mismatch: drift.description_mismatch.length,
        sample_mismatches: drift.fraccion_mismatch.slice(0, 5),
      } : null,
      tenant: targetCompanyId,
      file_hash: hash,
    },
    error: null,
  })
}
