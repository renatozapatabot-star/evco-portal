import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { formatPedimento } from '@/lib/format/pedimento'
import { formatFraccion } from '@/lib/format/fraccion'
import { fmtDate, fmtUSDFull, fmtKg, fmtDesc } from '@/lib/format-utils'
import { clearanceLabel } from '@/lib/pedimentos/clearance'
import {
  linkForEntrada,
  linkForFraccion,
  linkForProducto,
  linkForProveedor,
  linkForTrafico,
} from '@/lib/links/entity-links'

/**
 * Pedimento detail — V1 Clean Visibility (2026-04-24).
 *
 * Pure read-only surface. Shows:
 *   1. Header:      pedimento number + Cleared / Not cleared + embarque cross-link
 *   2. Raw:         régimen · aduana · fecha llegada · fecha cruce · fecha pago
 *                   · valor aduana · importe total · peso bruto · tipo cambio
 *   3. Partidas:    globalpc_partidas joined by cve_trafico — cve_producto
 *                   (link) · descripción · fracción (link) · cantidad · peso · valor
 *   4. Expediente:  PDFs via expediente_documentos (pedimento_id = trafico slug)
 *                   with a download link per row
 *   5. Entradas:    related entradas for the same trafico (cross-link back)
 *
 * No timelines, no status pills beyond Cleared/Not cleared text,
 * no AI "sugerencias", no amber warnings.
 */
