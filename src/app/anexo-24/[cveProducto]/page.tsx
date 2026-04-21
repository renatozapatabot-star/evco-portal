/**
 * /anexo-24/[cveProducto] — SKU detail page, Anexo 24 framed.
 *
 * Reuses the Sunday-shipped /catalogo/partes/[cveProducto] detail
 * machinery (ParteDetailClient with Historia/Clasificación/
 * Proveedores/Costos tabs) but wraps it in Anexo-24-specific chrome:
 *   - Breadcrumb returns to /anexo-24 (not /catalogo)
 *   - Header frames the SKU as "Parte del Anexo 24"
 *   - New "Documentos vinculados" section lists every doc CRUZ knows
 *     about this SKU — pedimentos, entradas, OCA opinions, Anexo 24
 *     exports, classifications. Reverse-index: given the part, what
 *     paperwork exists? That's the "most important doc" promise.
 *   - Footer links back to the Anexo 24 surface.
 *
 * Phase 2 of the Anexo 24 plan. Data fetching reuses the existing
 * /api/catalogo/partes/[cveProducto] endpoint so there's no data-layer
 * divergence — one source of truth per SKU.
 */

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ClipboardList, FileText, ExternalLink, Package } from 'lucide-react'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { formatFraccion } from '@/lib/format/fraccion'
import { ParteDetailClient, type DetailPayload } from '@/app/catalogo/partes/[cveProducto]/ParteDetailClient'
import { GlassCard, DetailPageShell } from '@/components/aguila'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ cveProducto: string }>
}

async function fetchDetail(cveProducto: string, cookieHeader: string, host: string): Promise<DetailPayload | null> {
  const proto = host.includes('localhost') ? 'http' : 'https'
  const url = `${proto}://${host}/api/catalogo/partes/${encodeURIComponent(cveProducto)}`
  try {
    const res = await fetch(url, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })
    if (res.status === 404) return null
    if (!res.ok) {
      console.error('[anexo-24/detail] upstream', res.status, await res.text().catch(() => ''))
      return null
    }
    const body = await res.json()
    return (body.data as DetailPayload) ?? null
  } catch (e) {
    console.error('[anexo-24/detail] fetch threw:', e instanceof Error ? e.message : e)
    return null
  }
}

interface LinkedDoc {
  id: string
  kind: 'pedimento' | 'entrada' | 'oca' | 'anexo24_export' | 'clasificacion'
  label: string
  sub?: string
  href?: string
  timestamp_iso?: string | null
}

