import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { getConsolidationReport } from '@/lib/catalogo/consolidation-report'
import { GlassCard } from '@/components/aguila/GlassCard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ConsolidacionReportPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (session.role !== 'admin' && session.role !== 'broker') {
    redirect('/')
  }

  const supabase = createServerClient()
  const rows = await getConsolidationReport(supabase)

  const totalProducts = rows.reduce((s, r) => s + r.total_products, 0)
  const totalDedup = rows.reduce((s, r) => s + r.dedup_pool, 0)
  const totalCandidates = rows.reduce((s, r) => s + r.consolidation_candidates, 0)
  const totalUnclassified = rows.reduce((s, r) => s + r.unclassified_count, 0)

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <Link href="/reportes" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 13 }}>
        ← Reportes
      </Link>
      <h1 style={{ margin: '12px 0 4px', fontSize: 'var(--aguila-fs-title)', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
        Consolidación · heat map multi-cliente
      </h1>
      <p style={{ margin: '0 0 20px', fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.6)', maxWidth: 720 }}>
        Productos duplicados por fracción, por cliente. Orden: peor primero. Haz clic en el cliente para ver su catálogo consolidado.
      </p>

      <GlassCard padding="16px 20px" style={{ marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          <TotalStat label="Clientes" value={rows.length.toLocaleString('es-MX')} />
          <TotalStat label="Productos totales" value={totalProducts.toLocaleString('es-MX')} />
          <TotalStat
            label="Sin clasificar"
            value={totalUnclassified.toLocaleString('es-MX')}
            tone={totalUnclassified > 0 ? 'amber' : undefined}
          />
          <TotalStat
            label="Fracciones a consolidar"
            value={totalCandidates.toLocaleString('es-MX')}
            tone={totalCandidates > 0 ? 'amber' : undefined}
          />
          <TotalStat
            label="Variantes duplicadas"
            value={totalDedup.toLocaleString('es-MX')}
            tone={totalDedup > 0 ? 'amber' : undefined}
          />
        </div>
      </GlassCard>

      {rows.length === 0 ? (
        <GlassCard padding="24px 20px">
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
            Sin productos sincronizados todavía.
          </p>
        </GlassCard>
      ) : (
        <GlassCard padding="0" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--aguila-fs-body)' }}>
            <thead>
              <tr style={{ background: 'rgba(192,197,206,0.06)' }}>
                <Th>Cliente</Th>
                <Th align="right">Productos</Th>
                <Th align="right">Fracciones</Th>
                <Th align="right">Sin clasificar</Th>
                <Th align="right">A consolidar</Th>
                <Th align="right">Variantes dup.</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <ReportRow key={r.company_id} row={r} />)}
            </tbody>
          </table>
        </GlassCard>
      )}
    </div>
  )
}

function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      textAlign: align,
      padding: '12px 16px',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.5)',
      borderBottom: '1px solid rgba(192,197,206,0.12)',
    }}>
      {children}
    </th>
  )
}

type Row = Awaited<ReturnType<typeof getConsolidationReport>>[number]

function ReportRow({ row }: { row: Row }) {
  const isWorst = row.dedup_pool >= 50
  return (
    <tr style={{ borderBottom: '1px solid rgba(192,197,206,0.06)' }}>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
          {row.company_name}
        </div>
        {row.company_clave && (
          <div className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            {row.company_clave}
          </div>
        )}
      </td>
      <Td align="right" mono>{row.total_products.toLocaleString('es-MX')}</Td>
      <Td align="right" mono>{row.fraccion_count.toLocaleString('es-MX')}</Td>
      <Td align="right" mono tone={row.unclassified_count > 0 ? 'amber' : 'muted'}>
        {row.unclassified_count.toLocaleString('es-MX')}
      </Td>
      <Td align="right" mono tone={row.consolidation_candidates > 0 ? 'amber' : 'muted'}>
        {row.consolidation_candidates.toLocaleString('es-MX')}
      </Td>
      <Td align="right" mono tone={isWorst ? 'red' : row.dedup_pool > 0 ? 'amber' : 'muted'}>
        {row.dedup_pool.toLocaleString('es-MX')}
      </Td>
      <Td align="right">
        <Link
          href={`/admin/eagle?viewing_as=${encodeURIComponent(row.company_id)}`}
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#E8EAED',
            background: 'rgba(192,197,206,0.08)',
            border: '1px solid rgba(192,197,206,0.2)',
            borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          Ver
        </Link>
      </Td>
    </tr>
  )
}

function Td({
  children, align = 'left', mono, tone,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  mono?: boolean
  tone?: 'amber' | 'red' | 'muted'
}) {
  const color = tone === 'red' ? '#EF4444' : tone === 'amber' ? '#FBBF24' : tone === 'muted' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)'
  return (
    <td style={{
      padding: '12px 16px',
      textAlign: align,
      color,
      fontFamily: mono ? 'var(--font-jetbrains-mono), monospace' : undefined,
      fontWeight: mono ? 600 : undefined,
    }}>
      {children}
    </td>
  )
}

function TotalStat({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
        {label}
      </span>
      <span className="font-mono" style={{ fontSize: 22, fontWeight: 800, color: tone === 'amber' ? '#FBBF24' : '#E8EAED' }}>
        {value}
      </span>
    </div>
  )
}
