// CRUZ · /anexo-24 — Formato 53 report surface (V1 polish, 2026-04-24).
//
// Single-purpose screen. Header + download CTA + 12-column partidas table.
// No KPIs, no recent-downloads section, no audit chips. The 12 columns
// match the official Formato 53 PDF layout (the 41-column XLSX export is
// preserved via the existing Anexo24DownloadCta button).

import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { cleanCompanyDisplayName } from '@/lib/format/company-name'
import { CockpitSkeleton, CockpitErrorCard } from '@/components/aguila'
import { Anexo24DownloadCta } from './Anexo24DownloadCta'

export const dynamic = 'force-dynamic'
export const revalidate = 60

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

/** USD with $ + thousand separators + 2 decimals. */
function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface Anexo24Row {
  aduana: string
  clave: string
  fechaPago: string | null
  proveedor: string
  factura: string
  fraccion: string
  cveProducto: string
  cantidad: number | null
  umt: string
  pedimento: string
  valorUSD: number | null
  paisOrigen: string
}

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>
}

type SessionLike = { companyId: string; role: string; name?: string }

export default async function Anexo24Page({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const sp = await searchParams
  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <Anexo24Content session={session} from={sp.from} to={sp.to} />
    </Suspense>
  )
}

async function Anexo24Content({
  session,
  from,
  to,
}: {
  session: SessionLike
  from?: string
  to?: string
}) {
  try {
    const supabase = createServerClient()
    const cookieStore = await cookies()
    const rawClientName = decodeURIComponent(cookieStore.get('company_name')?.value ?? '')
    const clientName = cleanCompanyDisplayName(rawClientName) || 'Cliente'
    const isInternal = session.role === 'broker' || session.role === 'admin'
    const ownerCompanyId = session.companyId
    if (!ownerCompanyId) notFound()

    const today = new Date().toISOString().slice(0, 10)
    const yearStart = `${new Date().getUTCFullYear()}-01-01`
    const dateFrom = from ?? yearStart
    const dateTo = to ?? today

    const rows = await fetchAnexo24Rows(supabase, ownerCompanyId, dateFrom, dateTo)

    const meta: Array<[string, string]> = [
      ['Cliente', clientName],
      ['Patente', '3596'],
      ['Aduana', '240'],
      ['Periodo', `${fmtDateDMY(dateFrom)} a ${fmtDateDMY(dateTo)}`],
      ['Partidas', rows.length.toLocaleString('es-MX')],
    ]

    return (
      <main className="anx-page">
        {/* Header */}
        <header className="anx-header">
          <div className="anx-eyebrow">Inteligencia aduanal · Patente 3596</div>
          <h1 className="anx-title">ANEXO 24 · FORMATO 53</h1>
          <div className="anx-meta">
            {meta.map(([label, value]) => (
              <span key={label} className="anx-meta-item">
                <span className="anx-meta-label">{label}</span>
                <span className="anx-meta-value">{value}</span>
              </span>
            ))}
          </div>
        </header>

        {/* Download CTA — full 41-column XLSX export */}
        <section className="anx-cta">
          <Anexo24DownloadCta companyId={ownerCompanyId} isInternal={isInternal} />
        </section>

        {/* Partidas table — 12 columns, exactly */}
        {rows.length === 0 ? (
          <div className="anx-empty">
            No hay partidas registradas en este periodo. Sube el Formato 53 más reciente o ajusta el rango.
          </div>
        ) : (
          <div className="anx-table-wrap">
            <table className="anx-table" role="table" aria-label="Partidas Formato 53">
              <thead>
                <tr>
                  <th>Aduana</th>
                  <th>Clave</th>
                  <th>Fecha de pago</th>
                  <th>Proveedor</th>
                  <th>Factura</th>
                  <th>Fracción</th>
                  <th>Número de parte</th>
                  <th style={{ textAlign: 'right' }}>Cantidad UM-Comercial</th>
                  <th>UM Comercial</th>
                  <th>Número de pedimento</th>
                  <th style={{ textAlign: 'right' }}>Valor dólar</th>
                  <th>País de origen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.cveProducto}-${r.factura}-${i}`}>
                    <td className="cell-mono">{r.aduana || '—'}</td>
                    <td className="cell-mono">{r.clave || '—'}</td>
                    <td className="cell-mono">{fmtDateDMY(r.fechaPago) || '—'}</td>
                    <td className="cell-soft" title={r.proveedor || undefined}>{r.proveedor || '—'}</td>
                    <td className="cell-mono">{r.factura || '—'}</td>
                    <td className="cell-mono">{r.fraccion || '—'}</td>
                    <td className="cell-mono">{r.cveProducto || '—'}</td>
                    <td className="cell-mono cell-right">{fmtInt(r.cantidad) || '—'}</td>
                    <td className="cell-mono">{r.umt || '—'}</td>
                    <td className="cell-mono">{r.pedimento || '—'}</td>
                    <td className="cell-mono cell-right cell-strong">{r.valorUSD != null ? fmtUSD(r.valorUSD) : '—'}</td>
                    <td className="cell-mono">{r.paisOrigen || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Page-scoped polish — shadcn-feel chrome on this surface only. */}
        <style>{`
          .anx-page {
            max-width: 1280px;
            margin: 0 auto;
            padding: 24px 20px 64px;
            color: var(--text-primary);
          }
          @media (max-width: 600px) {
            .anx-page { padding: 16px 14px 48px; }
          }

          /* Header */
          .anx-header { margin-bottom: 24px; }
          .anx-eyebrow {
            font-size: 11px; font-weight: 600;
            letter-spacing: 0.12em; text-transform: uppercase;
            color: var(--text-muted);
            margin-bottom: 8px;
          }
          .anx-title {
            font-size: 28px; font-weight: 700;
            letter-spacing: 0.04em;
            color: var(--text-primary);
            margin: 0 0 16px;
          }
          @media (max-width: 600px) {
            .anx-title { font-size: 22px; }
          }
          .anx-meta {
            display: flex; flex-wrap: wrap;
            gap: 8px 18px;
            padding: 12px 14px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 10px;
            font-size: 13px;
            color: var(--text-secondary);
          }
          .anx-meta-item {
            display: inline-flex; align-items: baseline; gap: 6px;
          }
          .anx-meta-label {
            font-size: 10px; font-weight: 600;
            letter-spacing: 0.08em; text-transform: uppercase;
            color: var(--text-muted);
          }
          .anx-meta-value {
            font-family: var(--font-mono);
            font-variant-numeric: tabular-nums;
            color: var(--text-primary);
          }

          /* CTA */
          .anx-cta { margin: 24px 0; }

          /* Table */
          .anx-table-wrap {
            border: 1px solid var(--border);
            border-radius: 10px;
            overflow-x: auto;
          }
          .anx-table {
            width: 100%;
            border-collapse: collapse;
            font-variant-numeric: tabular-nums;
            min-width: 1280px;
          }
          .anx-table th {
            font-size: 11px; font-weight: 600;
            letter-spacing: 0.04em; text-transform: uppercase;
            color: var(--text-muted);
            padding: 10px 12px;
            text-align: left;
            background: rgba(255,255,255,0.02);
            border-bottom: 1px solid var(--border);
            position: sticky; top: 0; z-index: 1;
            white-space: nowrap;
          }
          .anx-table td {
            padding: 10px 12px;
            font-size: 12px;
            color: var(--text-secondary);
            border-bottom: 1px solid rgba(255,255,255,0.04);
            white-space: nowrap;
          }
          .anx-table tbody tr { transition: background 120ms ease; }
          .anx-table tbody tr:nth-child(odd) { background: rgba(255,255,255,0.015); }
          .anx-table tbody tr:hover { background: rgba(192,197,206,0.06); }
          .anx-table tbody tr:last-child td { border-bottom: 0; }

          .cell-mono { font-family: var(--font-mono); }
          .cell-right { text-align: right; }
          .cell-strong { color: var(--text-primary); font-weight: 600; }
          .cell-soft  {
            color: var(--text-secondary);
            max-width: 200px;
            overflow: hidden; text-overflow: ellipsis;
            white-space: nowrap;
          }

          /* Empty */
          .anx-empty {
            padding: 32px 16px;
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'NEXT_REDIRECT' || msg === 'NEXT_NOT_FOUND') throw err
    return <CockpitErrorCard message={`No se pudo cargar Anexo 24: ${msg}`} />
  }
}

/**
 * Compose the 12-column partidas slice from existing tenant tables.
 * Same canonical 5-step join used by /pedimentos/[id], here ranged
 * across a date window. All queries anchor company_id unconditionally.
 */
async function fetchAnexo24Rows(
  supabase: ReturnType<typeof createServerClient>,
  companyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<Anexo24Row[]> {
  // 1. Traficos in window — gives aduana, regimen (clave), fecha_pago,
  //    pedimento, and the cve_trafico keys we'll join facturas on.
  const { data: tData } = await supabase
    .from('traficos')
    .select('trafico, aduana, regimen, fecha_pago, pedimento')
    .eq('company_id', companyId)
    .gte('fecha_pago', dateFrom)
    .lte('fecha_pago', dateTo)
    .not('fecha_pago', 'is', null)
    .order('fecha_pago', { ascending: false })
    .limit(5000)

  const traficos = ((tData ?? []) as Array<{
    trafico: string
    aduana: string | null
    regimen: string | null
    fecha_pago: string | null
    pedimento: string | null
  }>)

  if (traficos.length === 0) return []

  const traficoIds = traficos.map((t) => t.trafico)
  const traficoMap = new Map(traficos.map((t) => [t.trafico, t]))

  // 2. Facturas for those traficos — gives folio + numero (factura).
  const { data: fData } = await supabase
    .from('globalpc_facturas')
    .select('folio, numero, cve_trafico')
    .eq('company_id', companyId)
    .in('cve_trafico', traficoIds)
    .limit(10000)

  const facturas = ((fData ?? []) as Array<{
    folio: number | null
    numero: string | null
    cve_trafico: string | null
  }>)

  if (facturas.length === 0) return []

  const folioToFactura = new Map<number, { numero: string | null; cve_trafico: string | null }>()
  facturas.forEach((f) => {
    if (f.folio != null) folioToFactura.set(f.folio, { numero: f.numero, cve_trafico: f.cve_trafico })
  })
  const folios = Array.from(folioToFactura.keys())

  if (folios.length === 0) return []

  // 3. Partidas for those folios — gives cve_producto, cve_proveedor,
  //    cantidad, precio_unitario, pais_origen.
  const { data: pData } = await supabase
    .from('globalpc_partidas')
    .select('folio, cve_producto, cve_proveedor, cantidad, precio_unitario, pais_origen')
    .eq('company_id', companyId)
    .in('folio', folios)
    .limit(20000)

  const partidas = ((pData ?? []) as Array<{
    folio: number | null
    cve_producto: string | null
    cve_proveedor: string | null
    cantidad: number | null
    precio_unitario: number | null
    pais_origen: string | null
  }>)

  if (partidas.length === 0) return []

  // 4. Productos enrichment — fraccion + umt by cve_producto.
  const cveSet = Array.from(new Set(partidas.map((p) => p.cve_producto).filter((v): v is string => Boolean(v))))
  const productosByCve = new Map<string, { fraccion: string | null; umt: string | null }>()
  if (cveSet.length > 0) {
    const { data: prodData } = await supabase
      .from('globalpc_productos')
      .select('cve_producto, fraccion, umt')
      .eq('company_id', companyId)
      .in('cve_producto', cveSet)
      .limit(20000)
    for (const p of ((prodData ?? []) as Array<{ cve_producto: string | null; fraccion: string | null; umt: string | null }>)) {
      if (p.cve_producto && !productosByCve.has(p.cve_producto)) {
        productosByCve.set(p.cve_producto, { fraccion: p.fraccion, umt: p.umt })
      }
    }
  }

  // 5. Proveedores enrichment — name by cve_proveedor.
  const proveedorSet = Array.from(new Set(partidas.map((p) => p.cve_proveedor).filter((v): v is string => Boolean(v))))
  const proveedoresByCve = new Map<string, string>()
  if (proveedorSet.length > 0) {
    const { data: provData } = await supabase
      .from('globalpc_proveedores')
      .select('cve_proveedor, nombre')
      .eq('company_id', companyId)
      .in('cve_proveedor', proveedorSet)
      .limit(5000)
    for (const p of ((provData ?? []) as Array<{ cve_proveedor: string | null; nombre: string | null }>)) {
      if (p.cve_proveedor && p.nombre && !proveedoresByCve.has(p.cve_proveedor)) {
        proveedoresByCve.set(p.cve_proveedor, p.nombre)
      }
    }
  }

  // 6. Compose the 12-column shape.
  const rows: Anexo24Row[] = []
  for (const p of partidas) {
    if (p.folio == null) continue
    const factura = folioToFactura.get(p.folio)
    if (!factura?.cve_trafico) continue
    const trafico = traficoMap.get(factura.cve_trafico)
    if (!trafico) continue

    const prod = p.cve_producto ? productosByCve.get(p.cve_producto) : null
    const proveedorNombre = p.cve_proveedor ? proveedoresByCve.get(p.cve_proveedor) ?? p.cve_proveedor : ''
    const valor = p.cantidad != null && p.precio_unitario != null
      ? p.cantidad * p.precio_unitario
      : null

    rows.push({
      aduana: trafico.aduana ?? '',
      clave: trafico.regimen ?? '',
      fechaPago: trafico.fecha_pago,
      proveedor: proveedorNombre,
      factura: factura.numero ?? '',
      fraccion: prod?.fraccion ?? '',
      cveProducto: p.cve_producto ?? '',
      cantidad: p.cantidad,
      umt: prod?.umt ?? '',
      pedimento: trafico.pedimento ?? '',
      valorUSD: valor,
      paisOrigen: p.pais_origen ?? '',
    })
  }

  return rows
}