async function fetchLinkedDocs(cveProducto: string, companyId: string): Promise<LinkedDoc[]> {
  const supabase = createServerClient()
  const docs: LinkedDoc[] = []

  // Recent pedimentos that carry a line item for this part (joined via
  // globalpc_partidas.cve_producto → cve_trafico → traficos.pedimento).
  try {
    const { data: partidaRows } = await supabase
      .from('globalpc_partidas')
      .select('cve_trafico, created_at, cantidad, precio_unitario')
      .eq('cve_producto', cveProducto)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(8)
    const traficos = Array.from(new Set((partidaRows ?? []).map((r) => r.cve_trafico).filter(Boolean)))
    if (traficos.length > 0) {
      const { data: traficoRows } = await supabase
        .from('traficos')
        .select('trafico, pedimento, fecha_pago, fecha_cruce')
        .in('trafico', traficos as string[])
        .eq('company_id', companyId)
      for (const t of (traficoRows ?? [])) {
        docs.push({
          id: `pedimento-${t.trafico}`,
          kind: 'pedimento',
          label: t.pedimento ? `Pedimento ${t.pedimento}` : `Embarque ${t.trafico}`,
          sub: t.fecha_cruce ? `Cruzado ${formatDate(t.fecha_cruce)}` : 'En proceso',
          href: `/api/pedimento-pdf?trafico=${encodeURIComponent(t.trafico as string)}`,
          timestamp_iso: t.fecha_cruce ?? t.fecha_pago,
        })
      }
    }
  } catch (err) {
    console.error('[anexo-24/detail] linked pedimentos failed:', err instanceof Error ? err.message : err)
  }

  // OCA opinions for this cve_producto (if the oca_opinions table exists
  // for this tenant — graceful on absence).
  try {
    const { data: ocaRows } = await supabase
      .from('oca_opinions')
      .select('id, folio, fraccion, created_at, pdf_url')
      .eq('cve_producto', cveProducto)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5)
    for (const o of (ocaRows ?? [])) {
      docs.push({
        id: `oca-${o.id ?? o.folio}`,
        kind: 'oca',
        label: o.folio ? `Opinión OCA ${o.folio}` : 'Opinión de clasificación',
        sub: o.fraccion ? `Fracción ${formatFraccion(o.fraccion) ?? o.fraccion}` : undefined,
        href: typeof o.pdf_url === 'string' ? o.pdf_url : undefined,
        timestamp_iso: o.created_at,
      })
    }
  } catch {
    // oca_opinions may not exist for this tenant — non-fatal.
  }

  // Recent Anexo 24 exports for the company — same source the main
  // /anexo-24 surface uses. Included here because any Anexo 24 export
  // authoritatively contains every SKU; SAT calling about this part
  // can be defended by whichever export is most recent.
  try {
    const { data: exports } = await supabase
      .storage
      .from('anexo-24-exports')
      .list(companyId, { limit: 3, sortBy: { column: 'created_at', order: 'desc' } })
    for (const file of (exports ?? [])) {
      if (!file.name) continue
      const label = file.name.endsWith('.pdf') ? 'Anexo 24 PDF' : 'Anexo 24 Excel'
      const { data: pub } = supabase.storage.from('anexo-24-exports').getPublicUrl(`${companyId}/${file.name}`)
      docs.push({
        id: `anexo-${file.name}`,
        kind: 'anexo24_export',
        label,
        sub: file.name,
        href: pub.publicUrl,
        timestamp_iso: file.created_at,
      })
    }
  } catch {
    // Bucket may not exist.
  }

  docs.sort((a, b) => (b.timestamp_iso ?? '').localeCompare(a.timestamp_iso ?? ''))
  return docs
}

