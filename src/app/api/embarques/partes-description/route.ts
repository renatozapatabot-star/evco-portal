/**
 * CRUZ · GET /api/embarques/partes-description?traficos=A,B,C
 *
 * Given a list of trafico IDs, returns the aggregated product description
 * for each — sourced from the partes (globalpc_partidas) joined to
 * globalpc_productos for the descripcion field.
 *
 * Three-hop join chain (same as /api/auditoria-pdf + Formato 53 export):
 *   traficos.trafico = facturas.cve_trafico
 *   facturas.folio   = partidas.folio
 *   partidas.cve_producto = productos.cve_producto
 *
 * Response shape:
 *   { data: { [trafico]: { descriptions: string[], count: number } } }
 *
 * Tenant isolation: session.companyId is the hard wall. Internal
 * (broker/admin) roles may pass ?company_id=X to probe another tenant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MAX_TRAFICOS_PER_REQUEST = 500
const MAX_DESCRIPTIONS_PER_TRAFICO = 8

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  const traficosParam = url.searchParams.get('traficos') ?? ''
  const companyOverride = url.searchParams.get('company_id')
  const isInternal = session.role === 'broker' || session.role === 'admin'
  const companyId = isInternal && companyOverride ? companyOverride : session.companyId

  const traficoIds = traficosParam
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, MAX_TRAFICOS_PER_REQUEST)

  if (traficoIds.length === 0) {
    return NextResponse.json({ data: {}, error: null })
  }

  // Step 1: facturas (cve_trafico → folio). Chunk to stay under PostgREST
  // .in() ceiling.
  const facturas: Array<{ cve_trafico: string | null; folio: number | null }> = []
  for (const batch of chunk(traficoIds, 500)) {
    const { data, error } = await supabase
      .from('globalpc_facturas')
      .select('cve_trafico, folio')
      .eq('company_id', companyId)
      .in('cve_trafico', batch)
    if (error) {
      return NextResponse.json(
        { data: null, error: { code: 'DATA_ERROR', message: `facturas: ${error.message}` } },
        { status: 500 },
      )
    }
    for (const r of (data ?? []) as Array<{ cve_trafico: string | null; folio: number | null }>) {
      facturas.push(r)
    }
  }

  const folioToTrafico = new Map<number, string>()
  for (const f of facturas) {
    if (f.folio != null && f.cve_trafico) folioToTrafico.set(f.folio, f.cve_trafico)
  }

  // Step 2: partidas (folio → cve_producto)
  const folios = Array.from(folioToTrafico.keys())
  const partidas: Array<{ folio: number | null; cve_producto: string | null }> = []
  for (const batch of chunk(folios, 1000)) {
    if (batch.length === 0) continue
    const { data, error } = await supabase
      .from('globalpc_partidas')
      .select('folio, cve_producto')
      .eq('company_id', companyId)
      .in('folio', batch)
    if (error) {
      return NextResponse.json(
        { data: null, error: { code: 'DATA_ERROR', message: `partidas: ${error.message}` } },
        { status: 500 },
      )
    }
    for (const r of (data ?? []) as Array<{ folio: number | null; cve_producto: string | null }>) {
      partidas.push(r)
    }
  }

  // Step 3: productos (cve_producto → descripcion)
  const cves = Array.from(new Set(partidas.map((p) => p.cve_producto).filter((x): x is string => !!x)))
  const cveToDescription = new Map<string, string>()
  for (const batch of chunk(cves, 1000)) {
    if (batch.length === 0) continue
    const { data, error } = await supabase
      .from('globalpc_productos')
      .select('cve_producto, descripcion')
      .eq('company_id', companyId)
      .in('cve_producto', batch)
    if (error) {
      return NextResponse.json(
        { data: null, error: { code: 'DATA_ERROR', message: `productos: ${error.message}` } },
        { status: 500 },
      )
    }
    for (const r of (data ?? []) as Array<{ cve_producto: string | null; descripcion: string | null }>) {
      if (r.cve_producto && r.descripcion) cveToDescription.set(r.cve_producto, r.descripcion)
    }
  }

  // Assemble: trafico → ordered unique descriptions
  const out: Record<string, { descriptions: string[]; count: number }> = {}
  for (const p of partidas) {
    if (p.folio == null) continue
    const trafico = folioToTrafico.get(p.folio)
    if (!trafico) continue
    const desc = p.cve_producto ? cveToDescription.get(p.cve_producto) : null
    if (!desc) continue
    const entry = out[trafico] ?? { descriptions: [], count: 0 }
    entry.count++
    if (entry.descriptions.length < MAX_DESCRIPTIONS_PER_TRAFICO && !entry.descriptions.includes(desc)) {
      entry.descriptions.push(desc)
    }
    out[trafico] = entry
  }

  return NextResponse.json({ data: out, error: null })
}
