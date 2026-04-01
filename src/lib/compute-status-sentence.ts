import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface StatusResult {
  level: 'green' | 'amber' | 'red'
  sentence: string
  count: number
}

export async function computeStatusSentence(
  clientClave: string
): Promise<StatusResult> {

  // Use ilike trafico prefix (same filter as dashboard) for consistent counts
  const prefix = `${clientClave}-%`
  const [criticalRes, overdueRes, semaforoRes, enRutaRes] = await Promise.all([
    supabase
      .from('traficos')
      .select('id', { count: 'exact', head: true })
      .ilike('trafico', prefix)
      .not('estatus', 'ilike', '%cruz%')
      .is('pedimento', null)
      .gte('fecha_llegada', PORTAL_DATE_FROM),

    supabase
      .from('expediente_documentos')
      .select('id', { count: 'exact', head: true })
      .eq('clave_cliente', clientClave)
      .lt('completitud_pct', 100)
      .lt('fecha_limite', new Date().toISOString()),

    supabase
      .from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .ilike('trafico', prefix)
      .eq('semaforo', 1)
      .is('fecha_cruce', null)
      .gte('fecha_llegada', PORTAL_DATE_FROM),

    supabase
      .from('traficos')
      .select('id', { count: 'exact', head: true })
      .ilike('trafico', prefix)
      .not('estatus', 'ilike', '%cruz%')
      .gte('fecha_llegada', PORTAL_DATE_FROM)
  ])

  const criticalCount = criticalRes.count ?? 0
  const overdueCount = overdueRes.count ?? 0
  const semaforoRojo = semaforoRes.count ?? 0
  const enRuta = enRutaRes.count ?? 0
  const total = criticalCount + overdueCount

  if (semaforoRojo > 0) {
    return {
      level: 'red',
      sentence: `Acción urgente — ${semaforoRojo} semaforo${semaforoRojo > 1 ? 's' : ''} rojo${semaforoRojo > 1 ? 's' : ''} pendiente${semaforoRojo > 1 ? 's' : ''}`,
      count: total
    }
  }

  if (total > 5) {
    return {
      level: 'red',
      sentence: `${total} operaciones requieren atención inmediata`,
      count: total
    }
  }

  if (total > 0) {
    const parts: string[] = []
    if (overdueCount > 0) parts.push(`${overdueCount} documento${overdueCount > 1 ? 's' : ''} vencido${overdueCount > 1 ? 's' : ''}`)
    if (criticalCount > 0) parts.push(`${criticalCount} tráfico${criticalCount > 1 ? 's' : ''} crítico${criticalCount > 1 ? 's' : ''}`)
    return {
      level: 'amber',
      sentence: `${total} acciones pendientes — ${parts.join(', ')}`,
      count: total
    }
  }

  return {
    level: 'green',
    sentence: `Todo en orden — ${enRuta} en ruta, sin acciones urgentes`,
    count: 0
  }
}
