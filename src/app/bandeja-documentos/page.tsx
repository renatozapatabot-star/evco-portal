// V2 Doc Intelligence · Phase 3 — Document Inbox server shell.
//
// NOT a nav tile (per founder direction 2026-04-22). Reached only
// via deep link from /banco-facturas + PORTAL AI tools (inbox_summary).
// Tenant + session guard, then hands off to the client surface.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { BG_DEEP } from '@/lib/design-system'
import { BandejaDocumentosClient } from './BandejaDocumentosClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BandejaDocumentosPage() {
  const store = await cookies()
  const token = store.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const companyId =
    session.role === 'client'
      ? session.companyId
      : (store.get('company_id')?.value || session.companyId)

  return (
    <div style={{ background: BG_DEEP, minHeight: '100vh', padding: '24px 24px 48px' }}>
      <CockpitBrandHeader subtitle="Bandeja · Documentos" />
      <BandejaDocumentosClient companyId={companyId} role={session.role} />
    </div>
  )
}
