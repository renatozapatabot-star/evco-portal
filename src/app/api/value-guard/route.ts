import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
  }
  const role = session.role
  if (role !== 'broker' && role !== 'admin') {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Acceso restringido' } }, { status: 401 })
  }

  const trafico = req.nextUrl.searchParams.get('trafico')
  if (!trafico) return NextResponse.json({ error: 'Missing trafico param' }, { status: 400 })

  // Get products for this trafico via the canonical 2-hop join:
  //   facturas(cve_trafico) → folios
  //   partidas(folio in)    → cve_producto + precio_unitario + cantidad
  //   productos(cve_producto in) → descripcion + fraccion
  // globalpc_partidas has no cve_trafico, descripcion, or fraccion columns
  // (M15 phantom sweep).
  const { data: facturas } = await supabase
    .from('globalpc_facturas')
    .select('folio')
    .eq('cve_trafico', trafico)
  const folios = (facturas ?? []).map(f => f.folio).filter((x): x is number => x != null)
  type PartidaRow = { cve_producto: string | null; precio_unitario: number | null; cantidad: number | null }
  let partidaRows: PartidaRow[] = []
  if (folios.length > 0) {
    const { data } = await supabase
      .from('globalpc_partidas')
      .select('cve_producto, precio_unitario, cantidad')
      .in('folio', folios)
    partidaRows = (data ?? []) as PartidaRow[]
  }
  const cves = Array.from(new Set(partidaRows.map(p => p.cve_producto).filter((x): x is string => !!x)))
  const productMap = new Map<string, { descripcion: string | null; fraccion: string | null }>()
  if (cves.length > 0) {
    const { data: prods } = await supabase
      .from('globalpc_productos')
      .select('cve_producto, descripcion, fraccion')
      .in('cve_producto', cves)
    for (const p of (prods ?? []) as Array<{ cve_producto: string | null; descripcion: string | null; fraccion: string | null }>) {
      if (p.cve_producto) productMap.set(p.cve_producto, { descripcion: p.descripcion, fraccion: p.fraccion })
    }
  }
  const items = partidaRows.map(p => {
    const prod = p.cve_producto ? productMap.get(p.cve_producto) : undefined
    return {
      descripcion: prod?.descripcion ?? '',
      fraccion: prod?.fraccion ?? '',
      precio_unitario: p.precio_unitario,
      cantidad: p.cantidad,
    }
  })
  if (items.length === 0) {
    return NextResponse.json({ clean: true, anomalies: [], message: 'Sin partidas para este embarque' })
  }

  // Get baselines from product_intelligence
  const fracciones = [...new Set(items.map(i => i.fraccion).filter(Boolean))]
  const { data: baselines } = await supabase
    .from('product_intelligence')
    .select('descripcion, fraccion, avg_unit_price, price_stddev, operation_count')
    .in('fraccion', fracciones.length > 0 ? fracciones : ['none'])

  const baselineMap: Record<string, { avg: number; std: number; count: number }> = {}
  ;(baselines || []).forEach(b => {
    if (b.fraccion && b.avg_unit_price) {
      const key = `${b.fraccion}::${(b.descripcion || '').substring(0, 50)}`
      baselineMap[key] = { avg: Number(b.avg_unit_price), std: Number(b.price_stddev || 0), count: Number(b.operation_count || 0) }
    }
  })

  const anomalies: Array<{ product: string; fraccion: string; declared_price: number; historical_avg: number; deviation_pct: number; z_score: number; severity: string }> = []
  items.forEach(item => {
    if (!item.precio_unitario || !item.fraccion) return
    const price = Number(item.precio_unitario)
    if (price <= 0) return

    // Try exact match first, then fraccion-only
    let baseline = baselineMap[`${item.fraccion}::${(item.descripcion || '').substring(0, 50)}`]
    if (!baseline) {
      const fraccionBaselines = Object.entries(baselineMap).filter(([k]) => k.startsWith(item.fraccion + '::'))
      if (fraccionBaselines.length > 0) {
        const avgAll = fraccionBaselines.reduce((s, [, b]) => s + b.avg, 0) / fraccionBaselines.length
        const stdAll = fraccionBaselines.reduce((s, [, b]) => s + b.std, 0) / fraccionBaselines.length
        baseline = { avg: avgAll, std: stdAll, count: fraccionBaselines.length }
      }
    }

    if (!baseline || baseline.std === 0 || baseline.count < 3) return

    const zScore = Math.abs(price - baseline.avg) / baseline.std
    if (zScore > 2.0) {
      const deviationPct = Math.round(((price - baseline.avg) / baseline.avg) * 100)
      anomalies.push({
        product: item.descripcion || '',
        fraccion: item.fraccion,
        declared_price: price,
        historical_avg: Math.round(baseline.avg * 100) / 100,
        deviation_pct: deviationPct,
        z_score: Math.round(zScore * 100) / 100,
        severity: zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low',
      })
    }
  })

  return NextResponse.json({
    clean: anomalies.length === 0,
    anomalies,
    items_checked: items.length,
    baselines_available: Object.keys(baselineMap).length,
  })
}
