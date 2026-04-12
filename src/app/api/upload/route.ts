import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TELEGRAM_CHAT = '-5085543275'

async function sendTelegram(msg: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch((err) => console.error('[upload] telegram notify:', err.message))
}

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/xml',
  'application/xml',
])

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

/** Loose filename validation: warn if file name doesn't match expected doc type */
const DOC_TYPE_KEYWORDS: Record<string, string[]> = {
  factura_comercial: ['factura', 'invoice', 'fac', 'fc'],
  packing_list: ['packing', 'empaque', 'lista', 'pl'],
  pedimento_detallado: ['pedimento', 'ped', 'detallado'],
  cove: ['cove', 'valor'],
  acuse_cove: ['acuse', 'cove'],
  doda: ['doda', 'previo'],
  carta_porte: ['carta', 'porte', 'cp'],
  certificado_origen: ['certificado', 'origen', 'tmec', 'usmca', 'co'],
  bill_of_lading: ['bill', 'lading', 'bl', 'conocimiento', 'embarque'],
}

function validateDocRelevance(filename: string, docType: string): { valid: boolean; warning?: string } {
  const keywords = DOC_TYPE_KEYWORDS[docType]
  if (!keywords) return { valid: true } // unknown doc type, skip validation
  const lower = filename.toLowerCase().replace(/[_\-\.]/g, ' ')
  const matches = keywords.some(kw => lower.includes(kw))
  if (!matches) {
    return { valid: true, warning: `El archivo "${filename}" podría no corresponder a ${docType.replace(/_/g, ' ')}` }
  }
  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get('portal_session')?.value || '')
    if (!session) {
      return NextResponse.json(
        { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
        { status: 401 }
      )
    }
    const companyId = session.role === 'client' ? session.companyId : (request.cookies.get('company_id')?.value || session.companyId)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const traficoId = formData.get('trafico_id') as string | null
    const docType = formData.get('doc_type') as string | null

    if (!file || !traficoId || !docType) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Missing file, trafico_id, or doc_type' } },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Archivo excede 10MB' } },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Solo PDF, JPG, PNG, XML' } },
        { status: 400 }
      )
    }

    // Check filename relevance (warning only, not blocking)
    const relevance = validateDocRelevance(file.name, docType)

    // Build storage path: {company_id}/{trafico_id}/{doc_type}_{timestamp}.{ext}
    const ext = file.name.split('.').pop() ?? 'bin'
    const safeDocType = docType.replace(/\s+/g, '_')
    const storagePath = `${companyId}/${traficoId}/${safeDocType}_${Date.now()}.${ext}`

    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    const { error: uploadError } = await supabase.storage
      .from('expedientes')
      .upload(storagePath, bytes, { contentType: file.type, upsert: false })

    if (uploadError) {
      return NextResponse.json(
        { data: null, error: { code: 'INTERNAL_ERROR', message: `Storage: ${uploadError.message}` } },
        { status: 500 }
      )
    }

    const fileUrl = supabase.storage.from('expedientes').getPublicUrl(storagePath).data.publicUrl

    // Insert record into expediente_documentos
    const { data: docRecord, error: dbError } = await supabase
      .from('expediente_documentos')
      .insert({
        pedimento_id: traficoId,
        doc_type: docType,
        file_name: file.name,
        file_url: fileUrl,
        uploaded_by: 'client_portal',
        uploaded_at: new Date().toISOString(),
        company_id: companyId,
      })
      .select('id')
      .single()

    if (dbError) {
      return NextResponse.json(
        { data: null, error: { code: 'INTERNAL_ERROR', message: dbError.message } },
        { status: 500 }
      )
    }

    // Mark any matching solicitation as received
    await supabase
      .from('documento_solicitudes')
      .update({ status: 'recibido', recibido_at: new Date().toISOString() })
      .eq('trafico_id', traficoId)
      .eq('doc_type', docType)
      .eq('status', 'solicitado')
      .then(() => {}, (e) => console.error('[audit-log] upload solicitud:', e.message))

    // Audit log
    supabase.from('audit_log').insert({
      action: 'document_uploaded',
      resource: 'expediente_documentos',
      resource_id: traficoId,
      diff: { doc_type: docType, file_name: file.name, company_id: companyId },
      created_at: new Date().toISOString(),
    }).then(() => {}, (e) => console.error('[audit-log] upload doc:', e.message))

    // Telegram notification
    sendTelegram(
      `📎 <b>${companyId}</b> subió <b>${docType}</b> para ${traficoId}\n` +
      `Archivo: ${file.name}\n— AGUILA 🦀`
    )

    return NextResponse.json({
      data: {
        success: true,
        file_url: fileUrl,
        doc_id: docRecord?.id ?? null,
        warning: relevance.warning ?? null,
      },
      error: null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    )
  }
}
