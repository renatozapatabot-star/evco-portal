function getLaredoHour(): number {
  return parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }), 10)
}

function getLaredoDay(): number {
  const dayStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short' })
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[dayStr] ?? new Date().getDay()
}

export function getGreeting(name?: string): string {
  const hour = getLaredoHour()
  const day = getLaredoDay()
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

  const day = getLaredoDay()
  if (day === 1) return `Inicio de semana — ${stats.enProcesoCount} tráficos activos.`
  if (day === 5) return `Viernes — ${stats.enProcesoCount} operaciones en proceso.`

  if (stats.enProcesoCount === 0) return 'Sin operaciones activas.'
  return 'Operación bajo control. Todo en orden.'
}
