/**
 * /reportes — the V1 builder is the only surface.
 * Legacy chart view removed in marathon batch 1.
 */
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'
import { ReportBuilderPage } from './ReportBuilderPage'
import { ReportesKpiStrip } from './ReportesKpiStrip'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { GlassCard } from '@/components/aguila/GlassCard'
import { BG_DEEP } from '@/lib/design-system'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  const isInternal = session?.role === 'admin' || session?.role === 'broker'

  return (
    <div style={{ background: BG_DEEP, minHeight: '100vh', padding: '24px 24px 48px' }}>
      <CockpitBrandHeader subtitle="Reportes · Constructor" />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px' }}>
        <ReportesKpiStrip />

        {isInternal && (
          <GlassCard
            href="/reportes/consolidacion"
            padding="16px 20px"
            style={{ marginBottom: 24 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FBBF24', marginBottom: 4 }}>
                  Pre-audit multi-cliente
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: '#E8EAED', marginBottom: 2 }}>
                  Consolidación · heat map
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.6)' }}>
                  Productos duplicados por fracción, cliente por cliente. Orden: peor primero.
                </div>
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 999,
                background: 'rgba(192,197,206,0.1)',
                border: '1px solid rgba(192,197,206,0.25)',
                color: '#E8EAED',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                Abrir
                <span aria-hidden>→</span>
              </div>
            </div>
          </GlassCard>
        )}
      </div>
      <ReportBuilderPage />
    </div>
  )
}
