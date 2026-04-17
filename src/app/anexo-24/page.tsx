// CRUZ · /anexo-24 — IMMEX inventory control surface (v1).
//
// Anexo 24 (Formato 53 from GlobalPC.net) is the SAT-audit truth
// document for every IMMEX client and, per Renato IV's 2026-04-18
// decision, the canonical product reference for merchandise name,
// part number, and tariff fraction across CRUZ. Promoted from
// sub-report under /reportes to first-class nav tile #6.
//
// Phase 1 (tonight): this page is the hero surface — KPI strip,
// prominent Formato 53 download CTA, searchable SKU table, recent
// linked docs. Data sources from globalpc_productos via the
// snapshot helper. Phase 3 will replace the helper's internals with
// a canonical anexo24_parts table + nightly Formato 53 ingest.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ClipboardList, ExternalLink, FileText, Search, Boxes, List } from 'lucide-react'
import Link from 'next/link'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { getAnexoSnapshot, type AnexoSnapshot } from '@/lib/anexo24/snapshot'
import { getAnexoByFraccion, type ByFraccionSnapshot } from '@/lib/anexo24/by-fraccion'
import { cleanCompanyDisplayName } from '@/lib/format/company-name'
import { PageShell, GlassCard, KPITile, CockpitSkeleton, CockpitErrorCard } from '@/components/aguila'
import { CalmEmptyState } from '@/components/cockpit/client/CalmEmptyState'
import { Anexo24SkuTable } from './Anexo24SkuTable'
import { Anexo24FraccionGrid } from './Anexo24FraccionGrid'
import { Anexo24DownloadCta } from './Anexo24DownloadCta'

export const dynamic = 'force-dynamic'
// 60s revalidate smooths KPI fluctuation during rapid refresh — same
// pattern used on /catalogo after the Saturday stability pass.
export const revalidate = 60

type SessionLike = {
  companyId: string
  role: string
  name?: string
}

type ViewMode = 'skus' | 'fracciones'

export default async function Anexo24Page({ searchParams }: { searchParams?: Promise<{ q?: string; view?: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const sp = (await searchParams) ?? {}
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const view: ViewMode = sp.view === 'fracciones' ? 'fracciones' : 'skus'

  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <Anexo24Content session={session} q={q} view={view} />
    </Suspense>
  )
}

async function Anexo24Content({ session, q, view }: { session: SessionLike; q: string; view: ViewMode }) {
  try {
    const supabase = createServerClient()
    const cookieStore = await cookies()
    // Use the canonical helper so legal suffixes (S.DE R.L. DE C.V., etc.)
    // don't leak into the Anexo 24 subheader. Same chemistry as /inicio.
    const rawClientName = decodeURIComponent(cookieStore.get('company_name')?.value ?? '')
    const clientName = cleanCompanyDisplayName(rawClientName) || 'Cliente'

    const isInternal = session.role === 'broker' || session.role === 'admin'

    if (view === 'fracciones') {
      // By-fracción surface — consolidates 148K SKUs into ~500 cards.
      // Still fetches the flat SKU snapshot for the KPI strip at the
      // top (count/YTD/proveedores read off the same numbers) while
      // grouping runs in parallel.
      const [snapshot, grouped] = await Promise.all([
        getAnexoSnapshot(supabase, session.companyId, { q: '', limit: 1 }),
        getAnexoByFraccion(supabase, session.companyId, { q, limit: 2000 }),
      ])
      snapshot.client_name = clientName
      grouped.client_name = clientName
      return <Anexo24Surface snapshot={snapshot} grouped={grouped} view={view} isInternal={isInternal} query={q} />
    }

    const snapshot = await getAnexoSnapshot(supabase, session.companyId, { q, limit: 300 })
    snapshot.client_name = clientName
    return <Anexo24Surface snapshot={snapshot} view={view} isInternal={isInternal} query={q} />
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'NEXT_REDIRECT' || msg === 'NEXT_NOT_FOUND') throw err
    return <CockpitErrorCard message={`No se pudo cargar Anexo 24: ${msg}`} />
  }
}

