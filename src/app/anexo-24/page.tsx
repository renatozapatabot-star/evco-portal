// CRUZ · /anexo-24 — pure Formato 53 report surface.
//
// Phase 3 of the Block CC redesign: the SKU/Fracción browsing moved to
// /catalogo where it belongs as inventory management. /anexo-24 now does
// one thing well: generate + download the Formato 53 (PDF + XLSX) for a
// chosen period, with a link to the admin ingest for anyone who needs
// to refresh the SAT truth source.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ClipboardList, ExternalLink, FileText, Upload, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { getAnexoSnapshot, type AnexoSnapshot } from '@/lib/anexo24/snapshot'
import { cleanCompanyDisplayName } from '@/lib/format/company-name'
import { PageShell, GlassCard, CockpitSkeleton, CockpitErrorCard } from '@/components/aguila'
import { Anexo24DownloadCta } from './Anexo24DownloadCta'

const PRIMARY_TEXT = '#E6EDF3' // design-token
const STATUS_GREEN = '#86EFAC' // design-token
const STATUS_GOLD = '#F4D47A'  // design-token

export const dynamic = 'force-dynamic'
export const revalidate = 60

type SessionLike = { companyId: string; role: string; name?: string }

export default async function Anexo24Page() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <Anexo24Content session={session} />
    </Suspense>
  )
}

async function Anexo24Content({ session }: { session: SessionLike }) {
  try {
    const supabase = createServerClient()
    const cookieStore = await cookies()
    const rawClientName = decodeURIComponent(cookieStore.get('company_name')?.value ?? '')
    const clientName = cleanCompanyDisplayName(rawClientName) || 'Cliente'
    const isInternal = session.role === 'broker' || session.role === 'admin'

    // Thin snapshot — the report surface no longer browses inventory.
    // We only need `recent_docs` (for Descargas recientes) and
    // `last_updated_iso` (for the ingest freshness badge).
    const snapshot = await getAnexoSnapshot(supabase, session.companyId, { q: '', limit: 1 })
    snapshot.client_name = clientName

    // Recent anexo24_ingest sync_log entry — shows the last time Formato 53 was refreshed.
    let lastIngest: { completed_at: string | null; rows_synced: number | null } | null = null
    try {
      const { data } = await supabase
        .from('sync_log')
        .select('completed_at, rows_synced, status')
        .eq('sync_type', 'anexo24_ingest')
        .eq('status', 'success')
        .eq('company_id', session.companyId)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      lastIngest = data as typeof lastIngest
    } catch { /* non-fatal */ }

    return <Anexo24Surface snapshot={snapshot} isInternal={isInternal} lastIngest={lastIngest} />
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'NEXT_REDIRECT' || msg === 'NEXT_NOT_FOUND') throw err
    return <CockpitErrorCard message={`No se pudo cargar Anexo 24: ${msg}`} />
  }
}

