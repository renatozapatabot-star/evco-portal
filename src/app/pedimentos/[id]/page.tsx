import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { formatPedimento } from '@/lib/format/pedimento'
import { formatFraccion } from '@/lib/format/fraccion'
import { fmtUSDFull, fmtKg, fmtDesc } from '@/lib/format-utils'
import { clearanceLabel, isCleared } from '@/lib/pedimentos/clearance'
import {
  linkForEntrada,
  linkForFraccion,
  linkForProducto,
  linkForProveedor,
  linkForTrafico,
} from '@/lib/links/entity-links'

/** DD/MM/YYYY — shipper-friendly, locale-agnostic. */
function fmtDateDMY(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = iso.split('T')[0]
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

/** Integer with es-MX thousand separators. */
function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  return Math.trunc(Number(n)).toLocaleString('es-MX')
}

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
  const cleared = isCleared({ estatus: trafico.estatus, fecha_cruce: trafico.fecha_cruce })
  const pedimentoDisplay = trafico.pedimento
    ? formatPedimento(trafico.pedimento, trafico.pedimento, { dd: '26', ad: '24', pppp: trafico.patente ?? '3596' })
    : '—'
  const embarqueHref = linkForTrafico(trafico.trafico) ?? '#'

  return (
    <main className="ped-detail">
      {/* Header — compact card style: eyebrow, number, status pill, meta row */}
      <header className="ped-header">
        <div className="ped-eyebrow">Pedimento</div>
        <div className="ped-title-row">
          <h1 className="ped-number">{pedimentoDisplay}</h1>
          <span className={`ped-status ${cleared ? 'ped-status--cleared' : 'ped-status--pending'}`}>
            <span className="ped-status-dot" />
            {status}
          </span>
        </div>
        <div className="ped-meta">
          <span className="ped-meta-item">
            <span className="ped-meta-label">Embarque</span>
            <Link href={embarqueHref} className="ped-meta-link">{trafico.trafico}</Link>
          </span>
          {trafico.regimen && (
            <span className="ped-meta-item"><span className="ped-meta-label">Régimen</span>{trafico.regimen}</span>
          )}
          {trafico.aduana && (
            <span className="ped-meta-item"><span className="ped-meta-label">Aduana</span>{trafico.aduana}</span>
          )}
          {trafico.fecha_pago && (
            <span className="ped-meta-item"><span className="ped-meta-label">Pago</span>{fmtDateDMY(trafico.fecha_pago)}</span>
          )}
        </div>
      </header>

      {/* Datos del pedimento */}
      <Section title="Datos del pedimento">
        <div className="ped-grid">
          <Cell label="Régimen" value={trafico.regimen ?? '—'} />
          <Cell label="Aduana" value={trafico.aduana ?? '—'} />
          <Cell label="Patente" value={trafico.patente ?? '—'} mono />
          <Cell label="Estatus (raw)" value={trafico.estatus ?? '—'} />
          <Cell label="Fecha de llegada" value={fmtDateDMY(trafico.fecha_llegada) || '—'} mono />
          <Cell label="Fecha de cruce" value={fmtDateDMY(trafico.fecha_cruce) || '—'} mono />
          <Cell label="Fecha de pago" value={fmtDateDMY(trafico.fecha_pago) || '—'} mono />
          <Cell label="Importe total" value={trafico.importe_total != null ? fmtUSDFull(trafico.importe_total) : '—'} mono align="right" />
          <Cell label="Peso bruto" value={trafico.peso_bruto != null ? `${fmtKg(trafico.peso_bruto)} kg` : '—'} mono align="right" />
          <Cell label="Tipo de cambio (a fecha de llegada)" value={trafico.tipo_cambio != null ? `${trafico.tipo_cambio.toFixed(4)} MXN/USD` : '—'} mono align="right" />
        </div>
      </Section>

      {/* Partidas */}
      <Section title={`Partidas (${partidas.length})`}>
        {partidas.length === 0 ? (
          <Empty message="Sin partidas registradas para este pedimento." />
        ) : (
          <div className="ped-table-wrap">
            <table className="ped-table" role="table" aria-label="Partidas del pedimento">
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
                      <td className="cell-mono">
                        {productoHref && p.cve_producto ? (
                          <Link href={productoHref} className="cell-link">{p.cve_producto}</Link>
                        ) : (
                          p.cve_producto ?? '—'
                        )}
                      </td>
                      <td className="cell-desc" title={p.descripcion || undefined}>
                        {p.descripcion ? fmtDesc(p.descripcion) : '—'}
                      </td>
                      <td className="cell-mono">
                        {fraccionHref ? (
                          <Link href={fraccionHref} className="cell-link">{fraccionDisplay}</Link>
                        ) : (
                          fraccionDisplay
                        )}
                      </td>
                      <td className="cell-mono cell-right">{fmtInt(p.cantidad) || '—'}</td>
                      <td className="cell-mono cell-right">{p.peso != null ? fmtKg(p.peso) : '—'}</td>
                      <td className="cell-mono cell-right cell-strong">{p.valor_total != null ? fmtUSDFull(p.valor_total) : '—'}</td>
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
          <ul className="ped-doc-list">
            {docs.map((d) => (
              <li key={d.id} className="ped-doc-row">
                <div className="ped-doc-info">
                  <div className="ped-doc-name" title={d.file_name ?? undefined}>{d.file_name ?? 'Sin nombre'}</div>
                  <div className="ped-doc-meta">
                    {d.doc_type ?? 'Sin tipo'}
                    {d.uploaded_at ? ` · ${fmtDateDMY(d.uploaded_at)}` : ''}
                  </div>
                </div>
                {d.file_url ? (
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ped-doc-action"
                  >
                    Abrir PDF
                  </a>
                ) : (
                  <span className="ped-doc-action ped-doc-action--disabled">Sin URL</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Related entradas */}
      {entradas.length > 0 && (
        <Section title={`Entradas vinculadas (${entradas.length})`}>
          <div className="ped-table-wrap">
            <table className="ped-table" role="table" aria-label="Entradas vinculadas">
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
                      <td className="cell-mono">
                        {entradaHref ? (
                          <Link href={entradaHref} className="cell-link">{e.cve_entrada}</Link>
                        ) : (
                          e.cve_entrada
                        )}
                      </td>
                      <td className="cell-mono">{fmtDateDMY(e.fecha_llegada_mercancia) || '—'}</td>
                      <td className="cell-mono">
                        {proveedorHref && e.cve_proveedor ? (
                          <Link href={proveedorHref} className="cell-muted-link">{e.cve_proveedor}</Link>
                        ) : (
                          e.cve_proveedor ?? '—'
                        )}
                      </td>
                      <td className="cell-mono cell-right">{fmtInt(e.cantidad_bultos) || '—'}</td>
                      <td className="cell-mono cell-right">{e.peso_bruto != null ? fmtKg(e.peso_bruto) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Page-scoped polish — shadcn-feel chrome on this surface only. */}
      <style>{`
        .ped-detail {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 20px 64px;
          color: var(--text-primary);
        }
        @media (max-width: 600px) {
          .ped-detail { padding: 16px 14px 48px; }
        }

        /* Header */
        .ped-header { margin-bottom: 28px; }
        .ped-eyebrow {
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 8px;
        }
        .ped-title-row {
          display: flex; align-items: center; gap: 14px;
          flex-wrap: wrap;
        }
        .ped-number {
          font-family: var(--font-mono);
          font-size: 28px; font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--text-primary);
          margin: 0;
          font-variant-numeric: tabular-nums;
        }
        @media (max-width: 600px) {
          .ped-number { font-size: 22px; }
        }
        .ped-status {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 9999px;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }
        .ped-status-dot {
          width: 6px; height: 6px; border-radius: 50%;
          flex-shrink: 0;
        }
        .ped-status--cleared {
          background: rgba(34,197,94,0.10);
          color: #4ade80;
        }
        .ped-status--cleared .ped-status-dot { background: #22c55e; }
        .ped-status--pending {
          background: rgba(192,197,206,0.10);
          color: var(--accent-silver, #C0C5CE);
        }
        .ped-status--pending .ped-status-dot { background: var(--accent-silver-dim, #7A7E86); }

        .ped-meta {
          display: flex; flex-wrap: wrap; gap: 8px 18px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--border);
          font-size: 13px;
          color: var(--text-secondary);
        }
        .ped-meta-item {
          display: inline-flex; align-items: baseline; gap: 6px;
        }
        .ped-meta-label {
          font-size: 10px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-muted);
        }
        .ped-meta-link {
          font-family: var(--font-mono);
          color: var(--accent-silver-bright, #E8EAED);
          text-decoration: none;
          border-bottom: 1px dashed rgba(192,197,206,0.3);
        }
        .ped-meta-link:hover { border-bottom-color: var(--accent-silver-bright, #E8EAED); }

        /* Sections */
        .ped-section { margin-bottom: 28px; }
        .ped-section + .ped-section {
          padding-top: 28px;
          border-top: 1px solid rgba(255,255,255,0.04);
        }
        .ped-section-title {
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-muted);
          margin: 0 0 14px;
        }

        /* Data grid (Datos del pedimento) */
        .ped-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
        }
        .ped-cell {
          background: var(--bg-card);
          padding: 12px 14px;
          min-height: 60px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .ped-cell-label {
          font-size: 10px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-muted);
        }
        .ped-cell-value {
          font-size: 13px; font-weight: 500;
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }
        .ped-cell-value--mono { font-family: var(--font-mono); }
        .ped-cell-value--right { text-align: right; }

        /* Tables — shadcn parity */
        .ped-table-wrap {
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow-x: auto;
        }
        .ped-table {
          width: 100%;
          border-collapse: collapse;
          font-variant-numeric: tabular-nums;
          min-width: 720px;
        }
        .ped-table th {
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.04em; text-transform: uppercase;
          color: var(--text-muted);
          padding: 10px 12px;
          text-align: left;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 1;
        }
        .ped-table td {
          padding: 10px 12px;
          font-size: 13px;
          color: var(--text-secondary);
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .ped-table tbody tr { transition: background 120ms ease; }
        .ped-table tbody tr:nth-child(odd) { background: rgba(255,255,255,0.015); }
        .ped-table tbody tr:hover { background: rgba(192,197,206,0.06); }
        .ped-table tbody tr:last-child td { border-bottom: 0; }

        .cell-mono { font-family: var(--font-mono); font-size: 13px; color: var(--text-secondary); }
        .cell-right { text-align: right; }
        .cell-strong { color: var(--text-primary); font-weight: 600; }
        .cell-desc { color: var(--text-secondary); max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cell-link { color: var(--accent-silver-bright, #E8EAED); text-decoration: none; }
        .cell-link:hover { text-decoration: underline; text-underline-offset: 2px; }
        .cell-muted-link { color: var(--text-secondary); text-decoration: none; }
        .cell-muted-link:hover { color: var(--text-primary); }

        /* Expediente list */
        .ped-doc-list {
          list-style: none; padding: 0; margin: 0;
          display: flex; flex-direction: column;
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
        }
        .ped-doc-row {
          display: flex; align-items: center; gap: 16px;
          padding: 12px 14px;
          background: var(--bg-card);
          border-bottom: 1px solid rgba(255,255,255,0.04);
          min-height: 60px;
        }
        .ped-doc-row:last-child { border-bottom: 0; }
        .ped-doc-info { flex: 1; min-width: 0; }
        .ped-doc-name {
          font-size: 13px; font-weight: 600;
          color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ped-doc-meta {
          font-size: 11px; color: var(--text-muted);
          margin-top: 2px;
          font-variant-numeric: tabular-nums;
        }
        .ped-doc-action {
          font-size: 12px; font-weight: 600;
          padding: 8px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          text-decoration: none;
          white-space: nowrap;
          transition: background 120ms ease, border-color 120ms ease;
        }
        .ped-doc-action:hover {
          background: rgba(192,197,206,0.10);
          border-color: rgba(192,197,206,0.3);
        }
        .ped-doc-action--disabled {
          color: var(--text-muted);
          background: transparent;
          cursor: default;
        }
        .ped-doc-action--disabled:hover {
          background: transparent;
          border-color: var(--border);
        }

        /* Empty card */
        .ped-empty {
          padding: 28px 16px;
          background: var(--bg-card);
          border: 1px dashed var(--border);
          border-radius: 10px;
          color: var(--text-muted);
          font-size: 13px;
          text-align: center;
        }
      `}</style>
    </main>
  )
}

/* ─── Local presentational primitives ─────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ped-section">
      <h2 className="ped-section-title">{title}</h2>
      {children}
    </section>
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
  const valueClass = ['ped-cell-value', mono ? 'ped-cell-value--mono' : null, align === 'right' ? 'ped-cell-value--right' : null]
    .filter(Boolean).join(' ')
  return (
    <div className="ped-cell">
      <div className="ped-cell-label">{label}</div>
      <div className={valueClass}>{value}</div>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return <div className="ped-empty">{message}</div>
}
