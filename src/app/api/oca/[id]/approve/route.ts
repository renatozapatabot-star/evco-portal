import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import type { OcaRow } from '@/lib/oca/types'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión requerida' } }, { status: 401 })
  }
  if (!['admin', 'broker'].includes(session.role)) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Sólo admin o broker pueden aprobar opiniones OCA' } },
      { status: 403 },
    )
  }

  const { data, error } = await supabase
    .from('oca_database')
    .update({
      status: 'approved',
      approved_by: session.role,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'draft')
    .select()
    .single<OcaRow>()

  if (error || !data) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: `OCA no encontrada o ya aprobada: ${error?.message ?? id}` } },
      { status: 404 },
    )
  }

  if (data.trafico_id) {
    await supabase.from('expediente_documentos').insert({
      trafico_id: data.trafico_id,
      company_id: data.company_id,
      doc_type: 'oca_opinion',
      file_name: `${data.opinion_number}.pdf`,
      nombre: `OCA ${data.opinion_number} · ${data.fraccion_recomendada}`,
      source: 'oca_generator',
      uploaded_at: new Date().toISOString(),
    }).select().single().then(() => undefined, () => undefined)
  }

  return NextResponse.json({ data: { opinion: data }, error: null })
}
