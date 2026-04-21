/**
 * V1 Polish Pack · Block 3 — doc upload endpoint.
 *
 * Accepts a single file + trafico_id, uploads to the `expedientes`
 * Supabase Storage bucket at `{companyId}/{traficoId}/pending_{ts}.{ext}`,
 * inserts an `expediente_documentos` row with doc_type='pending' and
 * returns the new row id so the client can immediately POST to
 * /api/docs/classify.
 *
 * Mirrors the session + storage pattern of src/app/api/upload/route.ts
 * but lets the classifier pick the doc type instead of the uploader.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const FormSchema = z.object({
  traficoId: z.string().min(1).max(128),
})

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 }
    )
  }

  const companyId =
    session.role === 'client'
      ? session.companyId
      : request.cookies.get('company_id')?.value || session.companyId

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Formulario inválido' } },
      { status: 400 }
    )
  }

  const file = formData.get('file')
  const traficoIdRaw = formData.get('trafico_id')

  const parsed = FormSchema.safeParse({ traficoId: typeof traficoIdRaw === 'string' ? traficoIdRaw : '' })
  if (!parsed.success || !(file instanceof File)) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Falta archivo o trafico_id' } },
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
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Solo PDF, JPG, PNG, WEBP' } },
      { status: 400 }
    )
  }

  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const storagePath = `${companyId}/${parsed.data.traficoId}/pending_${Date.now()}.${ext}`

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

  const { data: docRecord, error: dbError } = await supabase
    .from('expediente_documentos')
    .insert({
      pedimento_id: parsed.data.traficoId,
      doc_type: 'pending',
      document_type: 'pending',
      file_name: file.name,
      file_url: fileUrl,
      uploaded_by: `${session.companyId}:${session.role}`,
      uploaded_at: new Date().toISOString(),
      company_id: companyId,
    })
    .select('id')
    .single()

  if (dbError || !docRecord) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: dbError?.message ?? 'Insert failed' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: {
      docId: docRecord.id as string,
      fileUrl,
      mimeType: file.type,
      fileName: file.name,
    },
    error: null,
  })
}
