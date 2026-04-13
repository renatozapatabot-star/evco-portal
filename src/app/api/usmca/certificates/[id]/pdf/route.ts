import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import { verifySession } from '@/lib/session'
import { UsmcaPDF } from './pdf-document'
import type { UsmcaCertRow } from '@/lib/usmca/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cert } = await supabase
    .from('usmca_certificates')
    .select('*')
    .eq('id', id)
    .single<UsmcaCertRow>()

  if (!cert) return NextResponse.json({ error: 'Certificado no encontrado' }, { status: 404 })

  if (session.role === 'client') {
    if (cert.status !== 'approved') return NextResponse.json({ error: 'Certificado no disponible' }, { status: 404 })
    const companyId = request.cookies.get('company_id')?.value ?? ''
    if (cert.company_id && cert.company_id !== companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const buffer = await renderToBuffer(UsmcaPDF({ cert }))

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${cert.certificate_number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
