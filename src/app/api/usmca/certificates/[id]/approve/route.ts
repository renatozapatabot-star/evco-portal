import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { buildClaveMap, resolveCompanyIdSlug } from '@/lib/tenant/resolve-slug'
import type { UsmcaCertRow } from '@/lib/usmca/types'

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
      { data: null, error: { code: 'FORBIDDEN', message: 'Sólo admin o broker pueden firmar certificados USMCA' } },
      { status: 403 },
    )
  }

  const { data, error } = await supabase
    .from('usmca_certificates')
    .update({
      status: 'approved',
      approved_by: session.role,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'draft')
    .select()
    .single<UsmcaCertRow>()

  if (error || !data) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: `Certificado no encontrado o ya firmado: ${error?.message ?? id}` } },
      { status: 404 },
    )
  }

  if (data.trafico_id) {
    // Defense in depth: normalize company_id through the slug allowlist
    // before propagating to expediente_documentos. Cheap one-call guard
    // against any future drift on usmca_certificates.company_id.
    const claveMap = await buildClaveMap(supabase)
    const resolved = resolveCompanyIdSlug(data.company_id, claveMap)
    if (resolved.kind === 'unresolved') {
      console.warn(
        `[usmca/approve] skipping expediente_documentos insert: cert id=${id} company_id=${String(data.company_id)} unresolvable (${resolved.reason})`,
      )
    } else {
      await supabase.from('expediente_documentos').insert({
        trafico_id: data.trafico_id,
        company_id: resolved.slug,
        doc_type: 'usmca_certificate',
        file_name: `${data.certificate_number}.pdf`,
        nombre: `USMCA ${data.certificate_number} · ${data.hs_code}`,
        source: 'usmca_generator',
        uploaded_at: new Date().toISOString(),
      }).select().single().then(() => undefined, () => undefined)
    }
  }

  return NextResponse.json({ data: { certificate: data }, error: null })
}