function formatDate(iso: string): string {
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

export default async function Anexo24DetailPage({ params }: PageProps) {
  const { cveProducto } = await params
  const decoded = decodeURIComponent(cveProducto)

  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'portal.renatozapata.com'
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ')

  const data = await fetchDetail(decoded, cookieHeader, host)
  if (!data) {
    redirect('/anexo-24?notice=parte_no_encontrada')
  }

  const linkedDocs = await fetchLinkedDocs(decoded, session.companyId)
  const role = session.role
  const formattedFraccion = data.parte.fraccion_formatted || formatFraccion(data.parte.fraccion)
  const clientName = decodeURIComponent(cookieStore.get('company_name')?.value ?? 'Cliente')

  return (
    <DetailPageShell
      breadcrumb={[
        { label: 'Anexo 24', href: '/anexo-24' },
        { label: data.parte.cve_producto || 'SKU' },
      ]}
      title={data.parte.descripcion || data.parte.cve_producto || 'SKU'}
      subtitle={`Anexo 24 · ${clientName} · Patente 3596`}
      maxWidth={1100}
    >
      {/* Context strip — reframes the SKU as "part of the official Anexo 24" */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(201,167,74,0.06)',
          border: '1px solid rgba(201,167,74,0.18)',
          fontSize: 'var(--aguila-fs-body, 13px)',
          color: 'rgba(230,237,243,0.85)',
        }}
      >
        <ClipboardList size={16} color="rgba(201,167,74,0.9)" strokeWidth={1.8} aria-hidden />
        <span>
          <strong style={{ color: 'var(--portal-fg-1)' }}>Parte del Anexo 24</strong> —
          tu Formato 53 de GlobalPC.net lista este SKU con estos mismos datos.
          {linkedDocs.length > 0 && (
            <span style={{ color: 'rgba(148,163,184,0.9)' }}>
              {' '}{linkedDocs.length} documento{linkedDocs.length === 1 ? '' : 's'} vinculado{linkedDocs.length === 1 ? '' : 's'}.
            </span>
          )}
        </span>
      </div>

      {/* Header — part number + description + fraction + tags */}
      <header style={{ marginBottom: 24 }}>
        <p
          className="font-mono"
          style={{
            margin: 0,
            fontSize: 'var(--aguila-fs-meta, 11px)',
            color: 'rgba(148,163,184,0.75)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Número de parte · {data.parte.cve_producto}
        </p>
        {data.parte.descripcion_ingles && (
          <p
            style={{
              margin: '8px 0 0',
              fontStyle: 'italic',
              color: 'rgba(148,163,184,0.85)',
              fontSize: 'var(--aguila-fs-body, 13px)',
            }}
          >
            {data.parte.descripcion_ingles}
          </p>
        )}

        <div
          style={{
            marginTop: 14,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {formattedFraccion && (
            <span
              className="font-mono"
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(201,167,74,0.12)',
                border: '1px solid rgba(201,167,74,0.32)',
                color: 'var(--portal-gold-400)',
                fontSize: 'var(--aguila-fs-body, 13px)',
                fontWeight: 700,
                letterSpacing: '0.02em',
              }}
            >
              {formattedFraccion}
            </span>
          )}
          {data.parte.tmec_eligible && (
            <span
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: 'var(--portal-status-green-bg)',
                border: '1px solid var(--portal-status-green-ring)',
                color: 'var(--portal-status-green-fg)',
                fontSize: 'var(--aguila-fs-meta, 11px)',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              T-MEC
            </span>
          )}
          {data.parte.marca && (
            <span style={{ fontSize: 'var(--aguila-fs-body, 13px)', color: 'rgba(148,163,184,0.85)' }}>
              {data.parte.marca}
            </span>
          )}
          {data.parte.pais_origen && (
            <span style={{ fontSize: 'var(--aguila-fs-body, 13px)', color: 'rgba(148,163,184,0.85)' }}>
              · {data.parte.pais_origen}
            </span>
          )}
        </div>
      </header>

      {/* Linked docs — the "this is the most important doc" moment.
          Rendered above the 4-tab detail so Ursula sees documents first. */}
      {linkedDocs.length > 0 && (
        <section className="aguila-reveal aguila-reveal-delay-1" style={{ marginBottom: 28 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 'var(--aguila-fs-section, 15px)',
              fontWeight: 600,
              color: 'var(--portal-fg-1)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Documentos vinculados
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {linkedDocs.slice(0, 9).map((doc) => (
              <GlassCard key={doc.id} tier="tertiary" size="compact" href={doc.href}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <DocIcon kind={doc.kind} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 'var(--aguila-fs-body, 13px)',
                        fontWeight: 600,
                        color: 'var(--portal-fg-1)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {doc.label}
                    </div>
                    {doc.sub && (
                      <div
                        style={{
                          fontSize: 'var(--aguila-fs-meta, 11px)',
                          color: 'rgba(148,163,184,0.75)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {doc.sub}
                      </div>
                    )}
                    {doc.timestamp_iso && (
                      <div
                        style={{
                          fontSize: 'var(--aguila-fs-meta, 11px)',
                          color: 'rgba(122,126,134,0.85)',
                          marginTop: 4,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {formatDate(doc.timestamp_iso)}
                      </div>
                    )}
                  </div>
                  {doc.href && (
                    <ExternalLink size={12} strokeWidth={1.8} color="rgba(192,197,206,0.5)" style={{ flexShrink: 0 }} />
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {/* 4-tab detail — reuses the Sunday-build client component */}
      <ParteDetailClient data={data} role={role} formattedFraccion={formattedFraccion} />
    </DetailPageShell>
  )
}

function DocIcon({ kind }: { kind: LinkedDoc['kind'] }) {
  const common = { size: 16, strokeWidth: 1.8, color: 'rgba(192,197,206,0.78)' } as const
  switch (kind) {
    case 'pedimento':
      return <FileText {...common} style={{ marginTop: 2, flexShrink: 0 }} />
    case 'entrada':
      return <Package {...common} style={{ marginTop: 2, flexShrink: 0 }} />
    case 'anexo24_export':
      return <ClipboardList {...common} style={{ marginTop: 2, flexShrink: 0, color: 'rgba(201,167,74,0.9)' }} />
    default:
      return <FileText {...common} style={{ marginTop: 2, flexShrink: 0 }} />
  }
}
