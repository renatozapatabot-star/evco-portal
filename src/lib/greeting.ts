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

// ── Smart greeting with personality ──

export interface SmartGreetingInput {
  urgentCount: number
  enProcesoCount: number
  crossed24h: number
  newTraficos24h: number
  noPedGt7: number
  pendingEntradas: number
  tmecSavings: number
  avgConfidence: number
  daysSinceLastLogin?: number
}

export function getSmartGreeting(name: string | undefined, stats: SmartGreetingInput): { greeting: string; subtitle: string } {
  const hour = getLaredoHour()
  const day = getLaredoDay()
  const displayName = name || ''

  let greeting: string
  if (hour < 6) greeting = `Madrugada${displayName ? `, ${displayName}` : ''} — CRUZ está listo`
  else if (hour < 12) greeting = `Buenos días${displayName ? `, ${displayName}` : ''}`
  else if (hour < 18) greeting = `Buenas tardes${displayName ? `, ${displayName}` : ''}`
  else greeting = `Buenas noches${displayName ? `, ${displayName}` : ''}`

  if (day === 0 || day === 6) greeting += ' · Fin de semana'

  let subtitle: string

  // Comeback greeting (7+ days away)
  if (stats.daysSinceLastLogin && stats.daysSinceLastLogin >= 7) {
    const parts: string[] = ['¡Bienvenido de vuelta!']
    if (stats.crossed24h > 0 || stats.enProcesoCount > 0) {
      parts.push(`Mientras tanto, ${stats.enProcesoCount + stats.crossed24h} tráficos se movieron`)
    }
    if (stats.tmecSavings >= 1000) {
      parts.push(`y su ahorro T-MEC creció $${Math.round(stats.tmecSavings / 1000)}K`)
    }
    subtitle = parts.join('. ') + '.'
  }
  // T-MEC milestone celebration
  else if (stats.tmecSavings >= 100000 && stats.tmecSavings < 110000) {
    subtitle = 'Su ahorro T-MEC acumulado superó $100K. 🦀'
  } else if (stats.tmecSavings >= 500000 && stats.tmecSavings < 520000) {
    subtitle = 'Medio millón en ahorro T-MEC. Un logro extraordinario. 🦀'
  }
  // Urgent issues
  else if (stats.urgentCount > 0) {
    subtitle = `${stats.urgentCount} tráfico${stats.urgentCount !== 1 ? 's' : ''} necesita${stats.urgentCount !== 1 ? 'n' : ''} atención hoy.`
  }
  // Evening with pending items
  else if (hour >= 18 && stats.pendingEntradas > 0) {
    subtitle = `Tiene ${stats.pendingEntradas} entrada${stats.pendingEntradas !== 1 ? 's' : ''} pendiente${stats.pendingEntradas !== 1 ? 's' : ''} para mañana.`
  }
  // All clear
  else if (stats.urgentCount === 0 && stats.noPedGt7 === 0 && stats.pendingEntradas <= 5) {
    const parts: string[] = ['Todo en orden con sus operaciones']
    if (stats.avgConfidence > 0) parts[0] += ` · ${stats.avgConfidence}% certeza`
    if (stats.crossed24h > 0) parts.push(`${stats.crossed24h} cruzaron hoy`)
    if (stats.newTraficos24h > 0) parts.push(`${stats.newTraficos24h} nuevos`)
    subtitle = parts.join(' · ')
  }
  // Default stats
  else {
    const parts: string[] = []
    if (stats.avgConfidence > 0) parts.push(`${stats.avgConfidence}% certeza`)
    if (stats.crossed24h > 0) parts.push(`${stats.crossed24h} cruzaron hoy`)
    if (stats.newTraficos24h > 0) parts.push(`${stats.newTraficos24h} nuevos`)
    if (stats.noPedGt7 > 0) parts.push(`${stats.noPedGt7} sin pedimento >7 días`)
    if (stats.pendingEntradas > 0) parts.push(`${stats.pendingEntradas} entradas pendientes`)
    subtitle = parts.length > 0 ? parts.join(' · ') : 'Sin novedades'
  }

  return { greeting, subtitle }
}
