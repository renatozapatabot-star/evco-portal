import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data } = await supabase
    .from('traficos')
    .select('estatus, cruz_score, fecha_cruce, fecha_pago, updated_at')
    .eq('company_id', 'evco')

  const rows = data || []
  const today = new Date().toISOString().split('T')[0]

  const enProceso = rows.filter(r => r.estatus === 'En Proceso').length
  const urgentes = rows.filter(r => r.estatus === 'En Proceso' && (r.cruz_score || 100) < 50).length
  const cruzadosHoy = rows.filter(r => {
    if (r.estatus !== 'Cruzado') return false
    const d = r.fecha_cruce || r.fecha_pago || r.updated_at
    return d?.startsWith(today)
  }).length

  return NextResponse.json(
    { enProceso, urgentes, cruzadosHoy, total: rows.length },
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } }
  )
}
