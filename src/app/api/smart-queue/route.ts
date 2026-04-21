import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/smart-queue
 * Returns prioritized list of traficos that need attention.
 * Priority = urgency (age) × value × missing docs weight.
 * Broker workflow: "Work on these first."
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get active traficos (not crossed, not completed)
  const { data: traficos, error } = await supabase
    .from('traficos')
    .select('trafico, company_id, estatus, fecha_llegada, pedimento, importe_total, descripcion_mercancia, proveedores')
    .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana'])
    .not('fecha_llegada', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .order('fecha_llegada', { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get document counts per trafico
  const traficoIds = (traficos || []).map(t => t.trafico)
  const docCounts: Record<string, number> = {}

  if (traficoIds.length > 0) {
    for (let i = 0; i < traficoIds.length; i += 100) {
      const batch = traficoIds.slice(i, i + 100)
      const { data: docs } = await supabase
        .from('expediente_documentos')
        .select('pedimento_id')
        .in('pedimento_id', batch)

      for (const d of (docs || [])) {
        docCounts[d.pedimento_id] = (docCounts[d.pedimento_id] || 0) + 1
      }
    }
  }

  // Score each trafico
  const scored = (traficos || []).map(t => {
    const daysActive = Math.floor((Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000)
    const value = Number(t.importe_total) || 0
    const hasPedimento = !!t.pedimento
    const docCount = docCounts[t.trafico] || 0
    const docsComplete = docCount >= 5 // rough threshold

    // Priority score: higher = more urgent
    let priority = 0
    priority += Math.min(daysActive * 2, 60) // Age weight (max 60)
    priority += value > 100000 ? 30 : value > 50000 ? 20 : value > 10000 ? 10 : 5 // Value weight
    priority += !hasPedimento ? 25 : 0 // No pedimento = urgent
    priority += !docsComplete ? 15 : 0 // Missing docs = needs attention
    priority += daysActive > 14 ? 20 : 0 // Overdue bonus

    const reason = []
    if (daysActive > 14) reason.push(`${daysActive} días activo`)
    if (!hasPedimento) reason.push('sin pedimento')
    if (!docsComplete) reason.push(`${docCount} docs (faltan)`)
    if (value > 100000) reason.push('alto valor')

    return {
      trafico: t.trafico,
      company_id: t.company_id,
      estatus: t.estatus,
      fecha_llegada: t.fecha_llegada,
      days_active: daysActive,
      valor_usd: value,
      has_pedimento: hasPedimento,
      doc_count: docCount,
      priority,
      reason: reason.join(' · ') || 'procesamiento normal',
      descripcion: t.descripcion_mercancia,
      proveedor: t.proveedores,
    }
  })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 20)

  return NextResponse.json({
    queue: scored,
    total_active: traficos?.length || 0,
    generated_at: new Date().toISOString(),
  })
}
