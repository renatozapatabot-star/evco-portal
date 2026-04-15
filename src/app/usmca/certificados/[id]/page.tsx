import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { PageShell, GlassCard, SectionHeader } from '@/components/aguila'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER } from '@/lib/design-system'
import { ORIGIN_CRITERION_LABELS, type UsmcaCertRow } from '@/lib/usmca/types'
import { ApproveActions } from './ApproveActions'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ROLE_LABEL: Record<string, string> = {
  exporter: 'Exportador',
  importer: 'Importador',
  producer: 'Productor',
}

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
        fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8,
        textTransform: 'uppercase', color: TEXT_MUTED, marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 'var(--aguila-fs-body)', color: TEXT_PRIMARY,
        fontFamily: mono ? 'var(--font-jetbrains-mono), monospace' : 'inherit',
      }}>{value || '—'}</div>
    </div>
  )
}

function Party({ title, name, address }: { title: string; name: string | null; address: string | null }) {
  return (
    <div>
      <div style={{
        fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8,
        textTransform: 'uppercase', color: TEXT_MUTED, marginBottom: 4,
      }}>{title}</div>
      <div style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_PRIMARY }}>{name || '—'}</div>
      {address && <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 2 }}>{address}</div>}
    </div>
  )
}

export default async function UsmcaCertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = (await cookies()).get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const { data: cert } = await supabase
    .from('usmca_certificates')
    .select('*')
    .eq('id', id)
    .single<UsmcaCertRow>()

  if (!cert) notFound()

  if (session.role === 'client') {
    if (cert.status !== 'approved') notFound()
    if (cert.company_id && cert.company_id !== session.companyId) notFound()
  }

  const canApprove = ['admin', 'broker'].includes(session.role) && cert.status === 'draft'
  const isDraft = cert.status === 'draft'

  return (
    <PageShell
      title={cert.certificate_number}
      subtitle={isDraft ? 'Borrador · pendiente de firma' : 'Firmado · Patente 3596 honrada'}
      systemStatus={isDraft ? 'warning' : 'healthy'}
    >
      <div style={{ display: 'grid', gap: 20, maxWidth: 1000 }}>
        <div style={{ fontSize: 'var(--aguila-fs-body)' }}>
          <Link href="/usmca/certificados" style={{ color: ACCENT_SILVER, textDecoration: 'none' }}>
            ← Todos los certificados
          </Link>
        </div>

        <GlassCard>
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 20, marginBottom: 20, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{
                fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8,
                textTransform: 'uppercase', color: TEXT_MUTED, marginBottom: 6,
              }}>HS Code · Criterio {cert.origin_criterion}</div>
              <div style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 36, fontWeight: 800, color: TEXT_PRIMARY,
                letterSpacing: 0.5,
              }}>{cert.hs_code}</div>
              <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 6, maxWidth: 480 }}>
                {ORIGIN_CRITERION_LABELS[cert.origin_criterion]}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, lineHeight: 1.6 }}>
              <div>Emitido · {formatDate(cert.created_at)}</div>
              {cert.approved_at && <div>Firmado · {formatDate(cert.approved_at)}</div>}
              {cert.blanket_from && cert.blanket_to && (
                <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_SECONDARY, marginTop: 2 }}>
                  Blanket {cert.blanket_from} → {cert.blanket_to}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
            <Field label="País origen" value={cert.country_of_origin} mono />
            <Field label="Método RVC" value={cert.rvc_method ?? '—'} />
            <Field label="Embarque" value={cert.trafico_id ?? '—'} mono />
          </div>

          <SectionHeader title="Bienes" />
          <p style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY, lineHeight: 1.6, margin: '0 0 20px' }}>
            {cert.goods_description}
          </p>

          <SectionHeader title="Certificador" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <Field label="Rol" value={ROLE_LABEL[cert.certifier_role] ?? cert.certifier_role} />
            <Field label="Nombre" value={cert.certifier_name} />
            <Field label="Cargo" value={cert.certifier_title ?? ''} />
            <Field label="Correo" value={cert.certifier_email ?? ''} />
            <Field label="Teléfono" value={cert.certifier_phone ?? ''} />
            <Field label="Domicilio" value={cert.certifier_address ?? ''} />
          </div>

          <SectionHeader title="Partes" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            <Party title="Exportador" name={cert.exporter_name} address={cert.exporter_address} />
            <Party title="Productor" name={cert.producer_name} address={cert.producer_address} />
            <Party title="Importador" name={cert.importer_name} address={cert.importer_address} />
          </div>

          {cert.notes && (
            <>
              <SectionHeader title="Notas internas" />
              <p style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY, lineHeight: 1.6, margin: '0 0 20px' }}>
                {cert.notes}
              </p>
            </>
          )}

          <div style={{
            paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, flexWrap: 'wrap', gap: 8,
          }}>
            <span>Firma autorizada · Renato Zapata III · Director General · Patente 3596</span>
            {cert.approved_by && (
              <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                Firmado por · {cert.approved_by}
              </span>
            )}
          </div>
        </GlassCard>

        <ApproveActions certId={cert.id} canApprove={canApprove} status={cert.status} />
      </div>
    </PageShell>
  )
}
