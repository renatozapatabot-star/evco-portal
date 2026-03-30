import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, unauthorized } from '@/lib/api-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest, { params }: { params: Promise<{ trafico_id: string }> }) {
  const auth = await authenticateApiKey(request)
  if (!auth) return unauthorized()

  const { trafico_id } = await params
  const [expRes, docRes] = await Promise.all([
    supabase.from('expediente_documentos').select('*').or(`pedimento_id.eq.${trafico_id},pedimento_id.eq.${trafico_id.includes('-') ? trafico_id.split('-').slice(1).join('-') : trafico_id}`),
    supabase.from('documents').select('document_type, file_path, metadata').not('metadata', 'is', null),
  ])

  const docs = [
    ...(expRes.data || []).map((d: any) => ({ type: d.doc_type, name: d.nombre, url: d.file_url, source: 'expediente' })),
    ...(docRes.data || []).filter((d: any) => d.metadata?.trafico === trafico_id).map((d: any) => ({ type: d.document_type, url: d.file_path, source: 'documents' })),
  ]

  return NextResponse.json({ trafico_id, documents: docs, count: docs.length })
}
