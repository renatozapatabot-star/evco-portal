/**
 * /reportes — legacy surface (2026-04-18 deprecation).
 *
 * The canonical client experience moved to /anexo-24 when Anexo 24
 * was promoted to primary nav. This route now:
 *   - Redirects CLIENT sessions to /anexo-24 (Ursula's path)
 *   - Preserves the report builder for broker/admin sessions because
 *     internal operators still use the consolidation + multi-cliente
 *     reports which haven't moved yet.
 *
 * Legacy sub-routes (/reportes/anexo-24, /reportes/consolidacion,
 * /reportes/multi-cliente, /reportes/nuevo, /reportes/[id]) stay alive
 * with their original behavior — deep links from emails keep working.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
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

  // Clients land on /anexo-24 — the new canonical surface.
  if (session?.role === 'client') redirect('/anexo-24')

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
