/**
 * /operador/bodega — VICENTE's cockpit.
 *
 * Primary surface: entradas queue + storage locations. Key actions: receive,
 * set location, upload photo, authorize release.
 */
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Suspense } from 'react'
import { CockpitInicio, CockpitSkeleton, GlassCard, SectionHeader } from '@/components/aguila'
import { AsistenteButton } from '@/components/aguila/AsistenteButton'
import { ChainView, type ChainNode } from '@/components/aguila/ChainView'
import { loadRoleCockpit } from '../_components/roleCockpitLoader'
import { TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BodegaCockpitPage() {
  const jar = await cookies()
  const role = jar.get('user_role')?.value
  const name = jar.get('operator_name')?.value || 'Vicente'
  if (!role || !['admin', 'broker', 'operator'].includes(role)) redirect('/')
  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <BodegaCockpitContent name={name} />
    </Suspense>
  )
}

async function BodegaCockpitContent({ name }: { name: string }) {
  const data = await loadRoleCockpit('warehouse').catch(() => null)
  if (!data) {
    return (
      <div style={{ padding: 40, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
        No se pudo cargar el cockpit de bodega.
      </div>
    )
  }

  const estado = (
    <GlassCard size="card" ariaLabel="Recepción y ubicaciones">
      <SectionHeader title="Tráficos con entrada pendiente" count={data.recentTraficos.length} action={{ label: 'Ir a bodega', href: '/bodega' }} />
      {data.recentTraficos.length === 0 ? (
        <div style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body, 13px)', padding: '12px 0' }}>
          Sin entradas pendientes.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {data.recentTraficos.slice(0, 5).map((t) => {
            const chain: ChainNode[] = [
              { kind: 'entrada',   label: 'Entrada',   value: null,        date: null,         status: 'missing' },
              { kind: 'factura',   label: 'Factura',   value: null,        date: null,         status: 'missing' },
              { kind: 'pedimento', label: 'Pedimento', value: t.pedimento, date: t.updated_at, status: t.pedimento ? 'linked' : 'pending' },
              { kind: 'trafico',   label: 'Tráfico',   value: t.trafico,   date: t.updated_at, status: 'linked', href: `/traficos/${t.id}` },
              { kind: 'expediente',label: 'Despacho',  value: null,        date: null,         status: 'pending' },
            ]
            return (
              <div key={t.id}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  marginBottom: 6,
                }}>
                  <Link href={`/traficos/${t.id}`} style={{
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontWeight: 700,
                    color: TEXT_PRIMARY,
                    fontSize: 'var(--aguila-fs-body, 13px)',
                    textDecoration: 'none',
                  }}>
                    {t.trafico}
                  </Link>
                  <span style={{ color: TEXT_SECONDARY, fontSize: 'var(--aguila-fs-meta, 11px)' }}>
                    {t.estatus}
                  </span>
                </div>
                <ChainView nodes={chain} compact ariaLabel={`Cadena de bodega para ${t.trafico}`} />
              </div>
            )
          })}
        </div>
      )}
    </GlassCard>
  )

  return (
    <>
      <CockpitInicio
        role="warehouse"
        name={name}
        heroKPIs={data.heroKPIs}
        navCounts={data.navCounts}
        summaryLine={data.summaryLine}
        systemStatus={data.systemStatus}
        estadoSections={estado}
        metaPills={[{ label: 'Rol', value: 'Bodega', tone: 'silver' }]}
      />
      <AsistenteButton roleTag="warehouse" />
    </>
  )
}
