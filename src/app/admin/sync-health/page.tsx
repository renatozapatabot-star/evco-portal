/**
 * Admin-only sync health dashboard.
 * Per-table freshness + per-script last-run grid. Polls every 60s.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { CockpitBackdrop } from '@/components/cockpit/shared/CockpitBackdrop'
import { COCKPIT_CANVAS } from '@/lib/design-system'
import { SyncHealthClient } from './SyncHealthClient'

export const dynamic = 'force-dynamic'

export default async function SyncHealthPage() {
  const token = (await cookies()).get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (session.role !== 'admin' && session.role !== 'broker') redirect('/')

  return (
    <div
      className="aguila-dark"
      style={{
        position: 'relative',
        background: COCKPIT_CANVAS,
        minHeight: '100vh',
        padding: '32px 24px 48px',
        color: '#E6EDF3',
        overflow: 'hidden',
      }}
    >
      <CockpitBackdrop />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto' }}>
        <CockpitBrandHeader
          subtitle="Sync Health · Tito"
          tagline="Cada tabla, cada cron, una pantalla."
          markSize={48}
        />
        <SyncHealthClient />
      </div>
    </div>
  )
}
