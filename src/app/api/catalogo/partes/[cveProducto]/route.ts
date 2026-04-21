/**
 * GET /api/catalogo/partes/[cveProducto] — deep view of one parte.
 *
 * Session-scoped: 404 if the cve_producto doesn't belong to the
 * caller's company_id. Never 403 — don't tell an attacker the
 * resource exists for someone else.
 *
 * Shape documented in the block spec. All nested arrays are scoped to
 * the caller's tenant.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { formatFraccion } from '@/lib/format/fraccion'
import { resolveProveedorName } from '@/lib/proveedor-names'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest, ctx: { params: Promise<{ cveProducto: string }> }) {
  const token = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }

  const params = await ctx.params
  const cveProducto = decodeURIComponent(params.cveProducto || '').trim()
  if (!cveProducto || cveProducto.length > 64) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid cve_producto' } },
      { status: 400 },
    )
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const paramCompany = req.nextUrl.searchParams.get('company_id') || undefined
  const companyId = isInternal && paramCompany ? paramCompany : session.companyId

  // Ownership check. globalpc_productos can have duplicate rows for
  // the same (cve_producto, company_id) — legacy sync data — so
  // maybeSingle() would 500 with "multiple rows". Take the newest row
  // instead (order by created_at desc, limit 1).
  const { data: parteRows, error: parteErr } = await supabase
    .from('globalpc_productos')
    .select('*')
    .eq('cve_producto', cveProducto)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1)

  if (parteErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: parteErr.message } },
      { status: 500 },
    )
  }
  const parteRow = parteRows?.[0]
  if (!parteRow) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Parte no encontrada' } },
      { status: 404 },
    )
  }

  const fraccion = parteRow.fraccion as string | null

  // All follow-up queries are guarded — one failure shouldn't blank the
  // whole page. The base parte row is already loaded above.
  const [partidasRes, classificationsRes, ocasRes, tmecRes, supertitoRes] = await Promise.all([
    supabase
      .from('globalpc_partidas')
      .select('created_at, cantidad, precio_unitario, cve_proveedor, cve_trafico')
      .eq('cve_producto', cveProducto)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('classification_log')
      .select('numero_parte, clave_insumo, fraccion_assigned, think_confidence, supertito_agreed, supertito_correction, ts')
      .eq('client_id', companyId)
      .or(`numero_parte.eq.${cveProducto},clave_insumo.eq.${cveProducto}`)
      .order('ts', { ascending: false })
      .limit(10),
    fraccion
      ? supabase
          .from('oca_database')
          .select('id, fraccion, legal_reasoning, approved_by, last_used, use_count, alternative_fracciones, created_at')
          .eq('company_id', companyId)
          .eq('fraccion', fraccion)
          .order('last_used', { ascending: false, nullsFirst: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
    fraccion
      ? supabase
          .from('tariff_rates')
          .select('fraccion, preferential_rate_tmec')
          .eq('fraccion', fraccion)
          .limit(1)
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('classification_log')
      .select('supertito_agreed, supertito_correction', { count: 'exact' })
      .eq('client_id', companyId)
      .or(`numero_parte.eq.${cveProducto},clave_insumo.eq.${cveProducto}`),
  ])

  type PartidaLite = {
    created_at: string | null
    cantidad: number | null
    precio_unitario: number | null
    cve_proveedor: string | null
    cve_trafico: string | null
  }
  const partidas = (partidasRes.data as PartidaLite[] | null) || []

  // Enrich with the associated trafico row so the UI can show
  // pedimento, fecha_cruce, semáforo — the demo-critical moment.
  // Join key: globalpc_partidas.cve_trafico = traficos.trafico
  // (both are the operator-facing string reference like "T-26-12345").
  const distinctTraficoRefs = Array.from(
    new Set(
      partidas
        .slice(0, 40)
        .map((p) => p.cve_trafico)
        .filter((r): r is string => !!r),
    ),
  )
  const { data: traficoRows } = distinctTraficoRefs.length
    ? await supabase
        .from('traficos')
        .select('trafico, pedimento, fecha_cruce, fecha_llegada, semaforo')
        .eq('company_id', companyId)
        .in('trafico', distinctTraficoRefs)
    : { data: [] as Array<{
        trafico: string | null
        pedimento: string | null
        fecha_cruce: string | null
        fecha_llegada: string | null
        semaforo: number | null
      }> }

  const traficoByRef = new Map<
    string,
    {
      pedimento: string | null
      fecha_cruce: string | null
      fecha_llegada: string | null
      semaforo: number | null
    }
  >()
  for (const t of traficoRows ?? []) {
    if (!t.trafico) continue
    traficoByRef.set(t.trafico, {
      pedimento: t.pedimento ?? null,
      fecha_cruce: t.fecha_cruce ?? null,
      fecha_llegada: t.fecha_llegada ?? null,
      semaforo: typeof t.semaforo === 'number' ? t.semaforo : null,
    })
  }

  // Derived: usage_timeline (first 20), enriched
  const uses_timeline = partidas.slice(0, 20).map((p) => {
    const trafico = p.cve_trafico ? traficoByRef.get(p.cve_trafico) : null
    return {
      created_at: p.created_at,
      trafico_ref: p.cve_trafico,
      pedimento: trafico?.pedimento ?? null,
      fecha_cruce: trafico?.fecha_cruce ?? null,
      fecha_llegada: trafico?.fecha_llegada ?? null,
      semaforo: trafico?.semaforo ?? null,
      cantidad: p.cantidad,
      umt: parteRow.umt,
      precio_unitario: p.precio_unitario,
      proveedor_clave: p.cve_proveedor,
    }
  })

  // Aggregate crossing health over the fetched window.
  // semaforo: 0 = verde, 1 = amarillo, 2 = rojo (null = unknown)
  let crossings_total = 0
  let crossings_verde = 0
  for (const enriched of uses_timeline) {
    if (enriched.fecha_cruce) {
      crossings_total += 1
      if (enriched.semaforo === 0) crossings_verde += 1
    }
  }
  const crossings_summary = {
    total: crossings_total,
    verde: crossings_verde,
    pct_verde:
      crossings_total > 0
        ? Math.round((crossings_verde / crossings_total) * 100)
        : null,
  }

  // Derived: proveedores aggregate (top 5)
  const proveedorStats = new Map<string, { uses: number; priceSum: number; priceN: number; last: string | null }>()
  for (const p of partidas) {
    if (!p.cve_proveedor) continue
    const s = proveedorStats.get(p.cve_proveedor) || { uses: 0, priceSum: 0, priceN: 0, last: null }
    s.uses += 1
    if (typeof p.precio_unitario === 'number') {
      s.priceSum += p.precio_unitario
      s.priceN += 1
    }
    if (p.created_at && (!s.last || p.created_at > s.last)) s.last = p.created_at
    proveedorStats.set(p.cve_proveedor, s)
  }
  // Enrich with proveedor names from globalpc_proveedores
  const proveedorClaves = Array.from(proveedorStats.keys()).slice(0, 5)
  const { data: proveedorRows } = proveedorClaves.length
    ? await supabase
        .from('globalpc_proveedores')
        .select('cve_proveedor, nombre')
        .eq('company_id', companyId)
        .in('cve_proveedor', proveedorClaves)
    : { data: [] as Array<{ cve_proveedor: string; nombre: string | null }> }

  const nameByClave = new Map<string, string | null>(
    (proveedorRows || []).map(
      (r: { cve_proveedor: string; nombre: string | null }) => [r.cve_proveedor, r.nombre],
    ),
  )

  const proveedores = proveedorClaves
    .map((clave) => {
      const s = proveedorStats.get(clave)!
      return {
        clave,
        nombre: resolveProveedorName(clave, nameByClave.get(clave) ?? null),
        uses: s.uses,
        avg_price: s.priceN > 0 ? Math.round((s.priceSum / s.priceN) * 100) / 100 : null,
        last_use: s.last,
      }
    })
    .sort((a, b) => b.uses - a.uses)

  // Derived: cost trend by month (last 12)
  const cutoff12mo = new Date(Date.now() - 365 * 86_400_000).toISOString()
  const monthly = new Map<string, { sum: number; n: number; uses: number }>()
  for (const p of partidas) {
    if (!p.created_at || p.created_at < cutoff12mo) continue
    if (typeof p.precio_unitario !== 'number') continue
    const month = p.created_at.slice(0, 7) // YYYY-MM
    const bucket = monthly.get(month) || { sum: 0, n: 0, uses: 0 }
    bucket.sum += p.precio_unitario
    bucket.n += 1
    bucket.uses += 1
    monthly.set(month, bucket)
  }
  const cost_trend = Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => ({
      month,
      avg_price: Math.round((b.sum / b.n) * 100) / 100,
      uses: b.uses,
    }))

  // Lifetime stats (no date filter)
  const { count: lifetimeCount } = await supabase
    .from('globalpc_partidas')
    .select('*', { count: 'exact', head: true })
    .eq('cve_producto', cveProducto)
    .eq('company_id', companyId)

  // 24mo window stats
  const twoYearsAgo = new Date(Date.now() - 730 * 86_400_000).toISOString()
  const partidas24mo = partidas.filter((p) => p.created_at && p.created_at > twoYearsAgo)

  // SuperTito rollup
  const supertitoRows = (supertitoRes.data as Array<{ supertito_agreed: boolean | null; supertito_correction: string | null }>) || []
  const supertito_stats = {
    agreed: supertitoRows.filter((r) => r.supertito_agreed === true).length,
    corrections: supertitoRows.filter((r) => r.supertito_correction !== null && r.supertito_correction !== '').length,
    total: supertitoRes.count ?? supertitoRows.length,
  }

  // tmecRes.data is now an array (.limit(1)) or null (empty branch)
  const tmecRow = Array.isArray(tmecRes.data) ? tmecRes.data[0] : tmecRes.data
  const tmecEligible = !!(
    tmecRow && (tmecRow as { preferential_rate_tmec: number | null }).preferential_rate_tmec === 0
  )

  return NextResponse.json(
    {
      data: {
        parte: {
          cve_producto: parteRow.cve_producto,
          descripcion: parteRow.descripcion,
          descripcion_ingles: parteRow.descripcion_ingles,
          fraccion: parteRow.fraccion,
          fraccion_formatted: formatFraccion(parteRow.fraccion),
          nico: parteRow.nico,
          umt: parteRow.umt,
          pais_origen: parteRow.pais_origen,
          marca: parteRow.marca,
          precio_unitario: parteRow.precio_unitario,
          fraccion_classified_at: parteRow.fraccion_classified_at,
          fraccion_source: parteRow.fraccion_source,
          created_at: parteRow.created_at,
          tmec_eligible: tmecEligible,
          times_used_24mo: partidas24mo.length,
          times_used_lifetime: lifetimeCount ?? partidas.length,
          last_used_at: partidas[0]?.created_at ?? null,
        },
        classifications: (classificationsRes.data || []) as Record<string, unknown>[],
        ocas: (ocasRes.data || []) as Record<string, unknown>[],
        uses_timeline,
        crossings_summary,
        proveedores,
        cost_trend,
        supertito_stats,
      },
      error: null,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
    },
  )
}
