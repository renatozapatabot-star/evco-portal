import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { PageShell, GlassCard, SectionHeader } from '@/components/aguila'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER, SILVER_GRADIENT,
} from '@/lib/design-system'
import { isoWeekLabel } from '@/lib/reports/weekly-audit'
import { MultiClientPicker } from './MultiClientPicker'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface Row {
  company_id: string
  name: string
  clave_cliente: string | null
  rfc: string | null
}

async function loadCompanies(): Promise<Row[]> {
  const { data } = await supabase
    .from('companies')
    .select('company_id, name, clave_cliente, rfc')
    .order('name', { ascending: true })
    .limit(200)
  return (data ?? []) as Row[]
}

export default async function MultiClienteReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const sp = await searchParams
  const token = (await cookies()).get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/reportes')

  const companies = await loadCompanies()
  const defaultWeek = sp.week ?? isoWeekLabel(new Date())

  return (
    <PageShell
      title="Auditorías semanales"
      subtitle="Un reporte por cliente, misma plantilla · Patente 3596 · firmado por Renato Zapata III"
      systemStatus="healthy"
    >
      <div style={{ display: 'grid', gap: 20, maxWidth: 1100 }}>
        <GlassCard>
          <SectionHeader title="Semana ISO" />
          <MultiClientPicker defaultWeek={defaultWeek} />
          <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '10px 0 0', lineHeight: 1.6 }}>
            Cambia la semana y los PDFs de abajo apuntan al periodo seleccionado.
            Formato ISO-8601: lunes 00:00 UTC → domingo 23:59:59 UTC.
          </p>
        </GlassCard>

        <SectionHeader title="Clientes" count={companies.length} />

        {companies.length === 0 ? (
          <GlassCard>
            <div style={{ textAlign: 'center', padding: '32px 16px', color: TEXT_SECONDARY }}>
              <div style={{ fontSize: 28, marginBottom: 12, color: ACCENT_SILVER }}>⚑</div>
              <p style={{ fontSize: 14, color: TEXT_PRIMARY, margin: '0 0 4px', fontWeight: 600 }}>
                Aún no hay clientes en el catálogo
              </p>
              <p style={{ fontSize: 12, color: TEXT_MUTED, margin: 0 }}>
                Agrega compañías al registro antes de generar auditorías semanales.
              </p>
            </div>
          </GlassCard>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {companies.map(c => (
              <GlassCard key={c.company_id}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) auto',
                  gap: 20,
                  alignItems: 'center',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, color: TEXT_PRIMARY, fontWeight: 600,
                      marginBottom: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_MUTED, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {c.clave_cliente && (
                        <span>
                          <span style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 4 }}>Clave</span>
                          <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_SECONDARY }}>{c.clave_cliente}</span>
                        </span>
                      )}
                      {c.rfc && (
                        <span>
                          <span style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 4 }}>RFC</span>
                          <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_SECONDARY }}>{c.rfc}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                    {defaultWeek}
                  </div>
                  <a
                    href={`/api/reportes/multi-cliente/${c.company_id}?week=${defaultWeek}`}
                    target="_blank"
                    rel="noopener"
                    style={{
                      display: 'inline-flex', alignItems: 'center',
                      minHeight: 44, padding: '0 18px',
                      background: SILVER_GRADIENT, color: '#0A0A0C',
                      borderRadius: 10, fontSize: 12, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                      textDecoration: 'none',
                    }}
                  >
                    Generar PDF
                  </a>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}
