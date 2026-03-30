import { createClient } from '@supabase/supabase-js'

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

  const [criticalRes, overdueRes, semaforoRes, enRutaRes] = await Promise.all([
    supabase
      .from('traficos')
      .select('id', { count: 'exact', head: true })
      .ilike('trafico', `${clientClave}-%`)
      .not('estatus', 'ilike', '%cruz%')
      .or('score.lt.50,incidencia_abierta.eq.true')
      .not('pedimento', 'is', null),

    supabase
      .from('expediente_documentos')
      .select('id', { count: 'exact', head: true })
      .eq('clave_cliente', clientClave)
      .lt('completitud_pct', 100)
      .lt('fecha_limite', new Date().toISOString()),

    supabase
      .from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .ilike('trafico', `${clientClave}-%`)
      .eq('semaforo', 1)
      .is('fecha_cruce', null),

    supabase
      .from('traficos')
      .select('id', { count: 'exact', head: true })
      .ilike('trafico', `${clientClave}-%`)
      .not('estatus', 'ilike', '%cruz%')
  ])

  const criticalCount = criticalRes.count ?? 0
  const overdueCount = overdueRes.count ?? 0
  const semaforoRojo = semaforoRes.count ?? 0
  const enRuta = enRutaRes.count ?? 0
  const total = criticalCount + overdueCount

  if (semaforoRojo > 0) {
    return {
      level: 'red',
      sentence: `Accion urgente — ${semaforoRojo} semaforo${semaforoRojo > 1 ? 's' : ''} rojo${semaforoRojo > 1 ? 's' : ''} pendiente${semaforoRojo > 1 ? 's' : ''}`,
      count: total
    }
  }

  if (total > 5) {
    return {
      level: 'red',
      sentence: `${total} operaciones requieren atencion inmediata`,
      count: total
    }
  }

  if (total > 0) {
    const parts: string[] = []
    if (overdueCount > 0) parts.push(`${overdueCount} documento${overdueCount > 1 ? 's' : ''} vencido${overdueCount > 1 ? 's' : ''}`)
    if (criticalCount > 0) parts.push(`${criticalCount} trafico${criticalCount > 1 ? 's' : ''} critico${criticalCount > 1 ? 's' : ''}`)
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
