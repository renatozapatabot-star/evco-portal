/**
 * /reportes — the V1 builder is the only surface.
 * Legacy chart view removed in marathon batch 1.
 */
import { ReportBuilderPage } from './ReportBuilderPage'
import { ReportesKpiStrip } from './ReportesKpiStrip'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { BG_DEEP } from '@/lib/design-system'

export const dynamic = 'force-dynamic'

export default async function Page() {
  return (
    <div style={{ background: BG_DEEP, minHeight: '100vh', padding: '24px 24px 48px' }}>
      <CockpitBrandHeader subtitle="Reportes · Constructor" />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px' }}>
        <ReportesKpiStrip />
      </div>
      <ReportBuilderPage />
    </div>
  )
}
