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
  clientClave: string,
  companyId?: string
): Promise<StatusResult> {
  const useCompanyId = companyId && companyId !== 'internal' && companyId !== 'admin'

  // Semáforo rojo count
  let semaforoQ = supabase
    .from('traficos')
    .select('trafico', { count: 'exact', head: true })
    .eq('semaforo', 1)
    .is('fecha_cruce', null)
  if (useCompanyId) semaforoQ = semaforoQ.eq('company_id', companyId!)

  // Active embarques count
  let activeQ = supabase
    .from('traficos')
    .select('id', { count: 'exact', head: true })
    .not('estatus', 'ilike', '%cruz%')
    .gte('fecha_llegada', '2024-01-01')
  if (useCompanyId) activeQ = activeQ.eq('company_id', companyId!)

  // Pending entradas (no trafico linked)
  let entradasQ = supabase
    .from('entradas')
    .select('fecha_llegada_mercancia', { count: 'exact' })
    .is('trafico', null)
    .order('fecha_llegada_mercancia', { ascending: true })
    .limit(1)
  if (useCompanyId) entradasQ = entradasQ.eq('company_id', companyId!)

  const [semaforoRes, activeRes, entradasRes] = await Promise.all([
    semaforoQ, activeQ, entradasQ,
  ])

  const semaforoRojo = semaforoRes.count ?? 0
  const activeTraficos = activeRes.count ?? 0
  const pendingEntradas = entradasRes.count ?? 0
  const oldestEntrada = entradasRes.data?.[0]?.fecha_llegada_mercancia
  const oldestDays = oldestEntrada
    ? Math.floor((Date.now() - new Date(oldestEntrada as string).getTime()) / 86400000)
    : 0

  // Red: semáforo rojo
  if (semaforoRojo > 0) {
    return {
      level: 'red',
      sentence: `⚠ ${semaforoRojo} semáforo${semaforoRojo > 1 ? 's' : ''} rojo · Requiere atención`,
      count: semaforoRojo,
    }
  }

  // Amber: old entradas
  if (oldestDays > 30) {
    return {
      level: 'amber',
      sentence: `${pendingEntradas} entrada${pendingEntradas !== 1 ? 's' : ''} pendiente${pendingEntradas !== 1 ? 's' : ''} · La más antigua: ${oldestDays} días`,
      count: pendingEntradas,
    }
  }

  // Amber: many pending entradas
  if (pendingEntradas > 10) {
    return {
      level: 'amber',
      sentence: `${pendingEntradas} entradas sin embarque asignado`,
      count: pendingEntradas,
    }
  }

  // Green
  return {
    level: 'green',
    sentence: `Todo en orden — ${activeTraficos} en ruta, sin acciones urgentes. 🦀`,
    count: 0,
  }
}
