export function getGreeting(name?: string): string {
  const hour = new Date().getHours()
  const day = new Date().getDay()
  const displayName = name || ''

  let greeting: string
  if (hour < 6) greeting = `Madrugada${displayName ? `, ${displayName}` : ''} — CRUZ está listo`
  else if (hour < 12) greeting = `Buenos días${displayName ? `, ${displayName}` : ''}`
  else if (hour < 18) greeting = `Buenas tardes${displayName ? `, ${displayName}` : ''}`
  else greeting = `Buenas noches${displayName ? `, ${displayName}` : ''}`

  if (day === 0 || day === 6) greeting += ' · Fin de semana'
  return greeting
}

export function getContextBriefing(stats: {
  urgentCount: number
  enProcesoCount: number
  mveDays: number
  mvePending: number
  allCrossed: boolean
}): string {
  if (stats.allCrossed) return 'Todos los tráficos del día han cruzado.'
  if (stats.mveDays <= 7 && stats.mvePending > 0) return `MVE obligatorio en ${stats.mveDays}d — ${stats.mvePending} operaciones pendientes.`
  if (stats.urgentCount > 0) return `${stats.urgentCount} tráfico${stats.urgentCount !== 1 ? 's' : ''} necesita${stats.urgentCount !== 1 ? 'n' : ''} atención hoy.`

  const day = new Date().getDay()
  if (day === 1) return `Inicio de semana — ${stats.enProcesoCount} tráficos activos.`
  if (day === 5) return `Viernes — ${stats.enProcesoCount} operaciones en proceso.`

  if (stats.enProcesoCount === 0) return 'Sin operaciones activas.'
  return 'Operación bajo control. Todo en orden.'
}