function Anexo24Surface({
  snapshot,
  grouped,
  view,
  isInternal,
  query,
}: {
  snapshot: AnexoSnapshot
  grouped?: ByFraccionSnapshot
  view: ViewMode
  isInternal: boolean
  query: string
}) {
  const { kpis, skus, recent_docs, client_name } = snapshot
  const hasData = kpis.total_skus > 0
  const fraccionCount = grouped?.fraccion_count ?? kpis.unique_fracciones

  const subtitleParts = [
    `${client_name}`,
    'Patente 3596 · Aduana 240',
  ].filter(Boolean)

  return (
    <PageShell
      title="Anexo 24"
      subtitle={subtitleParts.join(' · ')}
      maxWidth={1200}
    >
      <div className="aguila-reveal">
        {/* Context line + primary download CTA — the "this is the most
            important doc" moment. Gold gradient used here intentionally
            per core-invariant #2 (gold = CTA-only). */}
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
              Formato 53 · Control de inventario IMMEX
            </span>
          </div>
          <p style={{
            margin: '0 0 20px',
            fontSize: 'var(--aguila-fs-section, 15px)',
            color: 'rgba(230,237,243,0.82)',
            lineHeight: 1.55,
            maxWidth: 640,
          }}>
            Tu inventario oficial IMMEX. Este es el documento que SAT audita —
            mismo número de parte, misma descripción, misma fracción
            arancelaria que aparecen en cada pedimento y en tu Formato 53
            de GlobalPC.net.
          </p>

          {hasData ? (
            <Anexo24DownloadCta companyId={snapshot.company_id} isInternal={isInternal} />
          ) : (
            <CalmEmptyState
              icon="report"
              title="Anexo 24 aparecerá aquí cuando clasifiquemos tus productos"
              message="El control de inventario IMMEX se llena automáticamente conforme CRUZ sincroniza y clasifica tus partes. Contáctanos si hace falta un impulso inicial."
            />
          )}
        </section>

        {/* KPI strip — 6 tiles, all read from count queries (not slice) */}
        {hasData && (
          <section
            className="aguila-reveal aguila-reveal-delay-1"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <KPITile
              label="SKUs totales"
              value={kpis.total_skus.toLocaleString('es-MX')}
              sublabel="en tu Anexo 24"
              compact
            />
            <KPITile
              label="Clasificados"
              value={`${kpis.classified_pct}%`}
              sublabel={`${kpis.classified_count.toLocaleString('es-MX')} con fracción`}
              compact
            />
            <KPITile
              label="Por clasificar"
              value={kpis.unclassified_count.toLocaleString('es-MX')}
              sublabel={kpis.unclassified_count === 0 ? 'Todos clasificados' : 'SKUs pendientes'}
              compact
              inverted
            />
            <KPITile
              label="Fracciones únicas"
              value={kpis.unique_fracciones.toLocaleString('es-MX')}
              sublabel="códigos arancelarios"
              compact
            />
            <KPITile
              label="Proveedores"
              value={kpis.active_proveedores.toLocaleString('es-MX')}
              sublabel="vinculados a tus partes"
              compact
            />
            <KPITile
              label="Última actualización"
              value={kpis.last_updated_iso ? formatRelative(kpis.last_updated_iso) : 'Sin movimiento'}
              sublabel={kpis.last_updated_iso ? formatAbsolute(kpis.last_updated_iso) : '—'}
              compact
            />
          </section>
        )}

        {/* View toggle + SKU/Fraccion body */}
        {hasData && (
          <section className="aguila-reveal aguila-reveal-delay-2" style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
              flexWrap: 'wrap',
              gap: 10,
            }}>
              <h2 style={{
                margin: 0,
                fontSize: 'var(--aguila-fs-section, 15px)',
                fontWeight: 600,
                color: '#E6EDF3',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {view === 'fracciones'
                  ? `Fracciones · ${fraccionCount} tarifas`
                  : `Inventario · ${skus.length} de ${kpis.total_skus}`}
              </h2>
              <div
                role="tablist"
                aria-label="Cambiar vista"
                style={{
                  display: 'inline-flex',
                  padding: 4,
                  borderRadius: 12,
                  background: 'rgba(0,0,0,0.28)',
                  border: '1px solid rgba(192,197,206,0.12)',
                  gap: 4,
                }}
              >
                <Link
                  href={`/anexo-24${query ? `?q=${encodeURIComponent(query)}` : ''}`}
                  role="tab"
                  aria-selected={view === 'skus'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    minHeight: 44,
                    borderRadius: 9,
                    background: view === 'skus' ? 'rgba(192,197,206,0.14)' : 'transparent',
                    color: view === 'skus' ? '#E6EDF3' : 'rgba(192,197,206,0.68)',
                    textDecoration: 'none',
                    fontSize: 'var(--aguila-fs-meta, 11px)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    border: view === 'skus' ? '1px solid rgba(192,197,206,0.22)' : '1px solid transparent',
                  }}
                >
                  <List size={14} strokeWidth={2} /> Por SKU
                </Link>
                <Link
                  href={`/anexo-24?view=fracciones${query ? `&q=${encodeURIComponent(query)}` : ''}`}
                  role="tab"
                  aria-selected={view === 'fracciones'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    minHeight: 44,
                    borderRadius: 9,
                    background: view === 'fracciones' ? 'rgba(201,167,74,0.18)' : 'transparent',
                    color: view === 'fracciones' ? '#F4D47A' : 'rgba(192,197,206,0.68)',
                    textDecoration: 'none',
                    fontSize: 'var(--aguila-fs-meta, 11px)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    border: view === 'fracciones' ? '1px solid rgba(201,167,74,0.42)' : '1px solid transparent',
                  }}
                >
                  <Boxes size={14} strokeWidth={2} /> Por Fracción
                </Link>
              </div>
            </div>

            {view === 'fracciones' && grouped ? (
              <Anexo24FraccionGrid groups={grouped.groups} initialQuery={query} />
            ) : (
              <Anexo24SkuTable skus={skus} initialQuery={query} />
            )}

            {view === 'fracciones' && grouped && grouped.total_unclassified > 0 && (
              <div
                role="status"
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(251,191,36,0.06)',
                  border: '1px solid rgba(251,191,36,0.18)',
                  fontSize: 'var(--aguila-fs-meta, 11px)',
                  color: 'rgba(230,237,243,0.82)',
                  letterSpacing: '0.02em',
                }}
              >
                {grouped.total_unclassified.toLocaleString('es-MX')} SKU{grouped.total_unclassified === 1 ? '' : 's'} todavía por clasificar no aparecen en esta vista — aparecerán aquí conforme CRUZ les asigne fracción.
              </div>
            )}
          </section>
        )}

        {/* Recent docs hub — "this is the most important doc" signal */}
        {recent_docs.length > 0 && (
          <section className="aguila-reveal aguila-reveal-delay-3" style={{ marginBottom: 24 }}>
            <h2 style={{
              margin: '0 0 12px',
              fontSize: 'var(--aguila-fs-section, 15px)',
              fontWeight: 600,
              color: '#E6EDF3',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Docs recientes
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
            }}>
              {recent_docs.map((doc) => (
                <GlassCard key={doc.id} tier="tertiary" size="compact" href={doc.storage_url}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <FileText size={16} strokeWidth={1.8} color="rgba(192,197,206,0.7)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 'var(--aguila-fs-body, 13px)',
                        fontWeight: 600,
                        color: '#E6EDF3',
                      }}>
                        {doc.label}
                      </div>
                      {doc.sub && (
                        <div style={{
                          fontSize: 'var(--aguila-fs-meta, 11px)',
                          color: 'rgba(148,163,184,0.7)',
                          fontFamily: 'var(--font-mono)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {doc.sub}
                        </div>
                      )}
                      <div style={{
                        fontSize: 'var(--aguila-fs-meta, 11px)',
                        color: 'rgba(122,126,134,0.8)',
                        marginTop: 4,
                      }}>
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

        {/* Footer — secondary link to legacy reporting for operators */}
        {isInternal && (
          <footer style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: '1px solid rgba(192,197,206,0.08)',
            textAlign: 'center',
          }}>
            <Link
              href="/reportes/nuevo"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 'var(--aguila-fs-meta, 11px)',
                color: 'rgba(148,163,184,0.7)',
                textDecoration: 'none',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <Search size={12} strokeWidth={1.8} />
              Más reportes (operador)
            </Link>
          </footer>
        )}
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
