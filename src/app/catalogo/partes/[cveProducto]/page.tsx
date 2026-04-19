/**
 * /catalogo/partes/[cveProducto] — deep parte view.
 *
 * Server component. Fetches the full payload from
 * /api/catalogo/partes/[cveProducto] (same host — reuses the session
 * cookie so ownership check still fires). Renders the header, 4 stat
 * cards, and 4 tabs (Historia, Clasificación, Proveedores, Costos).
 *
 * If the API returns 404, redirect to /catalogo so the user doesn't
 * land on a dead page.
 */

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifySession } from '@/lib/session'
import { formatFraccion } from '@/lib/format/fraccion'
import { ParteDetailClient, type DetailPayload } from './ParteDetailClient'

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
      console.error('[parte-detail] upstream', res.status, await res.text().catch(() => ''))
      return null
    }
    const body = await res.json()
    return (body.data as DetailPayload) ?? null
  } catch (e) {
    console.error('[parte-detail] fetch threw:', e instanceof Error ? e.message : e)
    return null
  }
}

export default async function PartePage({ params }: PageProps) {
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
    // 404 or fetch failure — fall back to list with a toast-compatible query
    redirect('/catalogo?notice=parte_no_encontrada')
  }

  const role = session.role
  const formattedFraccion = data.parte.fraccion_formatted || formatFraccion(data.parte.fraccion)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px 48px' }}>
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}
      >
        <Link
          href="/catalogo"
          style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
        >
          ← Catálogo
        </Link>
        <span aria-hidden>/</span>
        <span
          style={{
            maxWidth: 420,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          {data.parte.descripcion || data.parte.cve_producto}
        </span>
      </nav>

      {/* Header */}
      <header style={{ marginBottom: 24 }}>
        <p
          className="font-mono"
          style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em' }}
        >
          {data.parte.cve_producto}
        </p>
        <h1
          style={{
            margin: '4px 0 8px',
            fontSize: 'var(--aguila-fs-title)',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'rgba(255,255,255,0.95)',
            lineHeight: 1.3,
          }}
        >
          {data.parte.descripcion || 'Sin descripción'}
        </h1>
        {data.parte.descripcion_ingles && (
          <p style={{ margin: 0, fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
            {data.parte.descripcion_ingles}
          </p>
        )}

        <div
          style={{
            marginTop: 12,
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
                background: 'rgba(234,179,8,0.12)',
                border: '1px solid rgba(234,179,8,0.32)',
                color: 'var(--portal-status-amber-fg)',
                fontSize: 13,
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
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              T-MEC
            </span>
          )}
          {data.parte.marca && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              {data.parte.marca}
            </span>
          )}
          {data.parte.pais_origen && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              · {data.parte.pais_origen}
            </span>
          )}
          {data.supertito_stats && data.supertito_stats.total > 0 && (
            <SuperTitoBadge stats={data.supertito_stats} />
          )}
        </div>
      </header>

      <ParteDetailClient data={data} role={role} formattedFraccion={formattedFraccion} />

      {/* Footer identity — shell usually renders this, detail page stays quiet here */}
    </div>
  )
}

function SuperTitoBadge({ stats }: { stats: { agreed: number; corrections: number; total: number } }) {
  const agreeRate = stats.total > 0 ? Math.round((stats.agreed / stats.total) * 100) : 0
  const title = `Revisado por Tito · ${stats.agreed} de ${stats.total} clasificaciones aprobadas · ${stats.corrections} corrección${stats.corrections === 1 ? '' : 'es'}`
  return (
    <span
      title={title}
      style={{
        marginLeft: 'auto',
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(192,197,206,0.08)',
        border: '1px solid rgba(192,197,206,0.28)',
        color: 'var(--portal-fg-1)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      Revisado por Tito · {agreeRate}%
    </span>
  )
}
