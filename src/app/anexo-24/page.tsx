// CRUZ · /anexo-24 — Formato 53 report surface (audit lock-in 2026-04-25).
//
// Single-purpose screen. Header + download CTA + 12-column partidas table.
// Existing data only; canonical 5-step join via traficos → facturas →
// partidas → productos → proveedores. Shared formatters everywhere.

import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { cleanCompanyDisplayName } from '@/lib/format/company-name'
import { CockpitSkeleton, CockpitErrorCard } from '@/components/aguila'
import { Anexo24DownloadCta } from './Anexo24DownloadCta'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateDMY, formatNumber, formatCurrencyUSD } from '@/lib/format'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'
export const revalidate = 60

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
      ['Periodo', `${formatDateDMY(dateFrom)} a ${formatDateDMY(dateTo)}`],
      ['Partidas', formatNumber(rows.length)],
    ]

    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div className={styles.eyebrow}>Inteligencia aduanal · Patente 3596</div>
          <h1 className={styles.title}>ANEXO 24 · FORMATO 53</h1>
          <div className={styles.meta}>
            {meta.map(([label, value]) => (
              <span key={label} className={styles.metaItem}>
                <span className={styles.metaLabel}>{label}</span>
                <span className={styles.metaValue}>{value}</span>
              </span>
            ))}
          </div>
        </header>

        <section className={styles.cta}>
          <Anexo24DownloadCta companyId={ownerCompanyId} isInternal={isInternal} />
        </section>

        {rows.length === 0 ? (
          <EmptyState
            title="Sin partidas en este periodo"
            description="Sube el Formato 53 más reciente o ajusta el rango."
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} role="table" aria-label="Partidas Formato 53">
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
                    <td className={styles.cellMono}>{r.aduana || '—'}</td>
                    <td className={styles.cellMono}>{r.clave || '—'}</td>
                    <td className={styles.cellMono}>{formatDateDMY(r.fechaPago) || '—'}</td>
                    <td className={styles.cellSoft} title={r.proveedor || undefined}>{r.proveedor || '—'}</td>
                    <td className={styles.cellMono}>{r.factura || '—'}</td>
                    <td className={styles.cellMono}>{r.fraccion || '—'}</td>
                    <td className={styles.cellMono}>{r.cveProducto || '—'}</td>
                    <td className={`${styles.cellMono} ${styles.cellRight}`}>{formatNumber(r.cantidad) || '—'}</td>
                    <td className={styles.cellMono}>{r.umt || '—'}</td>
                    <td className={styles.cellMono}>{r.pedimento || '—'}</td>
                    <td className={`${styles.cellMono} ${styles.cellRight} ${styles.cellStrong}`}>{r.valorUSD != null ? formatCurrencyUSD(r.valorUSD) : '—'}</td>
                    <td className={styles.cellMono}>{r.paisOrigen || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
