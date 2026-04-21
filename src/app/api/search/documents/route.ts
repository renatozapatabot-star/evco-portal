import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { sanitizeIlike } from '@/lib/sanitize'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/search/documents?q=factura+milacron
 * Searches document_classifications and expediente_documentos by filename, doc_type, and extracted text.
 * Returns up to 50 results, filtered by company_id for clients.
 */
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const companyId = isInternal ? undefined : session.companyId

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] })
  }

  const safeQ = sanitizeIlike(q)

  // Search expediente_documentos (primary doc store)
  let expQuery = supabase
    .from('expediente_documentos')
    .select('id, pedimento_id, doc_type, file_name, file_url, uploaded_at, uploaded_by, company_id')
    .or(`file_name.ilike.%${safeQ}%,doc_type.ilike.%${safeQ}%,pedimento_id.ilike.%${safeQ}%`)
    .order('uploaded_at', { ascending: false })
    .limit(30)

  if (companyId) {
    expQuery = expQuery.eq('company_id', companyId)
  }

  // Search document_classifications (classifier output)
  const classQuery = supabase
    .from('document_classifications')
    .select('id, filename, doc_type, confidence, source, classified_at, extracted_text')
    .or(`filename.ilike.%${safeQ}%,doc_type.ilike.%${safeQ}%,extracted_text.ilike.%${safeQ}%`)
    .order('classified_at', { ascending: false })
    .limit(20)

  const [expRes, classRes] = await Promise.all([expQuery, classQuery])

  const results = [
    ...(expRes.data || []).map(d => ({
      id: `exp-${d.id}`,
      source: 'expediente' as const,
      fileName: d.file_name,
      docType: d.doc_type,
      traficoId: d.pedimento_id,
      fileUrl: d.file_url,
      uploadedAt: d.uploaded_at,
      companyId: d.company_id,
    })),
    ...(classRes.data || []).map(d => ({
      id: `cls-${d.id}`,
      source: 'classification' as const,
      fileName: d.filename,
      docType: d.doc_type,
      traficoId: null,
      fileUrl: null,
      uploadedAt: d.classified_at,
      companyId: null,
    })),
  ]

  return NextResponse.json({ data: results }, {
    headers: { 'Cache-Control': 's-maxage=10, stale-while-revalidate=30' },
  })
}
