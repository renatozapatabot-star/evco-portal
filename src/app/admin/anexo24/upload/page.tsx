/**
 * CRUZ · Admin · Subir Formato 53.
 *
 * Drag-drop XLSX upload → POST to /api/admin/anexo24/upload → show counts
 * + drift preview. Admin/broker only (enforced by middleware + endpoint).
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { PageShell } from '@/components/aguila'
import { Anexo24UploadClient } from './Anexo24UploadClient'

export const dynamic = 'force-dynamic'

export default async function Anexo24UploadPage() {
  const token = (await cookies()).get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (session.role !== 'broker' && session.role !== 'admin') redirect('/')
  return (
    <PageShell title="Subir Formato 53" subtitle="Ingesta canónica de Anexo 24">
      <Anexo24UploadClient companyId={session.companyId} role={session.role} />
    </PageShell>
  )
}
