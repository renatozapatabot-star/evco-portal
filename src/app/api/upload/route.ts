import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const traficoId = formData.get('trafico_id') as string
    const docType = formData.get('doc_type') as string

    if (!file || !traficoId || !docType) {
      return NextResponse.json({ error: 'Missing file, trafico_id, or doc_type' }, { status: 400 })
    }

    // Upload to Supabase Storage
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const fileName = `${traficoId}/${docType}/${Date.now()}_${file.name}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('expedientes')
      .upload(fileName, bytes, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('Storage error:', uploadError.message)
    }

    const fileUrl = uploadData
      ? supabase.storage.from('expedientes').getPublicUrl(fileName).data.publicUrl
      : null

    // Save to expediente_documentos (correct schema)
    const { error: dbError } = await supabase.from('expediente_documentos').insert({
      pedimento_id: traficoId,
      doc_type: docType,
      file_name: file.name,
      file_url: fileUrl,
      uploaded_by: 'portal-upload',
      uploaded_at: new Date().toISOString(),
      company_id: 'evco',
    })

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      trafico_id: traficoId,
      doc_type: docType,
      file_name: file.name,
      file_url: fileUrl,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
