/**
 * Block 5 — Hoja de clasificación page.
 *
 * Server component. Session gate → tenant scope → fetch cliente default
 * config + productos. Hands props to ClasificacionClient for interactive
 * config + live preview.
 */
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { loadConfig } from '@/app/actions/classification'
import { DEFAULT_CONFIG, type Producto } from '@/types/classification'
import { ClasificacionClient } from './ClasificacionClient'

export default async function ClasificacionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const traficoId = decodeURIComponent(id)

  const session = await verifySession(
    (await cookies()).get('portal_session')?.value ?? '',
  )
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const isInternal =
    session.role === 'broker' || session.role === 'admin' || session.role === 'operator'

  let traficoQ = supabase
    .from('traficos')
    .select('trafico, company_id, regimen, pedimento')
    .eq('trafico', traficoId)
  if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)
  const { data: trafico } = await traficoQ.maybeSingle()
  if (!trafico) notFound()

  const typedTrafico = trafico as {
    trafico: string
    company_id: string | null
    regimen: string | null
    pedimento: string | null
  } & { tipo_operacion?: string | null }

  // Partidas chain: cve_trafico → facturas.folio → partidas → productos enrichment.
  // globalpc_partidas has no cve_trafico, fraccion, fraccion_arancelaria,
  // descripcion, umc, valor_comercial, or tmec columns. Real shape: folio (→ facturas),
  // cve_producto (→ productos for fraccion + descripcion), cantidad, precio_unitario.
  const companyIdForScope = typedTrafico.company_id ?? session.companyId

  const { data: facturasRaw } = await supabase
    .from('globalpc_facturas')
    .select('folio, valor_comercial')
    .eq('cve_trafico', traficoId)
    .eq('company_id', companyIdForScope)
    .limit(500)

  const folioValorMap = new Map<number, number | null>()
  for (const f of (facturasRaw ?? []) as Array<{
    folio: number | null
    valor_comercial: number | null
  }>) {
    if (f.folio != null) folioValorMap.set(f.folio, f.valor_comercial)
  }
  const folios = Array.from(folioValorMap.keys())

  type PartidaRaw = {
    id: number | null
    folio: number | null
    cve_producto: string | null
    cve_cliente: string | null
    cantidad: number | null
    precio_unitario: number | null
    pais_origen: string | null
  }
  let partidaRows: PartidaRaw[] = []
  if (folios.length > 0) {
    const { data } = await supabase
      .from('globalpc_partidas')
      .select('id, folio, cve_producto, cve_cliente, cantidad, precio_unitario, pais_origen')
      .in('folio', folios)
      .eq('company_id', companyIdForScope)
      .limit(2000)
    partidaRows = (data ?? []) as PartidaRaw[]
  }

  const productMap = new Map<string, { descripcion: string | null; fraccion: string | null }>()
  const cves = Array.from(
    new Set(partidaRows.map((p) => p.cve_producto).filter((c): c is string => !!c)),
  )
  if (cves.length > 0) {
    const { data: prods } = await supabase
      .from('globalpc_productos')
      .select('cve_producto, cve_cliente, descripcion, fraccion')
      .eq('company_id', companyIdForScope)
      .in('cve_producto', cves)
      .limit(2000)
    for (const p of (prods ?? []) as Array<{
      cve_producto: string | null
      cve_cliente: string | null
      descripcion: string | null
      fraccion: string | null
    }>) {
      productMap.set(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`, {
        descripcion: p.descripcion,
        fraccion: p.fraccion,
      })
    }
  }

  const productos: Producto[] = partidaRows.map((p) => {
    const enr = productMap.get(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`)
    const cantidad = Number(p.cantidad) || 0
    const precio = Number(p.precio_unitario) || 0
    return {
      id: p.id != null ? String(p.id) : undefined,
      cve_producto: p.cve_producto ?? undefined,
      fraccion_arancelaria: enr?.fraccion ?? undefined,
      fraccion: enr?.fraccion ?? undefined,
      descripcion: enr?.descripcion ?? undefined,
      umc: undefined, // globalpc_partidas has no UMC column; derive from fraccion UMT downstream if needed
      pais_origen: p.pais_origen ?? undefined,
      cantidad: cantidad || undefined,
      valor_comercial: cantidad * precio || undefined,
      certificado_origen_tmec: undefined, // partidas has no tmec column; traficos.predicted_tmec lives on the trafico
    }
  })

  // Cliente name lookup.
  let clienteName = typedTrafico.company_id ?? '—'
  if (typedTrafico.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('company_id', typedTrafico.company_id)
      .maybeSingle()
    const c = company as { name: string | null } | null
    if (c?.name) clienteName = c.name
  }

  let initialConfig = DEFAULT_CONFIG
  try {
    initialConfig = await loadConfig()
  } catch {
    // fall through to defaults
  }

  return (
    <ClasificacionClient
      traficoId={traficoId}
      clienteName={clienteName}
      regimen={typedTrafico.regimen}
      tipoOperacion={typedTrafico.tipo_operacion ?? null}
      pedimento={typedTrafico.pedimento}
      productos={productos}
      initialConfig={initialConfig}
    />
  )
}
