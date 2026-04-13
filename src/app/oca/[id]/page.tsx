import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { PageShell, GlassCard, SectionHeader } from '@/components/aguila'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER } from '@/lib/design-system'
import type { OcaRow } from '@/lib/oca/types'
import { ApproveActions } from './ApproveActions'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Chicago',
  })
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
        textTransform: 'uppercase', color: TEXT_MUTED, marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 13, color: TEXT_PRIMARY,
        fontFamily: mono ? 'var(--font-jetbrains-mono), monospace' : 'inherit',
      }}>{value || '—'}</div>
    </div>
  )
}

export default async function OcaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = (await cookies()).get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const { data: opinion } = await supabase
    .from('oca_database')
    .select('*')
    .eq('id', id)
    .single<OcaRow>()

  if (!opinion) notFound()

  if (session.role === 'client') {
    if (opinion.status !== 'approved') notFound()
    if (opinion.company_id && opinion.company_id !== session.companyId) notFound()
  }

  const canApprove = ['admin', 'broker'].includes(session.role) && opinion.status === 'draft'
  const isDraft = opinion.status === 'draft'

  return (
    <PageShell
      title={opinion.opinion_number}
      subtitle={isDraft ? 'Borrador · pendiente de aprobación' : 'Aprobada · Patente 3596 honrada'}
      systemStatus={isDraft ? 'warning' : 'healthy'}
    >
      <div style={{ display: 'grid', gap: 20, maxWidth: 900 }}>
        <div style={{ fontSize: 13 }}>
          <Link href="/oca" style={{ color: ACCENT_SILVER, textDecoration: 'none' }}>
            ← Todas las opiniones
          </Link>
        </div>

        <GlassCard>
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 20, marginBottom: 20, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                textTransform: 'uppercase', color: TEXT_MUTED, marginBottom: 6,
              }}>Fracción recomendada</div>
              <div style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 36, fontWeight: 800, color: TEXT_PRIMARY,
                letterSpacing: 0.5,
              }}>{opinion.fraccion_recomendada}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: TEXT_MUTED, lineHeight: 1.6 }}>
              <div>Generada · {formatDate(opinion.created_at)}</div>
              {opinion.approved_at && <div>Aprobada · {formatDate(opinion.approved_at)}</div>}
              {opinion.vigencia_hasta && (
                <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_SECONDARY, marginTop: 2 }}>
                  Vigencia hasta {opinion.vigencia_hasta}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
            <Field label="País de origen" value={opinion.pais_origen} />
            <Field label="Uso final" value={opinion.uso_final ?? ''} />
            <Field label="T-MEC" value={opinion.tmec_elegibilidad ? 'Elegible · 0%' : 'No elegible'} />
            <Field label="NOM aplicable" value={opinion.nom_aplicable ?? 'Ninguna'} />
          </div>

          <SectionHeader title="Producto" />
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6, margin: '0 0 20px' }}>
            {opinion.product_description}
          </p>

          <SectionHeader title="Fundamento legal" />
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6, margin: '0 0 20px' }}>
            {opinion.fundamento_legal}
          </p>

          <div style={{
            paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 11, color: TEXT_MUTED, flexWrap: 'wrap', gap: 8,
          }}>
            <span>Firmada por Renato Zapata III · Director General · Patente 3596</span>
            {opinion.approved_by && (
              <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                Aprobada por · {opinion.approved_by}
              </span>
            )}
          </div>
        </GlassCard>

        <ApproveActions
          opinionId={opinion.id}
          canApprove={canApprove}
          status={opinion.status}
        />
      </div>
    </PageShell>
  )
}
