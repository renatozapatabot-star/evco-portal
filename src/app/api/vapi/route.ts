import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getTraficoStatus(params: { trafico?: string; pedimento?: string }) {
  let q = supabase.from('traficos').select('*')
  if (params.trafico) q = q.ilike('trafico', `%${params.trafico}%`)
  if (params.pedimento) q = q.ilike('pedimento', `%${params.pedimento}%`)
  const { data, error } = await q.gte('fecha_llegada', PORTAL_DATE_FROM).order('created_at', { ascending: false }).limit(5)
  if (error) return { error: error.message }
  if (!data?.length) return { message: 'No se encontró ese embarque.' }
  return data.map(t => ({
    trafico: t.trafico,
    pedimento: t.pedimento,
    status: t.status || t.estado,
    cliente: t.clave_cliente,
    fecha: t.fecha_pago || t.created_at,
  }))
}

async function getActiveShipments(params: { cliente?: string }) {
  let q = supabase.from('traficos').select('*')
    .in('status', ['en_proceso', 'en_aduana', 'pendiente', 'activo'])
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .order('created_at', { ascending: false })
    .limit(10)
  if (params.cliente) q = q.ilike('clave_cliente', `%${params.cliente}%`)
  const { data, error } = await q
  if (error) return { error: error.message }
  if (!data?.length) return { message: 'No hay embarques activos en este momento.' }
  return { count: data.length, shipments: data.map(t => ({
    trafico: t.trafico,
    pedimento: t.pedimento,
    status: t.status || t.estado,
    cliente: t.clave_cliente,
  }))}
}

async function getFinancialSummary(params: { cliente?: string }) {
  const { data: cartera } = await supabase.from('econta_cartera')
    .select('*').limit(20).order('fecha_documento', { ascending: false })
  const { data: ingresos } = await supabase.from('econta_ingresos')
    .select('*').limit(10).order('fecha', { ascending: false })
  return {
    cartera_pendiente: cartera?.length || 0,
    ingresos_recientes: ingresos?.length || 0,
    resumen: 'Consulta el portal para detalles completos de la cartera.',
  }
}

const functionHandlers: Record<string, (params: Record<string, string>) => Promise<unknown>> = {
  getTraficoStatus,
  getActiveShipments,
  getFinancialSummary,
}

export async function POST(request: NextRequest) {
  // Vapi server-to-server — shared-secret auth matches /api/vapi-llm.
  // Prevents any visitor from querying traficos via a crafted function-call
  // payload (endpoint queries cross-tenant, so the leak is portal-wide).
  const vapiSecret = request.headers.get('x-vapi-secret') || ''
  const expected = process.env.VAPI_PRIVATE_KEY || ''
  if (!expected || vapiSecret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { message } = body

  // Vapi sends function-call messages
  if (message?.type === 'function-call') {
    const fnName = message.functionCall?.name
    const fnParams = message.functionCall?.parameters || {}
    const handler = functionHandlers[fnName]
    if (!handler) {
      return NextResponse.json({ result: `Función ${fnName} no disponible.` })
    }
    const result = await handler(fnParams)
    return NextResponse.json({ result: JSON.stringify(result) })
  }

  // Vapi status updates (call started, ended, etc.)
  if (message?.type === 'status-update' || message?.type === 'end-of-call-report') {

    return NextResponse.json({ ok: true })
  }

  // Default: acknowledge
  return NextResponse.json({ ok: true })
}
