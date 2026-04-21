import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import { verifySession } from '@/lib/session'
import { isoWeekLabel, isoWeekRange, loadWeeklyAudit } from '@/lib/reports/weekly-audit'
import { WeeklyAuditPDF } from './pdf-document'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest, context: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await context.params
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'broker'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden — admin o broker requerido' }, { status: 403 })
  }

  const weekParam = request.nextUrl.searchParams.get('week') ?? isoWeekLabel(new Date())

  try {
    isoWeekRange(weekParam)
  } catch {
    return NextResponse.json({ error: 'Parámetro week inválido (YYYY-W##)' }, { status: 400 })
  }

  const audit = await loadWeeklyAudit(supabase, companyId, weekParam)
  if (!audit.company) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  }

  const buffer = await renderToBuffer(WeeklyAuditPDF({ audit }))
  const safeName = (audit.company.name ?? 'cliente').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cliente'
  const filename = `${safeName}-Audit-${weekParam}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
