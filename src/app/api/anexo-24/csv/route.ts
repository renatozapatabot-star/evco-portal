/**
 * GET /api/anexo-24/csv — CSV export of a client's Anexo 24 snapshot.
 *
 * Complement to the existing PDF + XLSX exports at
 * /api/reports/anexo-24/generate. CSV is the format Anabel (and any
 * client's accounting team) can open with zero tooling. Columns mirror
 * Formato 53 so a CSV → Excel paste lands on the same structure.
 *
 * Session-scoped: client role exports their own company_id; broker +
 * admin can pass ?company_id=XXX for cross-tenant exports.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { formatFraccion } from '@/lib/format/fraccion'
import { resolveProveedorName } from '@/lib/proveedor-names'
import { getActiveCveProductos, activeCvesArray } from '@/lib/anexo24/active-parts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** RFC-4180 CSV escape — wraps in quotes if value contains comma,
 *  quote, or newline; doubles any inner quotes. */
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const paramCompany = req.nextUrl.searchParams.get('company_id') || undefined
  const companyId = isInternal && paramCompany ? paramCompany : session.companyId
  if (!companyId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing company_id' } },
      { status: 400 },
    )
  }

  // CSV mirrors the /anexo-24 surface contract: only parts this
  // company has actually imported (has at least one partida for).
  // Exports SAT-truth inventory, not the sync mirror's long tail.
  const active = await getActiveCveProductos(supabase, companyId)
  const activeList = activeCvesArray(active)

  let productosQuery = supabase
    .from('globalpc_productos')
    .select('cve_producto, descripcion, fraccion, pais_origen, umt, cve_proveedor')
    .eq('company_id', companyId)
    .order('cve_producto', { ascending: true })
    .limit(10_000)
  if (activeList.length > 0) productosQuery = productosQuery.in('cve_producto', activeList)

  const { data: productos, error: prodErr } = await productosQuery

  if (prodErr) {
    console.error('[anexo-24/csv] productos fetch:', prodErr.message)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'No pudimos generar el CSV' } },
      { status: 500 },
    )
  }

  // Resolve proveedor names in one batch.
  const cveProveedores = Array.from(new Set((productos ?? []).map((p) => p.cve_proveedor).filter(Boolean) as string[]))
  const proveedorMap = new Map<string, string>()
  if (cveProveedores.length > 0) {
    const { data: provRows } = await supabase
      .from('globalpc_proveedores')
      .select('cve_proveedor, nombre')
      .in('cve_proveedor', cveProveedores)
    for (const p of (provRows ?? [])) {
      if (p.cve_proveedor && p.nombre) proveedorMap.set(p.cve_proveedor, p.nombre)
    }
  }

  const header = [
    'Numero de parte',
    'Descripcion',
    'Fraccion arancelaria',
    'Unidad de medida',
    'Pais de origen',
    'Proveedor',
  ]
  const rows: string[] = [header.join(',')]

  for (const p of (productos ?? [])) {
    const proveedor = resolveProveedorName(p.cve_proveedor, proveedorMap.get(p.cve_proveedor ?? '') ?? null)
    rows.push([
      csvEscape(p.cve_producto),
      csvEscape(p.descripcion),
      csvEscape(p.fraccion ? (formatFraccion(p.fraccion) ?? p.fraccion) : ''),
      csvEscape(p.umt),
      csvEscape(p.pais_origen),
      csvEscape(proveedor === 'Proveedor pendiente de identificar' ? '' : proveedor),
    ].join(','))
  }

  const body = rows.join('\n') + '\n'
  const filename = `anexo-24-${companyId}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
