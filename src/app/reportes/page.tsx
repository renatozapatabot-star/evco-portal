/**
 * Block 3 — New /reportes root. Builder replaces legacy chart view.
 * Legacy remains at /reportes/legacy. ?legacy=1 redirects there.
 */
import { ReportBuilderPage } from './ReportBuilderPage'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { BG_DEEP } from '@/lib/design-system'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ legacy?: string }>
}) {
  const sp = await searchParams
  return (
    <div style={{ background: BG_DEEP, minHeight: '100vh', padding: '24px 24px 48px' }}>
      <CockpitBrandHeader subtitle="Reportes · Constructor" />
      <ReportBuilderPage legacy={sp.legacy} />
    </div>
  )
}
