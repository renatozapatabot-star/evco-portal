/**
 * AGUILA · V1.5 F2 — /admin/quickbooks-export
 *
 * Anabel's one-click accounting handoff: pick date range + entity + format,
 * generate an IIF (or CSV), drag it into QuickBooks Desktop. Bottom section
 * lists the last 20 exports with download links.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { BG_DEEP } from '@/lib/design-system'
import { QuickBooksExportClient } from './QuickBooksExportClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ExportRow {
  id: string
  entity: string
  format: string
  status: string
  date_from: string | null
  date_to: string | null
  file_bytes: number | null
  row_count: number | null
  error: string | null
  created_at: string
  completed_at: string | null
}

export default async function QuickBooksExportPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  if (!session) redirect('/login')
  if (!['contabilidad', 'admin', 'broker'].includes(session.role)) redirect('/inicio')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: recent } = await supabase
    .from('quickbooks_export_jobs')
    .select('id, entity, format, status, date_from, date_to, file_bytes, row_count, error, created_at, completed_at')
    .eq('company_id', session.companyId)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div style={{ background: BG_DEEP, minHeight: '100vh', padding: '24px 24px 48px' }}>
      <CockpitBrandHeader subtitle="QuickBooks · Exportación" />
      <QuickBooksExportClient
        recent={(recent ?? []) as ExportRow[]}
      />
    </div>
  )
}
