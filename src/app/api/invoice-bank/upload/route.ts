/**
 * Block 8 · Invoice Bank — bulk upload endpoint.
 *
 * Accepts one or more files (PDF/XML/image) on one POST. For each file:
 *   1. Upload bytes to Supabase Storage `expedientes` bucket under
 *      `{companyId}/invoice-bank/{ts}_{idx}.{ext}`.
 *   2. If the file is an image, run Claude Vision to extract invoice
 *      fields (invoice_number, supplier_name, amount, currency).
 *      For PDFs/XML we insert the row with null fields and leave
 *      extraction to a follow-up (V1.5 tuning in the plan).
 *   3. Insert a `pedimento_facturas` row with `status='unassigned'`.
 *   4. Emit workflow events `invoice_uploaded` and, on success,
 *      `invoice_classified`.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { extractInvoiceFields } from '@/lib/invoice-bank'
import { logDecision } from '@/lib/decision-logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/xml',
  'text/xml',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const MAX_SIZE = 10 * 1024 * 1024

interface UploadResult {
  id: string
  fileName: string
  fileUrl: string
  status: 'unassigned'
  classified: boolean
  invoiceNumber: string | null
  supplierName: string | null
  amount: number | null
  currency: string | null
  error?: string
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const companyId =
    session.role === 'client'
      ? session.companyId
      : (request.cookies.get('company_id')?.value || session.companyId)
  const actor = `${session.companyId}:${session.role}`

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Formulario inválido' } },
      { status: 400 },
    )
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File)
  if (files.length === 0) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Falta archivo(s)' } },
      { status: 400 },
    )
  }
  if (files.length > 50) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Máximo 50 archivos por carga' } },
      { status: 400 },
    )
  }

  const results: UploadResult[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.size > MAX_SIZE) {
      results.push({
        id: '', fileName: file.name, fileUrl: '', status: 'unassigned', classified: false,
        invoiceNumber: null, supplierName: null, amount: null, currency: null,
        error: 'Archivo excede 10MB',
      })
      continue
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      results.push({
        id: '', fileName: file.name, fileUrl: '', status: 'unassigned', classified: false,
        invoiceNumber: null, supplierName: null, amount: null, currency: null,
        error: `Tipo no permitido: ${file.type}`,
      })
      continue
    }

    const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    const storagePath = `${companyId}/invoice-bank/${Date.now()}_${i}.${ext}`
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    const { error: uploadErr } = await supabase.storage
      .from('expedientes')
      .upload(storagePath, bytes, { contentType: file.type, upsert: false })

    if (uploadErr) {
      results.push({
        id: '', fileName: file.name, fileUrl: '', status: 'unassigned', classified: false,
        invoiceNumber: null, supplierName: null, amount: null, currency: null,
        error: `Storage: ${uploadErr.message}`,
      })
      continue
    }

    const fileUrl = supabase.storage.from('expedientes').getPublicUrl(storagePath).data.publicUrl

    // Vision extraction for images only. PDFs/XML skipped here — the
    // list view flags them as "pendiente de clasificar" so an operator
    // can still reconcile manually.
    let invoiceNumber: string | null = null
    let supplierName: string | null = null
    let amount: number | null = null
    let currency: string | null = null
    let classified = false
    if (file.type.startsWith('image/')) {
      try {
        const b64 = Buffer.from(buffer).toString('base64')
        const extracted = await extractInvoiceFields({ base64Image: b64, mediaType: file.type })
        invoiceNumber = extracted.invoice_number
        supplierName = extracted.supplier_name
        amount = extracted.amount
        currency = extracted.currency
        classified = true
      } catch {
        // Surface through the row — operator can correct manually.
        classified = false
      }
    }

    const { data: row, error: insErr } = await supabase
      .from('pedimento_facturas')
      .insert({
        invoice_number: invoiceNumber,
        supplier_name: supplierName,
        amount,
        currency,
        status: 'unassigned',
        file_url: fileUrl,
        received_at: new Date().toISOString(),
        company_id: companyId,
        uploaded_by: actor,
      })
      .select('id')
      .single()

    if (insErr || !row) {
      results.push({
        id: '', fileName: file.name, fileUrl, status: 'unassigned', classified,
        invoiceNumber, supplierName, amount, currency,
        error: insErr?.message ?? 'Insert falló',
      })
      continue
    }

    // workflow_events — uploaded always, classified on success.
    await supabase.from('workflow_events').insert({
      workflow: 'invoice',
      event_type: 'invoice_uploaded',
      trigger_id: null,
      company_id: companyId,
      payload: { invoice_id: row.id, file_name: file.name, actor },
    })
    if (classified) {
      await supabase.from('workflow_events').insert({
        workflow: 'invoice',
        event_type: 'invoice_classified',
        trigger_id: null,
        company_id: companyId,
        payload: { invoice_id: row.id, invoice_number: invoiceNumber, supplier_name: supplierName, actor },
      })
    }

    await logDecision({
      trafico: null,
      company_id: companyId,
      decision_type: 'invoice_uploaded',
      decision: `factura ${invoiceNumber ?? 'sin número'} cargada al banco`,
      reasoning: `Carga por ${actor}; clasificada=${classified}`,
      dataPoints: { invoice_id: row.id, file_name: file.name, classified },
    })

    results.push({
      id: row.id as string,
      fileName: file.name,
      fileUrl,
      status: 'unassigned',
      classified,
      invoiceNumber,
      supplierName,
      amount,
      currency,
    })
  }

  return NextResponse.json({ data: { results }, error: null })
}
