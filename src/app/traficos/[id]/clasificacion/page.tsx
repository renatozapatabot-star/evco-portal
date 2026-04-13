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

  const { data: partidasRaw } = await supabase
    .from('globalpc_partidas')
    .select(
      'id, cve_producto, fraccion_arancelaria, fraccion, descripcion, umc, pais_origen, cantidad, valor_comercial, tmec',
    )
    .eq('cve_trafico', traficoId)
    .limit(2000)

  type Row = {
    id?: string | null
    cve_producto?: string | null
    fraccion_arancelaria?: string | null
    fraccion?: string | null
    descripcion?: string | null
    umc?: string | null
    pais_origen?: string | null
    cantidad?: number | null
    valor_comercial?: number | null
    tmec?: boolean | null
  }

  const productos: Producto[] = ((partidasRaw as Row[] | null) ?? []).map((p) => ({
    id: p.id ?? undefined,
    cve_producto: p.cve_producto ?? undefined,
    fraccion_arancelaria: p.fraccion_arancelaria ?? undefined,
    fraccion: p.fraccion ?? undefined,
    descripcion: p.descripcion ?? undefined,
    umc: p.umc ?? undefined,
    pais_origen: p.pais_origen ?? undefined,
    cantidad: p.cantidad ?? undefined,
    valor_comercial: p.valor_comercial ?? undefined,
    certificado_origen_tmec: p.tmec ?? undefined,
  }))

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
