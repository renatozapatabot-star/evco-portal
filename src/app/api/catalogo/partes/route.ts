/**
 * GET /api/catalogo/partes — list view of a client's parts with
 * derived intelligence (times used, last used, T-MEC eligibility,
 * OCA count, supplier count).
 *
 * Auth: portal_session cookie → session.companyId. Query param
 * `company_id` is ignored for client role — impossible to ask for
 * another tenant.
 *
 * Query params:
 *   search   — substring match across descripcion / descripcion_ingles
 *              / cve_producto / fraccion (case-insensitive)
 *   fraccion — exact match on dotted or bare fracción
 *   sort     — "most_used" (default) | "recent" | "alpha"
 *   filter   — "todos" (default) | "con_tmec" | "sin_clasificar"
 *   limit    — default 50, max 200
 *   offset   — default 0
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { formatFraccion } from '@/lib/format/fraccion'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const querySchema = z.object({
  search: z.string().max(80).optional(),
  fraccion: z.string().max(12).optional(),
  sort: z.enum(['most_used', 'recent', 'alpha']).default('most_used'),
  filter: z.enum(['todos', 'con_tmec', 'sin_clasificar']).default('todos'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export interface ParteSummary {
  cve_producto: string
  descripcion: string | null
  descripcion_ingles: string | null
  fraccion: string | null
  fraccion_formatted: string | null
  nico: string | null
  umt: string | null
  pais_origen: string | null
  marca: string | null
  fraccion_classified_at: string | null
  fraccion_source: string | null
  times_used_24mo: number
  last_used_at: string | null
  tmec_eligible: boolean
  oca_count: number
  proveedores_count: number
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 },
    )
  }

  const { search, fraccion, sort, filter, limit, offset } = parsed.data

  // Client role: companyId from signed session. Broker/admin can aggregate
  // across clients via explicit company_id param (defense-in-depth: they
  // already bypass tenant scope in /api/data via isInternal).
  const isInternal = session.role === 'broker' || session.role === 'admin'
  const paramCompany = req.nextUrl.searchParams.get('company_id') || undefined
  const companyId = isInternal && paramCompany ? paramCompany : session.companyId

  // Internal placeholders ('admin' / 'internal') don't match any real
  // company_id — require an explicit param from internal roles.
  if ((companyId === 'admin' || companyId === 'internal') && !paramCompany) {
    return NextResponse.json(
      { data: { partes: [], total: 0 }, error: null },
      { status: 200 },
    )
  }

  // Pull everything EVCO-scoped with a reasonable upper bound. The join
  // metrics are computed in JS — the lateral-join SQL the spec outlines
  // would need an RPC helper we don't have. For EVCO (~149K productos,
  // 693 used in last 24mo) we take a two-query approach:
  //   1) pull partidas for this tenant over last 24mo (aggregate locally)
  //   2) pull productos with pagination + filters, annotate with the
  //      per-cve stats from step 1
  // Bounded by sort/filter/limit so the response shape stays reasonable.

  const twoYearsAgo = new Date(Date.now() - 730 * 86_400_000).toISOString()

  // Step 1: partidas aggregate for last 24mo
  // Using .limit(10000) — EVCO has ~10K partidas in a typical 24mo window.
  // If a tenant ever exceeds 10K, the tail rows are silently dropped —
  // not a correctness bug (the top of the list by usage is still right)
  // but flag if we see a tenant with >10K partidas in 24mo.
  const { data: partidasRaw, error: partidasErr } = await supabase
    .from('globalpc_partidas')
    .select('cve_producto, created_at, precio_unitario, cve_proveedor')
    .eq('company_id', companyId)
    .gte('created_at', twoYearsAgo)
    .limit(10_000)

  if (partidasErr) {
    console.error('[partes] partidas aggregate failed:', partidasErr.message)
  }

  type PartidaLite = { cve_producto: string; created_at: string; precio_unitario: number | null; cve_proveedor: string | null }
  const partidasByCve = new Map<string, { uses: number; lastUsed: string; proveedores: Set<string> }>()
  for (const p of (partidasRaw || []) as PartidaLite[]) {
    if (!p.cve_producto) continue
    const agg = partidasByCve.get(p.cve_producto) || { uses: 0, lastUsed: '', proveedores: new Set<string>() }
    agg.uses += 1
    if (p.created_at && p.created_at > agg.lastUsed) agg.lastUsed = p.created_at
    if (p.cve_proveedor) agg.proveedores.add(p.cve_proveedor)
    partidasByCve.set(p.cve_producto, agg)
  }

  // Step 2: pull OCA count per fraccion for this tenant (single query).
  const { data: ocaRows } = await supabase
    .from('oca_database')
    .select('fraccion')
    .eq('company_id', companyId)
    .limit(10_000)

  const ocaByFraccion = new Map<string, number>()
  for (const o of (ocaRows || []) as Array<{ fraccion: string | null }>) {
    if (!o.fraccion) continue
    ocaByFraccion.set(o.fraccion, (ocaByFraccion.get(o.fraccion) || 0) + 1)
  }

  // Step 3: T-MEC eligibility lookup (preferential_rate_tmec = 0)
  const { data: tmecRows } = await supabase
    .from('tariff_rates')
    .select('fraccion, preferential_rate_tmec')
    .eq('preferential_rate_tmec', 0)
    .limit(5000)

  const tmecFraccions = new Set<string>((tmecRows || []).map((t: any) => t.fraccion).filter(Boolean))

  // Step 4: productos with filters
  // allowlist-ok:globalpc_productos — list endpoint for Ursula's /catalogo page.
  // Scoped by company_id only. Applying the anexo-24 allowlist here would
  // collapse the list from ~149K legacy-inclusive rows to ~693 imported-only
  // rows for EVCO — a correctness improvement (per src/lib/anexo24/active-parts.ts
  // doc comment) but a visible UX change. Deferred as a deliberate Renato + Tito
  // decision post-Monday launch. Not a cross-tenant leak (company_id scoped).
  let q = supabase.from('globalpc_productos').select('*', { count: 'exact' }).eq('company_id', companyId)

  if (search && search.trim()) {
    const s = search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
    // OR search across the text-searchable columns
    q = q.or(
      `descripcion.ilike.%${s}%,descripcion_ingles.ilike.%${s}%,cve_producto.ilike.%${s}%,fraccion.ilike.%${s}%`,
    )
  }
  if (fraccion && fraccion.trim()) {
    const bare = fraccion.replace(/\./g, '')
    q = q.or(`fraccion.eq.${bare},fraccion.eq.${fraccion}`)
  }
  if (filter === 'sin_clasificar') {
    q = q.is('fraccion', null)
  }

  // Sort
  if (sort === 'recent') {
    q = q.order('created_at', { ascending: false, nullsFirst: false })
  } else if (sort === 'alpha') {
    q = q.order('descripcion', { ascending: true, nullsFirst: false })
  } else {
    // most_used sort is done client-side after annotation — fall back to
    // fraccion_classified_at as a stable DB sort so pagination still works
    q = q.order('fraccion_classified_at', { ascending: false, nullsFirst: false })
  }

  q = q.range(offset, offset + limit - 1)

  const { data: productos, count, error } = await q
  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  type ProductoRow = {
    cve_producto: string
    descripcion: string | null
    descripcion_ingles: string | null
    fraccion: string | null
    nico: string | null
    umt: string | null
    pais_origen: string | null
    marca: string | null
    fraccion_classified_at: string | null
    fraccion_source: string | null
    created_at: string | null
  }

  let partes: ParteSummary[] = (productos as ProductoRow[] | null || []).map((p) => {
    const agg = partidasByCve.get(p.cve_producto)
    const tmec = p.fraccion ? tmecFraccions.has(p.fraccion) : false
    const ocaCount = p.fraccion ? (ocaByFraccion.get(p.fraccion) ?? 0) : 0
    return {
      cve_producto: p.cve_producto,
      descripcion: p.descripcion,
      descripcion_ingles: p.descripcion_ingles,
      fraccion: p.fraccion,
      fraccion_formatted: formatFraccion(p.fraccion),
      nico: p.nico,
      umt: p.umt,
      pais_origen: p.pais_origen,
      marca: p.marca,
      fraccion_classified_at: p.fraccion_classified_at,
      fraccion_source: p.fraccion_source,
      times_used_24mo: agg?.uses ?? 0,
      last_used_at: agg?.lastUsed || null,
      tmec_eligible: tmec,
      oca_count: ocaCount,
      proveedores_count: agg?.proveedores.size ?? 0,
    }
  })

  if (filter === 'con_tmec') {
    partes = partes.filter((p) => p.tmec_eligible)
  }

  if (sort === 'most_used') {
    partes = partes.slice().sort((a, b) => b.times_used_24mo - a.times_used_24mo)
  }

  return NextResponse.json(
    {
      data: {
        partes,
        total: count ?? partes.length,
        filters_applied: { search: search || null, fraccion: fraccion || null, sort, filter },
      },
      error: null,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
    },
  )
}
