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
import { parseCFDI, isCFDIFile } from '@/lib/cfdi/parser'
import { logDecision } from '@/lib/decision-logger'
import { classifyDocumentSmart } from '@/lib/docs/classify'
import { notifyMensajeria } from '@/lib/mensajeria/notify'
import {
  findDuplicates,
  normalizeInvoiceNumber,
  sha256Hex,
  type FindDuplicatesResult,
} from '@/lib/invoice-dedup'

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
  visionExtracted?: boolean
  visionDocType?: string | null
  visionClassificationId?: string | null
  // V1 soft-warning dedup: surfaced but non-blocking. UI renders a
  // "posible duplicado" chip and lets the user decide.
  duplicates?: FindDuplicatesResult
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
    // Fingerprint the bytes before they leave memory. Identical hash =
    // identical file = exact-bucket duplicate.
    const fileHash = sha256Hex(bytes)

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

    // Extraction routing:
    //   · CFDI XML → structured parse (no LLM, authoritative fields)
    //   · PDF       → Sonnet 4.6 native document block
    //   · image     → Sonnet vision
    let invoiceNumber: string | null = null
    let supplierName: string | null = null
    let amount: number | null = null
    let currency: string | null = null
    let supplierRfc: string | null = null
    let invoiceDate: string | null = null
    let classified = false

    if (isCFDIFile(file.name, file.type)) {
      try {
        const xmlText = Buffer.from(buffer).toString('utf-8')
        const cfdi = parseCFDI(xmlText)
        invoiceNumber = cfdi.invoice_number
        supplierName = cfdi.supplier_name
        amount = cfdi.amount
        currency = cfdi.currency
        supplierRfc = cfdi.rfcEmisor
        invoiceDate = cfdi.fecha
        classified = true
      } catch {
        classified = false
      }
    } else if (file.type === 'application/pdf') {
      try {
        const b64 = Buffer.from(buffer).toString('base64')
        const extracted = await extractInvoiceFields({ base64Pdf: b64, mediaType: 'application/pdf' })
        invoiceNumber = extracted.invoice_number
        supplierName = extracted.supplier_name
        amount = extracted.amount
        currency = extracted.currency
        classified = true
      } catch {
        classified = false
      }
    } else if (file.type.startsWith('image/')) {
      try {
        const b64 = Buffer.from(buffer).toString('base64')
        const extracted = await extractInvoiceFields({ base64Image: b64, mediaType: file.type })
        invoiceNumber = extracted.invoice_number
        supplierName = extracted.supplier_name
        amount = extracted.amount
        currency = extracted.currency
        classified = true
      } catch {
        classified = false
      }
    }

    // Dedup check BEFORE insert — so the hash + (rfc,norm) lookups
    // find only pre-existing rows, never the one we're about to write.
    const duplicates = await findDuplicates(supabase, {
      companyId,
      fileHash,
      invoiceNumber,
      supplierName,
      supplierRfc,
      amount,
      currency,
      invoiceDate,
    }).catch(
      (): FindDuplicatesResult => ({ exact: [], near: [], fuzzy: [], total: 0 }),
    )

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
        file_hash: fileHash,
        normalized_invoice_number: normalizeInvoiceNumber(invoiceNumber) || null,
        supplier_rfc: supplierRfc ? supplierRfc.toUpperCase() : null,
      })
      .select('id')
      .single()

    if (insErr || !row) {
      results.push({
        id: '', fileName: file.name, fileUrl, status: 'unassigned', classified,
        invoiceNumber, supplierName, amount, currency, duplicates,
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

    // Phase 2 · unified classifier. Heuristic first (filename + MIME
    // + optional sniff); Vision only when the heuristic is unsure OR
    // we need field extraction. banco-facturas always wants extraction
    // (supplier, amount, line items) so alwaysExtract=true.
    let visionExtracted = false
    let visionDocType: string | null = null
    let visionClassificationId: string | null = null
    try {
      // Sniff the first 2KB for CFDI signature — only useful for XML.
      const sniffHead =
        file.type === 'application/xml' || file.type === 'text/xml'
          ? Buffer.from(buffer).toString('utf-8').slice(0, 2048)
          : null
      const vision = await classifyDocumentSmart({
        fileUrl,
        filename: file.name,
        mimeType: file.type,
        companyId,
        linkToInvoiceBankId: row.id as string,
        actor,
        sniffHead,
        alwaysExtract: true,
      })
      visionClassificationId = vision.classificationId
      if (vision.extraction) {
        visionExtracted = true
        visionDocType = vision.extraction.doc_type
        // Prefill the invoice row with any fields the richer extractor
        // captured that the simpler image extractor missed (PDF path).
        const patch: Record<string, unknown> = {}
        if (!invoiceNumber && vision.extraction.invoice_number) {
          patch.invoice_number = vision.extraction.invoice_number
          invoiceNumber = vision.extraction.invoice_number
        }
        if (!supplierName && vision.extraction.supplier) {
          patch.supplier_name = vision.extraction.supplier
          supplierName = vision.extraction.supplier
        }
        if (amount == null && vision.extraction.amount != null) {
          patch.amount = vision.extraction.amount
          amount = vision.extraction.amount
        }
        if (!currency && vision.extraction.currency) {
          patch.currency = vision.extraction.currency
          currency = vision.extraction.currency
        }
        if (Object.keys(patch).length > 0) {
          await supabase.from('pedimento_facturas').update(patch).eq('id', row.id)
        }
      }
    } catch {
      // graceful — keep the row, surface via visionExtracted=false
    }

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
      visionExtracted,
      visionDocType,
      visionClassificationId,
      duplicates,
    })
  }

  const succeeded = results.filter((r) => !r.error && r.id).length
  if (succeeded > 0) {
    const skipped = results.length - succeeded
    const summary = skipped > 0
      ? `${succeeded} facturas cargadas al banco (${skipped} con errores).`
      : `${succeeded} factura${succeeded === 1 ? '' : 's'} cargada${succeeded === 1 ? '' : 's'} al banco.`
    await notifyMensajeria({
      companyId,
      subject: `Facturas recibidas · ${succeeded}`,
      body: summary,
      internalOnly: true,
      actor: { role: session.role, name: actor },
    })
  }

  return NextResponse.json({ data: { results }, error: null })
}
