import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { loadPdfRenderer } from '@/lib/pdf/lazy'
import { verifySession } from '@/lib/session'
import { resolveTenantScope } from '@/lib/api/tenant-scope'
import { OcaPDF } from './pdf-document'
import type { OcaRow } from '@/lib/oca/types'

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

  const { data: opinion } = await supabase
    .from('oca_database')
    .select('*')
    .eq('id', id)
    .single<OcaRow>()

  if (!opinion) return NextResponse.json({ error: 'OCA no encontrada' }, { status: 404 })

  if (session.role === 'client') {
    if (opinion.status !== 'approved') return NextResponse.json({ error: 'OCA no disponible' }, { status: 404 })
    // resolveTenantScope returns session.companyId for client role —
    // raw cookie cannot widen the scope. Pre-fix, attacker with any
    // login could flip the company_id cookie to download another
    // tenant's approved OCAs.
    const companyId = resolveTenantScope(session, request)
    if (opinion.company_id && opinion.company_id !== companyId) {
      // Return 404 (not 403) to avoid existence leak — match the
      // tenant-isolation.md catalog rule.
      return NextResponse.json({ error: 'OCA no encontrada' }, { status: 404 })
    }
  }

  const { renderToBuffer } = await loadPdfRenderer()
  const buffer = await renderToBuffer(OcaPDF({ opinion }))

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${opinion.opinion_number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
