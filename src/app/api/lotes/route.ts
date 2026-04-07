import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Trafico {
  trafico: string
  proveedor: string | null
  estatus: string
  fraccion_arancelaria: string | null
  importe_total: number | null
  moneda: string | null
  regimen: string | null
}

interface Batch {
  id: string
  title: string
  description: string
  count: number
  estimated_minutes: number
  action: string
  traficos: string[]
}

// GET — build intelligent batches from active tráficos
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  const companyId = session.companyId

  const { data: traficos, error } = await supabase
    .from('traficos')
    .select('trafico, proveedor, estatus, fraccion_arancelaria, importe_total, moneda, regimen')
    .eq('company_id', companyId)
    .in('estatus', ['En proceso', 'Pedimento Pagado', 'En tránsito', 'Documentos pendientes'])
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ data: null, error: { code: 'QUERY_FAILED', message: error.message } })
  }

  if (!traficos || traficos.length === 0) {
    return NextResponse.json({ data: { batches: [], total_traficos: 0 }, error: null })
  }

  const batches: Batch[] = []

  // Group 1: Same supplier + same status
  const supplierGroups: Record<string, Trafico[]> = {}
  for (const t of traficos) {
    const key = `${t.proveedor || 'Sin proveedor'}::${t.estatus}`
    if (!supplierGroups[key]) supplierGroups[key] = []
    supplierGroups[key].push(t)
  }

  for (const [key, group] of Object.entries(supplierGroups)) {
    if (group.length < 2) continue
    const [supplier, status] = key.split('::')
    batches.push({
      id: `supplier-${key}`,
      title: `${supplier} (${group.length})`,
      description: `Mismo proveedor, ${status.toLowerCase()}`,
      count: group.length,
      estimated_minutes: Math.max(2, Math.ceil(group.length * 0.5)),
      action: status === 'Pedimento Pagado' ? 'aprobar' : status === 'Documentos pendientes' ? 'solicitar' : 'revisar',
      traficos: group.map(t => t.trafico),
    })
  }

  // Group 2: Ready to cross (Pedimento Pagado)
  const readyToCross = traficos.filter(t => t.estatus === 'Pedimento Pagado')
  if (readyToCross.length >= 2) {
    batches.push({
      id: 'cruces-hoy',
      title: `Cruces listos (${readyToCross.length})`,
      description: 'Pedimentos pagados, listos para cruce',
      count: readyToCross.length,
      estimated_minutes: Math.max(3, Math.ceil(readyToCross.length * 0.3)),
      action: 'aprobar',
      traficos: readyToCross.map(t => t.trafico),
    })
  }

  // Group 3: Missing documents (En proceso)
  const needsDocs = traficos.filter(t => t.estatus === 'En proceso' || t.estatus === 'Documentos pendientes')
  if (needsDocs.length >= 2) {
    batches.push({
      id: 'docs-pendientes',
      title: `Documentos pendientes (${needsDocs.length})`,
      description: 'Expedientes incompletos — solicitar en bloque',
      count: needsDocs.length,
      estimated_minutes: Math.max(3, Math.ceil(needsDocs.length * 0.5)),
      action: 'solicitar',
      traficos: needsDocs.map(t => t.trafico),
    })
  }

  // Sort batches: largest first
  batches.sort((a, b) => b.count - a.count)

  // Deduplicate — remove supplier batches that are subsets of status batches
  const seen = new Set<string>()
  const uniqueBatches = batches.filter(b => {
    if (seen.has(b.id)) return false
    seen.add(b.id)
    return true
  })

  return NextResponse.json({
    data: {
      batches: uniqueBatches.slice(0, 10),
      total_traficos: traficos.length,
    },
    error: null,
  })
}
