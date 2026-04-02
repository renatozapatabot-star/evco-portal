import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/xml',
  'application/xml',
])

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    const companyId = request.cookies.get('company_id')?.value
    if (!companyId) {
      return NextResponse.json(
        { data: null, error: { code: 'UNAUTHORIZED', message: 'No company_id cookie' } },
        { status: 401 }
      )
    }

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

    return NextResponse.json({
      data: {
        success: true,
        file_url: fileUrl,
        doc_id: docRecord?.id ?? null,
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
