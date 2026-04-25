import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { formatPedimento } from '@/lib/format/pedimento'
import { formatFraccion } from '@/lib/format/fraccion'
import { fmtDesc } from '@/lib/format-utils'
import { isCleared, clearanceLabelES } from '@/lib/pedimentos/clearance'
import {
  linkForEntrada,
  linkForFraccion,
  linkForProducto,
  linkForProveedor,
  linkForTrafico,
} from '@/lib/links/entity-links'
import { formatDateDMY, formatNumber, formatCurrencyUSD } from '@/lib/format'
import { EmptyState } from '@/components/ui/empty-state'
import styles from './page.module.css'

/**
 * Pedimento detail — V1 audit lock-in (2026-04-25).
 *
 * Pure read-only surface. Existing data only. The single permitted query
 * exception lives at the top of the function: when params.id is purely
 * numeric, it's treated as a pedimento number (not a trafico slug) and
 * resolved → redirected. Tenant-scoped, single row.
 */
export default async function PedimentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const decoded = decodeURIComponent(rawId).trim()

  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const supabase = createServerClient()

  // Pedimento-number resolver (the explicit query exception per audit
  // plan 2026-04-25 Phase 3). Trafico slugs always contain non-digit
  // characters; a purely-numeric segment is the user pasting a pedimento
  // number from elsewhere. Resolve via tenant-scoped suffix match,
  // redirect, or 404.
  if (/^\d{6,15}$/.test(decoded)) {
    const padded = decoded.padStart(7, '0')
    let resolveQ = supabase
      .from('traficos')
      .select('trafico')
      .or(`pedimento.eq.${decoded},pedimento.ilike.%${padded}`)
      .limit(1)
    if (!isInternal) resolveQ = resolveQ.eq('company_id', session.companyId)
    const { data: hit } = await resolveQ.maybeSingle<{ trafico: string | null }>()
    if (hit?.trafico) redirect(`/pedimentos/${encodeURIComponent(hit.trafico)}`)
    notFound()
  }

  const traficoId = decoded

  const TRAFICO_COLS =
    'trafico, estatus, pedimento, fecha_llegada, fecha_cruce, fecha_pago, importe_total, regimen, company_id, patente, aduana, tipo_cambio, peso_bruto, descripcion_mercancia'

  let traficoQ = supabase.from('traficos').select(TRAFICO_COLS).eq('trafico', traficoId)
  if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)

  const traficoRes = await traficoQ.maybeSingle()
  if (traficoRes.error || !traficoRes.data) notFound()
  const ownerCompanyId = (traficoRes.data as { company_id: string | null }).company_id
  if (!ownerCompanyId) notFound()

  const facturasQ = supabase
    .from('globalpc_facturas')
    .select('folio')
    .eq('cve_trafico', traficoId)
    .eq('company_id', ownerCompanyId)
    .limit(200)

  const [facturasFoliosRes, docsRes, entradasRes] = await Promise.all([
    facturasQ,
    supabase
      .from('expediente_documentos')
      .select('id, doc_type, file_name, file_url, uploaded_at')
      .eq('pedimento_id', traficoId)
      .eq('company_id', ownerCompanyId)
      .order('uploaded_at', { ascending: false })
      .limit(200),
    supabase
      .from('entradas')
      .select('cve_entrada, fecha_llegada_mercancia, cve_proveedor, cantidad_bultos, peso_bruto')
      .eq('trafico', traficoId)
      .eq('company_id', ownerCompanyId)
      .limit(100),
  ])

  const folios = ((facturasFoliosRes.data ?? []) as Array<{ folio: number | null }>)
    .map((f) => f.folio)
    .filter((f): f is number => typeof f === 'number')

  let partidasRows: Array<{
    cve_producto: string | null
    cve_cliente: string | null
    cantidad: number | null
    precio_unitario: number | null
    peso: number | null
    pais_origen: string | null
  }> = []
  if (folios.length > 0) {
    const partidasQ = supabase
      .from('globalpc_partidas')
      .select('cve_producto, cve_cliente, cantidad, precio_unitario, peso, pais_origen')
      .in('folio', folios)
      .eq('company_id', ownerCompanyId)
      .limit(500)
    const { data } = await partidasQ
    partidasRows = (data ?? []) as typeof partidasRows
  }

  const cveSet = Array.from(new Set(partidasRows.map((p) => p.cve_producto).filter((v): v is string => Boolean(v))))
  const productosByCve = new Map<string, { descripcion: string | null; fraccion: string | null }>()
  if (cveSet.length > 0) {
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

  const status = clearanceLabelES({ estatus: trafico.estatus, fecha_cruce: trafico.fecha_cruce })
  const cleared = isCleared({ estatus: trafico.estatus, fecha_cruce: trafico.fecha_cruce })
  const pedimentoDisplay = trafico.pedimento
    ? formatPedimento(trafico.pedimento, trafico.pedimento, { dd: '26', ad: '24', pppp: trafico.patente ?? '3596' })
    : '—'
  const embarqueHref = linkForTrafico(trafico.trafico) ?? '#'

  return (
    <main className={styles.detail}>
      <Link href="/pedimentos" className={styles.crumb}>
        <ChevronLeft size={14} aria-hidden /> Pedimentos
      </Link>

      <header className={styles.header}>
        <div className={styles.eyebrow}>Pedimento</div>
        <div className={styles.titleRow}>
          <h1 className={styles.number}>{pedimentoDisplay}</h1>
          <span className={`${styles.status} ${cleared ? styles.statusCleared : styles.statusPending}`}>
            <span className={styles.statusDot} />
            {status}
          </span>
        </div>
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Embarque</span>
            <Link href={embarqueHref} className={styles.metaLink}>{trafico.trafico}</Link>
          </span>
          {trafico.regimen && (
            <span className={styles.metaItem}><span className={styles.metaLabel}>Régimen</span>{trafico.regimen}</span>
          )}
          {trafico.aduana && (
            <span className={styles.metaItem}><span className={styles.metaLabel}>Aduana</span>{trafico.aduana}</span>
          )}
          {trafico.fecha_pago && (
            <span className={styles.metaItem}><span className={styles.metaLabel}>Pago</span>{formatDateDMY(trafico.fecha_pago)}</span>
          )}
        </div>
      </header>

      <Section title="Datos del pedimento">
        <div className={styles.grid}>
          <Cell label="Régimen" value={trafico.regimen ?? '—'} />
          <Cell label="Aduana" value={trafico.aduana ?? '—'} />
          <Cell label="Patente" value={trafico.patente ?? '—'} mono />
          <Cell label="Estatus (raw)" value={trafico.estatus ?? '—'} />
          <Cell label="Fecha de llegada" value={formatDateDMY(trafico.fecha_llegada) || '—'} mono />
          <Cell label="Fecha de cruce" value={formatDateDMY(trafico.fecha_cruce) || '—'} mono />
          <Cell label="Fecha de pago" value={formatDateDMY(trafico.fecha_pago) || '—'} mono />
          <Cell label="Importe total" value={trafico.importe_total != null ? formatCurrencyUSD(trafico.importe_total) : '—'} mono align="right" />
          <Cell label="Peso bruto" value={trafico.peso_bruto != null ? `${formatNumber(trafico.peso_bruto, { decimals: 2 })} kg` : '—'} mono align="right" />
          <Cell label="Tipo de cambio (a fecha de llegada)" value={trafico.tipo_cambio != null ? `${trafico.tipo_cambio.toFixed(4)} MXN/USD` : '—'} mono align="right" />
        </div>
      </Section>

      <Section title={`Partidas (${formatNumber(partidas.length)})`}>
        {partidas.length === 0 ? (
          <EmptyState
            title="Sin partidas"
            description="No hay partidas registradas para este pedimento."
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} role="table" aria-label="Partidas del pedimento">
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
                      <td className={styles.cellMono}>
                        {productoHref && p.cve_producto ? (
                          <Link href={productoHref} className={styles.cellLink}>{p.cve_producto}</Link>
                        ) : (
                          p.cve_producto ?? '—'
                        )}
                      </td>
                      <td className={styles.cellDesc} title={p.descripcion || undefined}>
                        {p.descripcion ? fmtDesc(p.descripcion) : '—'}
                      </td>
                      <td className={styles.cellMono}>
                        {fraccionHref ? (
                          <Link href={fraccionHref} className={styles.cellLink}>{fraccionDisplay}</Link>
                        ) : (
                          fraccionDisplay
                        )}
                      </td>
                      <td className={`${styles.cellMono} ${styles.cellRight}`}>{formatNumber(p.cantidad) || '—'}</td>
                      <td className={`${styles.cellMono} ${styles.cellRight}`}>{p.peso != null ? formatNumber(p.peso, { decimals: 2 }) : '—'}</td>
                      <td className={`${styles.cellMono} ${styles.cellRight} ${styles.cellStrong}`}>{p.valor_total != null ? formatCurrencyUSD(p.valor_total) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`Expediente (${formatNumber(docs.length)} ${docs.length === 1 ? 'PDF' : 'PDFs'})`}>
        {docs.length === 0 ? (
          <EmptyState
            title="Sin documentos cargados"
            description="No hay documentos sincronizados para este pedimento."
          />
        ) : (
          <ul className={styles.docList}>
            {docs.map((d) => (
              <li key={d.id} className={styles.docRow}>
                <div className={styles.docInfo}>
                  <div className={styles.docName} title={d.file_name ?? undefined}>{d.file_name ?? 'Sin nombre'}</div>
                  <div className={styles.docMeta}>
                    {d.doc_type ?? 'Sin tipo'}
                    {d.uploaded_at ? ` · ${formatDateDMY(d.uploaded_at)}` : ''}
                  </div>
                </div>
                {d.file_url ? (
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.docAction}
                  >
                    Abrir PDF
                  </a>
                ) : (
                  <span className={`${styles.docAction} ${styles.docActionDisabled}`}>Sin URL</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {entradas.length > 0 && (
        <Section title={`Entradas vinculadas (${formatNumber(entradas.length)})`}>
          <div className={styles.tableWrap}>
            <table className={styles.table} role="table" aria-label="Entradas vinculadas">
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
                      <td className={styles.cellMono}>
                        {entradaHref ? (
                          <Link href={entradaHref} className={styles.cellLink}>{e.cve_entrada}</Link>
                        ) : (
                          e.cve_entrada
                        )}
                      </td>
                      <td className={styles.cellMono}>{formatDateDMY(e.fecha_llegada_mercancia) || '—'}</td>
                      <td className={styles.cellMono}>
                        {proveedorHref && e.cve_proveedor ? (
                          <Link href={proveedorHref} className={styles.cellMutedLink}>{e.cve_proveedor}</Link>
                        ) : (
                          e.cve_proveedor ?? '—'
                        )}
                      </td>
                      <td className={`${styles.cellMono} ${styles.cellRight}`}>{formatNumber(e.cantidad_bultos) || '—'}</td>
                      <td className={`${styles.cellMono} ${styles.cellRight}`}>{e.peso_bruto != null ? formatNumber(e.peso_bruto, { decimals: 2 }) : '—'}</td>
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
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
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
  const valueClass = [
    styles.cellValue,
    mono ? styles.cellValueMono : null,
    align === 'right' ? styles.cellValueRight : null,
  ].filter(Boolean).join(' ')
  return (
    <div className={styles.cell}>
      <div className={styles.cellLabel}>{label}</div>
      <div className={valueClass}>{value}</div>
    </div>
  )
}