function Anexo24Surface({
  snapshot,
  isInternal,
  lastIngest,
}: {
  snapshot: AnexoSnapshot
  isInternal: boolean
  lastIngest: { completed_at: string | null; rows_synced: number | null } | null
}) {
  const { recent_docs, client_name } = snapshot
  const subtitleParts = [client_name, 'Patente 3596 · Aduana 240'].filter(Boolean)

  return (
    <PageShell title="Anexo 24" subtitle={subtitleParts.join(' · ')} maxWidth={960}>
      <div className="aguila-reveal">
        {/* Context + primary action */}
        <section className="aguila-reveal" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <ClipboardList size={18} color="rgba(192,197,206,0.85)" strokeWidth={1.8} aria-hidden />
            <span style={{
              fontSize: 'var(--aguila-fs-meta, 11px)',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(192,197,206,0.78)',
            }}>
              Formato 53 · Reporte oficial para SAT
            </span>
          </div>
          <p style={{
            margin: '0 0 20px',
            fontSize: 'var(--aguila-fs-section, 15px)',
            color: 'rgba(230,237,243,0.82)',
            lineHeight: 1.55,
            maxWidth: 640,
          }}>
            Genera y descarga el Formato 53 oficial del Anexo 24 — el documento
            que el SAT audita. Elige el periodo (mes, trimestre, año completo o
            rango personalizado) y descarga PDF + Excel con las 41 columnas
            SAT-canónicas. Tu <Link href="/catalogo" style={{ color: STATUS_GOLD, textDecoration: 'underline' }}>Catálogo</Link>{' '}
            muestra la misma verdad, partida por partida.
          </p>
          <Anexo24DownloadCta companyId={snapshot.company_id} isInternal={isInternal} />
        </section>

        {/* Última ingesta badge */}
        {lastIngest?.completed_at && (
          <section className="aguila-reveal aguila-reveal-delay-1" style={{ marginBottom: 24 }}>
            <GlassCard padding="12px 16px">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 'var(--aguila-fs-meta, 11px)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'rgba(192,197,206,0.7)',
                  fontWeight: 600,
                }}>Última ingesta SAT</span>
                <span style={{ color: STATUS_GREEN, fontSize: 'var(--aguila-fs-body, 13px)', fontWeight: 600 }}>
                  {formatRelative(lastIngest.completed_at)}
                </span>
                <span style={{ color: 'rgba(192,197,206,0.5)', fontSize: 'var(--aguila-fs-meta, 11px)' }}>·</span>
                <span style={{ color: 'rgba(192,197,206,0.78)', fontSize: 'var(--aguila-fs-body, 13px)' }}>
                  {(lastIngest.rows_synced ?? 0).toLocaleString('es-MX')} partes versionadas
                </span>
                <span style={{ color: 'rgba(192,197,206,0.55)', fontSize: 'var(--aguila-fs-meta, 11px)' }}>
                  {formatAbsolute(lastIngest.completed_at)}
                </span>
              </div>
            </GlassCard>
          </section>
        )}

        {/* Admin-only: re-upload link */}
        {isInternal && (
          <section className="aguila-reveal aguila-reveal-delay-2" style={{ marginBottom: 24 }}>
            <Link
              href="/admin/anexo24/upload"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 10,
                background: 'rgba(192,197,206,0.06)',
                border: '1px solid rgba(192,197,206,0.2)',
                color: PRIMARY_TEXT,
                textDecoration: 'none',
                fontSize: 'var(--aguila-fs-body, 13px)',
                fontWeight: 600,
                transition: 'border-color var(--dur-fast, 150ms) ease, background var(--dur-fast, 150ms) ease',
              }}
            >
              <Upload size={14} strokeWidth={2} />
              Subir Formato 53 más reciente
            </Link>
          </section>
        )}

        {/* Descargas recientes */}
        {recent_docs.length > 0 && (
          <section className="aguila-reveal aguila-reveal-delay-3" style={{ marginBottom: 24 }}>
            <h2 style={{
              margin: '0 0 12px',
              fontSize: 'var(--aguila-fs-section, 15px)',
              fontWeight: 600,
              color: PRIMARY_TEXT,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Descargas recientes
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
            }}>
              {recent_docs.slice(0, 10).map((doc) => (
                <GlassCard key={doc.id} tier="tertiary" size="compact" href={doc.storage_url}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <FileText size={16} strokeWidth={1.8} color="rgba(192,197,206,0.7)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 'var(--aguila-fs-body, 13px)', fontWeight: 600, color: PRIMARY_TEXT }}>{doc.label}</div>
                      {doc.sub && (
                        <div style={{
                          fontSize: 'var(--aguila-fs-meta, 11px)',
                          color: 'rgba(148,163,184,0.7)',
                          fontFamily: 'var(--font-mono)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>{doc.sub}</div>
                      )}
                      <div style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: 'rgba(122,126,134,0.8)', marginTop: 4 }}>
                        {formatAbsolute(doc.timestamp_iso)}
                      </div>
                    </div>
                    <ExternalLink size={12} strokeWidth={1.8} color="rgba(192,197,206,0.5)" style={{ flexShrink: 0 }} />
                  </div>
                </GlassCard>
              ))}
            </div>
          </section>
        )}

        {/* Cross-link to Catálogo */}
        <section className="aguila-reveal aguila-reveal-delay-3">
          <Link
            href="/catalogo"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 'var(--aguila-fs-meta, 11px)',
              color: 'rgba(192,197,206,0.7)',
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            <BookOpen size={12} strokeWidth={1.8} />
            Explorar el Catálogo → partes, proveedores, cobertura SAT
          </Link>
        </section>
      </div>
    </PageShell>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days < 1) return 'hoy'
  if (days === 1) return 'hace 1 día'
  if (days < 30) return `hace ${days} días`
  const months = Math.floor(days / 30)
  if (months === 1) return 'hace 1 mes'
  return `hace ${months} meses`
}

function formatAbsolute(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      timeZone: 'America/Chicago',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}
