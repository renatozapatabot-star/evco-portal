/**
 * PORTAL · /admin/monitor/tenants — per-tenant row-count dashboard.
 *
 * Block EE · Phase 8. Admin/broker-only. For every active company,
 * counts rows across every globalpc_* + operational table so drift
 * from the Block EE baseline becomes visible within minutes.
 *
 * Also counts orphan-* company_ids surfaced by the tenant reassignment
 * script. If a row shows up here with an unknown clave, onboarding
 * missed a mapping.
 *
 * Server component · revalidates every 60s.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { PageShell, GlassCard, AguilaDataTable } from '@/components/aguila'

export const dynamic = 'force-dynamic'
export const revalidate = 60

type Row = {
  company_id: string
  name: string | null
  clave_cliente: string | null
  active: boolean
  productos: number
  partidas: number
  facturas: number
  proveedores: number
  traficos: number
  entradas: number
}

async function countFor(
  supabase: ReturnType<typeof createServerClient>,
  table: string,
  companyId: string,
): Promise<number> {
  try {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'estimated', head: true })
      .eq('company_id', companyId)
    return count ?? 0
  } catch {
    return 0
  }
}

async function orphanCount(
  supabase: ReturnType<typeof createServerClient>,
  table: string,
): Promise<number> {
  try {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'estimated', head: true })
      .like('company_id', 'orphan-%')
    return count ?? 0
  } catch {
    return 0
  }
}

export default async function TenantsMonitorPage() {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')
  if (session.role !== 'admin' && session.role !== 'broker') redirect('/')

  const supabase = createServerClient()

  const { data: companies } = await supabase
    .from('companies')
    .select('company_id, name, clave_cliente, active')
    .eq('active', true)
    .order('company_id')

  const rows: Row[] = []
  for (const c of companies ?? []) {
    const [productos, partidas, facturas, proveedores, traficos, entradas] = await Promise.all([
      countFor(supabase, 'globalpc_productos', c.company_id),
      countFor(supabase, 'globalpc_partidas', c.company_id),
      countFor(supabase, 'globalpc_facturas', c.company_id),
      countFor(supabase, 'globalpc_proveedores', c.company_id),
      countFor(supabase, 'traficos', c.company_id),
      countFor(supabase, 'entradas', c.company_id),
    ])
    rows.push({
      company_id: c.company_id,
      name: c.name,
      clave_cliente: c.clave_cliente,
      active: c.active,
      productos, partidas, facturas, proveedores, traficos, entradas,
    })
  }

  const [orphanProductos, orphanPartidas, orphanFacturas] = await Promise.all([
    orphanCount(supabase, 'globalpc_productos'),
    orphanCount(supabase, 'globalpc_partidas'),
    orphanCount(supabase, 'globalpc_facturas'),
  ])

  const totals = rows.reduce(
    (acc, r) => ({
      productos: acc.productos + r.productos,
      partidas: acc.partidas + r.partidas,
      facturas: acc.facturas + r.facturas,
      proveedores: acc.proveedores + r.proveedores,
      traficos: acc.traficos + r.traficos,
      entradas: acc.entradas + r.entradas,
    }),
    { productos: 0, partidas: 0, facturas: 0, proveedores: 0, traficos: 0, entradas: 0 },
  )

  const fmt = (n: number) => n.toLocaleString('es-MX')

  return (
    <PageShell
      title="Tenants monitor"
      subtitle="Filas por cliente en cada tabla globalpc_* · detecta drift de company_id post-Block-EE"
      maxWidth={1200}
    >
      <GlassCard tier="hero" style={{ marginBottom: 16 }}>
        <h2 className="portal-eyebrow" style={{ color: 'var(--portal-fg-3)', marginBottom: 12 }}>
          Totales · {rows.length} clientes activos
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { label: 'Productos', value: totals.productos },
            { label: 'Partidas', value: totals.partidas },
            { label: 'Facturas', value: totals.facturas },
            { label: 'Proveedores', value: totals.proveedores },
            { label: 'Tráficos', value: totals.traficos },
            { label: 'Entradas', value: totals.entradas },
          ].map((t) => (
            <div key={t.label} style={{ padding: 10 }}>
              <div className="portal-eyebrow" style={{ color: 'var(--portal-fg-4)' }}>{t.label}</div>
              <div className="portal-num" style={{ fontSize: 'var(--portal-fs-lg)', fontWeight: 500 }}>{fmt(t.value)}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      {(orphanProductos + orphanPartidas + orphanFacturas) > 0 && (
        <GlassCard tier="hero" style={{ marginBottom: 16, borderLeft: '3px solid var(--portal-amber, #fbbf24)' }}>
          <h2 className="portal-eyebrow" style={{ color: 'var(--portal-amber, #fbbf24)', marginBottom: 12 }}>
            Orphan rows · onboarding gaps
          </h2>
          <p style={{ color: 'var(--portal-fg-3)', fontSize: 'var(--portal-fs-sm)', margin: '0 0 12px' }}>
            Rows con <code>company_id</code> empezando en <code>orphan-</code> — su <code>cve_cliente</code> no está en la tabla <code>companies</code>.
            No aparecen en ningún cockpit de cliente pero permanecen auditables.
          </p>
          <AguilaDataTable
            ariaLabel="Orphan rows por tabla"
            columns={[
              { key: 'tabla', label: 'Tabla', type: 'text' },
              { key: 'rows', label: 'Rows', type: 'number' },
            ]}
            rows={[
              { tabla: 'globalpc_productos', rows: orphanProductos },
              { tabla: 'globalpc_partidas', rows: orphanPartidas },
              { tabla: 'globalpc_facturas', rows: orphanFacturas },
            ]}
          />
        </GlassCard>
      )}

      <GlassCard tier="hero">
        <h2 className="portal-eyebrow" style={{ color: 'var(--portal-fg-3)', marginBottom: 12 }}>
          Por cliente
        </h2>
        <AguilaDataTable
          ariaLabel="Filas por cliente · drift post-Block-EE"
          columns={[
            {
              key: 'company_id',
              label: 'company_id',
              render: (r) => (
                <span style={{ fontFamily: 'var(--portal-font-mono)', color: 'var(--portal-fg-2)' }}>
                  {r.company_id}
                </span>
              ),
            },
            {
              key: 'clave_cliente',
              label: 'clave',
              render: (r) => (
                <span style={{ fontFamily: 'var(--portal-font-mono)', color: 'var(--portal-fg-4)' }}>
                  {r.clave_cliente ?? '—'}
                </span>
              ),
            },
            { key: 'productos', label: 'productos', type: 'number' },
            { key: 'partidas', label: 'partidas', type: 'number' },
            { key: 'facturas', label: 'facturas', type: 'number' },
            { key: 'proveedores', label: 'proveedores', type: 'number' },
            { key: 'traficos', label: 'tráficos', type: 'number' },
            { key: 'entradas', label: 'entradas', type: 'number' },
          ]}
          rows={rows}
          keyFor={(r) => r.company_id}
        />
      </GlassCard>
    </PageShell>
  )
}