export default async function PedimentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const traficoId = decodeURIComponent(rawId).trim()

  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const supabase = createServerClient()

  const TRAFICO_COLS =
    'trafico, estatus, pedimento, fecha_llegada, fecha_cruce, fecha_pago, importe_total, regimen, company_id, patente, aduana, tipo_cambio, peso_bruto, descripcion_mercancia'

  let traficoQ = supabase.from('traficos').select(TRAFICO_COLS).eq('trafico', traficoId)
  if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)

  // Step A: confirm the trafico exists AND belongs to the session's tenant
  // (RLS + app-layer filter for non-internal). If the row is null, 404.
  // We DO NOT fetch dependents (expediente, entradas, partidas, facturas)
  // until ownership is confirmed — otherwise a client could probe by
  // traficoId and receive cross-tenant document URLs (IDOR).
  const traficoRes = await traficoQ.maybeSingle()
  if (traficoRes.error || !traficoRes.data) notFound()
  const ownerCompanyId = (traficoRes.data as { company_id: string | null }).company_id
  // Hard stop: a trafico with NULL company_id should never be reachable by
  // any role on the V1 client surface. Even internal roles cannot use this
  // detail page to query dependents without a tenant anchor — that path
  // would silently disable the company_id filter on the dependent queries.
  if (!ownerCompanyId) notFound()

  // Step B: dependents now anchor company_id to the verified owner of
  // the trafico, defense-in-depth even for internal roles.
  // Partidas chain (facturas → partidas → productos) joins via folio
  // not cve_trafico — partidas table has no cve_trafico column per
  // schema-contracts.ts. Unconditional company_id anchor on every leg.
  const facturasQ = supabase
    .from('globalpc_facturas')
    .select('folio')
    .eq('cve_trafico', traficoId)
    .eq('company_id', ownerCompanyId)
    .limit(200)

  const [facturasFoliosRes, docsRes, entradasRes] = await Promise.all([
    facturasQ,
    (() => {
      let q = supabase
        .from('expediente_documentos')
        .select('id, doc_type, file_name, file_url, uploaded_at')
        .eq('pedimento_id', traficoId)
        .order('uploaded_at', { ascending: false })
        .limit(200)
      q = q.eq('company_id', ownerCompanyId)
      return q
    })(),
    (() => {
      let q = supabase
        .from('entradas')
        .select('cve_entrada, fecha_llegada_mercancia, cve_proveedor, cantidad_bultos, peso_bruto')
        .eq('trafico', traficoId)
        .limit(100)
      q = q.eq('company_id', ownerCompanyId)
      return q
    })(),
  ])

  const folios = ((facturasFoliosRes.data ?? []) as Array<{ folio: number | null }>)
    .map((f) => f.folio)
    .filter((f): f is number => typeof f === 'number')

  // Step 2: get partidas for those folios.
  let partidasRows: Array<{
    cve_producto: string | null
    cve_cliente: string | null
    cantidad: number | null
    precio_unitario: number | null
    peso: number | null
    pais_origen: string | null
  }> = []
  if (folios.length > 0) {
    // Tenant filter applied UNCONDITIONALLY — even for internal roles.
    // Anchor to the verified `ownerCompanyId` from Step A so the partidas
    // chain cannot fan out across tenants when a folio collides
    // (security audit B1 / 2026-04-24 finding).
    const partidasQ = supabase
      .from('globalpc_partidas')
      .select('cve_producto, cve_cliente, cantidad, precio_unitario, peso, pais_origen')
      .in('folio', folios)
      .eq('company_id', ownerCompanyId)
      .limit(500)
    const { data } = await partidasQ
    partidasRows = (data ?? []) as typeof partidasRows
  }

  // Step 3: enrich partidas with descripcion + fraccion from globalpc_productos.
  const cveSet = Array.from(new Set(partidasRows.map((p) => p.cve_producto).filter((v): v is string => Boolean(v))))
  const productosByCve = new Map<string, { descripcion: string | null; fraccion: string | null }>()
  if (cveSet.length > 0) {
    // Same tenant-anchor rule as partidas — unconditional company_id
    // filter on `ownerCompanyId` even for internal roles. A cve_producto
    // collision across tenants would otherwise leak descripcion/fraccion
    // (security audit B1 / 2026-04-24 finding).
    const productosQ = supabase
      .from('globalpc_productos')
      .select('cve_producto, descripcion, fraccion')
      .in('cve_producto', cveSet)
      .eq('company_id', ownerCompanyId)
      .limit(1000)
    const { data: prodData } = await productosQ
    for (const p of ((prodData ?? []) as Array<{ cve_producto: string | null; descripcion: string | null; fraccion: string | null }>)) {
      if (p.cve_producto && !productosByCve.has(p.cve_producto)) {
        productosByCve.set(p.cve_producto, { descripcion: p.descripcion, fraccion: p.fraccion })
      }
    }
  }

  // (ownership already verified above; traficoRes.data is non-null here)
  const trafico = traficoRes.data as {
    trafico: string
    pedimento: string | null
    estatus: string | null
    fecha_llegada: string | null
    fecha_cruce: string | null
    fecha_pago: string | null
    importe_total: number | null
    regimen: string | null
    company_id: string | null
    patente: string | null
    aduana: string | null
    tipo_cambio: number | null
    peso_bruto: number | null
    descripcion_mercancia: string | null
  }
  // Compose partidas with the productos enrichment (descripcion + fraccion).
  const partidas = partidasRows.map((p) => {
    const prod = p.cve_producto ? productosByCve.get(p.cve_producto) : null
    const valorTotal =
      p.cantidad != null && p.precio_unitario != null
        ? p.cantidad * p.precio_unitario
        : null
    return {
      cve_producto: p.cve_producto,
      descripcion: prod?.descripcion ?? null,
      fraccion: prod?.fraccion ?? null,
      cantidad: p.cantidad,
      peso: p.peso,
      precio_unitario: p.precio_unitario,
      valor_total: valorTotal,
    }
  })
  const docs = (docsRes.data ?? []) as Array<{
    id: string
    doc_type: string | null
    file_name: string | null
    file_url: string | null
    uploaded_at: string | null
  }>
  const entradas = (entradasRes.data ?? []) as Array<{
    cve_entrada: string
    fecha_llegada_mercancia: string | null
    cve_proveedor: string | null
    cantidad_bultos: number | null
    peso_bruto: number | null
  }>

  const status = clearanceLabel({ estatus: trafico.estatus, fecha_cruce: trafico.fecha_cruce })
  const pedimentoDisplay = trafico.pedimento
    ? formatPedimento(trafico.pedimento, trafico.pedimento, { dd: '26', ad: '24', pppp: trafico.patente ?? '3596' })
    : '—'
  const embarqueHref = linkForTrafico(trafico.trafico) ?? '#'

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 48px', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 'var(--aguila-fs-label)', letterSpacing: 'var(--aguila-ls-label)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
          Pedimento
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>
            {pedimentoDisplay}
          </h1>
          <span style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--text-secondary)' }}>{status}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)' }}>
          Embarque{' '}
          <Link href={embarqueHref} style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-silver-bright, #E8EAED)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
            {trafico.trafico}
          </Link>
        </div>
      </header>

      {/* Raw data */}
      <Section title="Datos del pedimento">
        <DataGrid>
          <Cell label="Régimen" value={trafico.regimen ?? '—'} />
          <Cell label="Aduana" value={trafico.aduana ?? '—'} />
          <Cell label="Patente" value={trafico.patente ?? '—'} mono />
          <Cell label="Estatus (raw)" value={trafico.estatus ?? '—'} />
          <Cell label="Fecha de llegada" value={trafico.fecha_llegada ? fmtDate(trafico.fecha_llegada) : '—'} mono />
          <Cell label="Fecha de cruce" value={trafico.fecha_cruce ? fmtDate(trafico.fecha_cruce) : '—'} mono />
          <Cell label="Fecha de pago" value={trafico.fecha_pago ? fmtDate(trafico.fecha_pago) : '—'} mono />
          <Cell label="Importe total" value={trafico.importe_total != null ? fmtUSDFull(trafico.importe_total) : '—'} mono align="right" />
          <Cell label="Peso bruto" value={trafico.peso_bruto != null ? `${fmtKg(trafico.peso_bruto)} kg` : '—'} mono align="right" />
          <Cell label="Tipo de cambio (a fecha de llegada)" value={trafico.tipo_cambio != null ? `${trafico.tipo_cambio.toFixed(4)} MXN/USD` : '—'} mono align="right" />
        </DataGrid>
      </Section>

      {/* Partidas */}
      <Section title={`Partidas (${partidas.length})`}>
        {partidas.length === 0 ? (
          <Empty message="Sin partidas registradas para este pedimento." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="aguila-table" role="table" aria-label="Partidas del pedimento" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Producto</th>
                  <th>Descripción</th>
                  <th style={{ width: 120 }}>Fracción</th>
                  <th style={{ width: 90, textAlign: 'right' }}>Cantidad</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Peso (kg)</th>
                  <th style={{ width: 150, textAlign: 'right' }} title="Valor de factura comercial — el valor en aduana oficial puede diferir">Valor factura</th>
                </tr>
              </thead>
              <tbody>
                {partidas.map((p, i) => {
                  const fraccionHref = linkForFraccion(p.fraccion)
                  const productoHref = linkForProducto(p.cve_producto)
                  const fraccionDisplay = formatFraccion(p.fraccion) ?? '—'
                  return (
                    <tr key={`${p.cve_producto ?? 'sin'}-${i}`}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-body)' }}>
                        {productoHref && p.cve_producto ? (
                          <Link href={productoHref} style={{ color: 'var(--accent-silver-bright, #E8EAED)', textDecoration: 'none' }}>
                            {p.cve_producto}
                          </Link>
                        ) : (
                          p.cve_producto ?? '—'
                        )}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.descripcion ? fmtDesc(p.descripcion) : '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-body)' }}>
                        {fraccionHref ? (
                          <Link href={fraccionHref} style={{ color: 'var(--accent-silver-bright, #E8EAED)', textDecoration: 'none' }}>
                            {fraccionDisplay}
                          </Link>
                        ) : (
                          fraccionDisplay
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {p.cantidad != null ? p.cantidad.toLocaleString('es-MX') : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {p.peso != null ? fmtKg(p.peso) : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600 }}>
                        {p.valor_total != null ? fmtUSDFull(p.valor_total) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Expediente PDFs */}
      <Section title={`Expediente (${docs.length} ${docs.length === 1 ? 'PDF' : 'PDFs'})`}>
        {docs.length === 0 ? (
          <Empty message="Sin documentos cargados para este pedimento." />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map((d) => (
              <li key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '12px 14px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, minHeight: 60,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.file_name ?? 'Sin nombre'}
                  </div>
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', marginTop: 2 }}>
                    {d.doc_type ?? 'Sin tipo'}
                    {d.uploaded_at ? ` · ${fmtDate(d.uploaded_at)}` : ''}
                  </div>
                </div>
                {d.file_url ? (
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 'var(--aguila-fs-body)',
                      padding: '8px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      textDecoration: 'none',
                    }}
                  >
                    Abrir PDF
                  </a>
                ) : (
                  <span style={{
                    fontSize: 'var(--aguila-fs-meta)',
                    color: 'var(--text-muted)',
                  }}>
                    Sin URL
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Related entradas */}
      {entradas.length > 0 && (
        <Section title={`Entradas vinculadas (${entradas.length})`}>
          <div style={{ overflowX: 'auto' }}>
            <table className="aguila-table" role="table" aria-label="Entradas vinculadas" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Entrada</th>
                  <th style={{ width: 120 }}>Fecha</th>
                  <th style={{ width: 140 }}>Proveedor</th>
                  <th style={{ width: 90, textAlign: 'right' }}>Bultos</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Peso (kg)</th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((e) => {
                  const entradaHref = linkForEntrada(e.cve_entrada)
                  const proveedorHref = linkForProveedor(e.cve_proveedor)
                  return (
                    <tr key={e.cve_entrada}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-body)' }}>
                        {entradaHref ? (
                          <Link href={entradaHref} style={{ color: 'var(--accent-silver-bright, #E8EAED)', textDecoration: 'none' }}>
                            {e.cve_entrada}
                          </Link>
                        ) : (
                          e.cve_entrada
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {e.fecha_llegada_mercancia ? fmtDate(e.fecha_llegada_mercancia) : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-body)' }}>
                        {proveedorHref && e.cve_proveedor ? (
                          <Link href={proveedorHref} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                            {e.cve_proveedor}
                          </Link>
                        ) : (
                          e.cve_proveedor ?? '—'
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {e.cantidad_bultos ?? '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {e.peso_bruto != null ? fmtKg(e.peso_bruto) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </main>
  )
}

/* ─── Local presentational primitives ─────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{
        fontSize: 'var(--aguila-fs-section)', fontWeight: 600,
        letterSpacing: 'var(--aguila-ls-label)', textTransform: 'uppercase',
        color: 'var(--text-secondary)', marginBottom: 12,
      }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function DataGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 12,
    }}>
      {children}
    </div>
  )
}

function Cell({
  label,
  value,
  mono,
  align,
}: {
  label: string
  value: string
  mono?: boolean
  align?: 'left' | 'right'
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 14px',
      minHeight: 60,
    }}>
      <div style={{
        fontSize: 'var(--aguila-fs-label)',
        letterSpacing: 'var(--aguila-ls-label)',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontSize: 'var(--aguila-fs-body)',
        fontWeight: 500,
        textAlign: align ?? 'left',
      }}>
        {value}
      </div>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div style={{
      padding: '24px 16px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      color: 'var(--text-muted)',
      fontSize: 'var(--aguila-fs-body)',
      textAlign: 'center',
    }}>
      {message}
    </div>
  )
}
