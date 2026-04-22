/**
 * V2 Doc Intelligence · Phase 3 — Document Inbox list endpoint.
 *
 * Joins `pedimento_facturas` (the unassigned queue) with the latest
 * `document_classifications` row per invoice so the UI can render
 * the AI suggestion inline with the invoice metadata. Tenant-scoped
 * via `session.companyId` (client role) or the `company_id` cookie
 * (internal roles). Paginated (default 50, max 200).
 *
 * Default filter: status='unassigned'. The inbox is the "needs my
 * attention" queue — assigned + archived live on /banco-facturas.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface InboxRow {
  id: string
  invoice_number: string | null
  supplier_name: string | null
  supplier_rfc: string | null
  amount: number | null
  currency: string | null
  received_at: string | null
  file_url: string | null
  status: string
  // Latest classification (null when none yet).
  suggested_type: string | null
  suggested_confidence: number | null
  suggested_source: string | null
  classification_id: string | null
  // Soft-warning signal — true when another row shares this file_hash
  // or (supplier_rfc + normalized_invoice_number).
  has_potential_duplicate: boolean
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const sp = request.nextUrl.searchParams
  const limitRaw = Number.parseInt(sp.get('limit') ?? '50', 10)
  const offsetRaw = Number.parseInt(sp.get('offset') ?? '0', 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 200) : 50
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0

  const companyId =
    session.role === 'client'
      ? session.companyId
      : (request.cookies.get('company_id')?.value || session.companyId)

  // 1. Pull the invoice bank page.
  const { data: invoices, error: invErr, count } = await supabase
    .from('pedimento_facturas')
    .select(
      'id, invoice_number, supplier_name, supplier_rfc, amount, currency, received_at, file_url, status, file_hash, normalized_invoice_number',
      { count: 'exact' },
    )
    .eq('company_id', companyId)
    .eq('status', 'unassigned')
    .order('received_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (invErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: invErr.message } },
      { status: 500 },
    )
  }

  const rows = (invoices ?? []) as Array<{
    id: string
    invoice_number: string | null
    supplier_name: string | null
    supplier_rfc: string | null
    amount: number | null
    currency: string | null
    received_at: string | null
    file_url: string | null
    status: string
    file_hash: string | null
    normalized_invoice_number: string | null
  }>

  const ids = rows.map((r) => r.id)

  // 2. Pull the latest classification per invoice_bank_id in this page.
  //    One query, newest-first; dedupe in JS.
  const classificationsByInvoiceId = new Map<
    string,
    { id: string; doc_type: string | null; confidence: number | null; model: string | null }
  >()
  if (ids.length > 0) {
    const { data: classes } = await supabase
      .from('document_classifications')
      .select('id, invoice_bank_id, doc_type, confidence, model, created_at')
      .in('invoice_bank_id', ids)
      .order('created_at', { ascending: false })
      .limit(ids.length * 3)
    for (const c of (classes ?? []) as Array<{
      id: string
      invoice_bank_id: string
      doc_type: string | null
      confidence: number | null
      model: string | null
    }>) {
      // First (newest) wins because the query is ordered desc.
      if (!classificationsByInvoiceId.has(c.invoice_bank_id)) {
        classificationsByInvoiceId.set(c.invoice_bank_id, {
          id: c.id,
          doc_type: c.doc_type,
          confidence: c.confidence,
          model: c.model,
        })
      }
    }
  }

  // 3. Duplicate flag: group by file_hash + normalized_invoice_number.
  //    O(n²) over the page is fine at limit ≤ 200. For real scale this
  //    would move into a materialized view.
  const hashCounts = new Map<string, number>()
  const rfcInvoiceCounts = new Map<string, number>()
  for (const r of rows) {
    if (r.file_hash) hashCounts.set(r.file_hash, (hashCounts.get(r.file_hash) ?? 0) + 1)
    if (r.supplier_rfc && r.normalized_invoice_number) {
      const k = `${r.supplier_rfc}|${r.normalized_invoice_number}`
      rfcInvoiceCounts.set(k, (rfcInvoiceCounts.get(k) ?? 0) + 1)
    }
  }

  const out: InboxRow[] = rows.map((r) => {
    const cls = classificationsByInvoiceId.get(r.id) ?? null
    const dupByHash = r.file_hash ? (hashCounts.get(r.file_hash) ?? 0) > 1 : false
    const dupByRfcInvoice =
      r.supplier_rfc && r.normalized_invoice_number
        ? (rfcInvoiceCounts.get(`${r.supplier_rfc}|${r.normalized_invoice_number}`) ?? 0) > 1
        : false
    return {
      id: r.id,
      invoice_number: r.invoice_number,
      supplier_name: r.supplier_name,
      supplier_rfc: r.supplier_rfc,
      amount: r.amount,
      currency: r.currency,
      received_at: r.received_at,
      file_url: r.file_url,
      status: r.status,
      suggested_type: cls?.doc_type ?? null,
      suggested_confidence: cls?.confidence ?? null,
      suggested_source: cls?.model ?? null,
      classification_id: cls?.id ?? null,
      has_potential_duplicate: dupByHash || dupByRfcInvoice,
    }
  })

  return NextResponse.json({
    data: {
      rows: out,
      meta: {
        total: count ?? out.length,
        limit,
        offset,
        hasMore: (count ?? 0) > offset + out.length,
      },
    },
    error: null,
  })
}
