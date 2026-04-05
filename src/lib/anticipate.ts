/**
 * CRUZ Anticipatory Engine
 *
 * Predicts what the client wants to see based on time, day,
 * operational state, and visit history. Returns 0 or 1 suggestion.
 * Pure function — no DB calls, no side effects.
 */

import { fmtUSDCompact } from '@/lib/format-utils'

export interface Suggestion {
  id: string
  icon: string
  text: string
  action?: { label: string; href: string }
}

interface TraficoInput {
  trafico?: string
  estatus?: string | null
  pedimento?: string | null
  fecha_llegada?: string | null
  fecha_cruce?: string | null
  proveedores?: string | null
  importe_total?: number | null
  [k: string]: unknown
}

interface AnticipateInput {
  traficos: TraficoInput[]
  tmecSavings: number
  dayOfWeek: number   // 0=Sun
  hour: number
  lastVisit?: string | null  // ISO timestamp
}

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function isCruzado(t: TraficoInput): boolean {
  return (t.estatus || '').toLowerCase().includes('cruz')
}

export function anticipate(input: AnticipateInput): Suggestion | null {
  const { traficos, tmecSavings, dayOfWeek, hour, lastVisit } = input
  const now = Date.now()

  // ── Priority 1: Monday morning → weekend summary ──
  if (dayOfWeek === 1 && hour >= 6 && hour < 10) {
    const weekendStart = new Date(now - 3 * 86400000).toISOString() // Friday
    const crossedWeekend = traficos.filter(t =>
      isCruzado(t) && t.fecha_cruce && t.fecha_cruce >= weekendStart
    ).length
    const newWeekend = traficos.filter(t =>
      t.fecha_llegada && t.fecha_llegada >= weekendStart && !isCruzado(t)
    ).length

    if (crossedWeekend > 0 || newWeekend > 0) {
      const parts: string[] = []
      if (crossedWeekend > 0) parts.push(`${crossedWeekend} cruzaron`)
      if (newWeekend > 0) parts.push(`${newWeekend} nuevos`)
      return {
        id: `weekend-${new Date().toISOString().split('T')[0]}`,
        icon: '📅',
        text: `El fin de semana: ${parts.join(', ')}.`,
        action: { label: 'Ver tráficos', href: '/traficos' },
      }
    }
  }

  // ── Priority 2: Tráfico crossed recently (last 60 min) ──
  const sixtyMinAgo = new Date(now - 60 * 60 * 1000).toISOString()
  const recentCrossing = traficos.find(t =>
    isCruzado(t) && t.fecha_cruce && t.fecha_cruce >= sixtyMinAgo
  )
  if (recentCrossing) {
    return {
      id: `crossed-${recentCrossing.trafico}`,
      icon: '✅',
      text: `${recentCrossing.trafico} cruzó recientemente. 🦀`,
      action: { label: 'Ver detalle', href: `/traficos/${encodeURIComponent(recentCrossing.trafico || '')}` },
    }
  }

  // ── Priority 3: Document pending > 3 days ──
  const threeDaysAgo = new Date(now - 3 * 86400000).toISOString()
  const pendingDoc = traficos.find(t => {
    if (isCruzado(t)) return false
    if (t.pedimento) return false
    return t.fecha_llegada && t.fecha_llegada < threeDaysAgo
  })
  if (pendingDoc) {
    const days = Math.floor((now - new Date(pendingDoc.fecha_llegada!).getTime()) / 86400000)
    const supplier = (pendingDoc.proveedores || '').split(',')[0]?.trim() || 'proveedor'
    return {
      id: `pending-doc-${pendingDoc.trafico}`,
      icon: '📄',
      text: `Pedimento pendiente de ${supplier} — ${days} días.`,
      action: { label: 'Ver tráfico', href: `/traficos/${encodeURIComponent(pendingDoc.trafico || '')}` },
    }
  }

  // ── Priority 4: Month end (last 3 days) ──
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  if (today.getDate() >= daysInMonth - 2) {
    const monthName = MONTHS_ES[today.getMonth()]
    const yearStart = `${today.getFullYear()}-01-01`
    const imported = traficos
      .filter(t => (t.fecha_llegada || '') >= yearStart)
      .reduce((s, t) => s + (Number(t.importe_total) || 0), 0)

    return {
      id: `month-end-${today.getFullYear()}-${today.getMonth()}`,
      icon: '📊',
      text: `Cierre de ${monthName}. ${fmtUSDCompact(imported)} importado, ${fmtUSDCompact(tmecSavings)} ahorro T-MEC.`,
      action: { label: 'Ver reportes', href: '/reportes' },
    }
  }

  // ── Priority 5: Long absence (7+ days) ──
  if (lastVisit) {
    const daysSince = Math.floor((now - new Date(lastVisit).getTime()) / 86400000)
    if (daysSince >= 7) {
      const sinceDate = new Date(lastVisit).toISOString()
      const crossed = traficos.filter(t => isCruzado(t) && t.fecha_cruce && t.fecha_cruce >= sinceDate).length
      const newOnes = traficos.filter(t => t.fecha_llegada && t.fecha_llegada >= sinceDate && !isCruzado(t)).length
      const pending = traficos.filter(t => !isCruzado(t) && !t.pedimento).length

      return {
        id: `comeback-${new Date().toISOString().split('T')[0]}`,
        icon: '👋',
        text: `Desde su última visita: ${crossed} cruzados, ${newOnes} nuevos, ${pending} pendientes.`,
        action: { label: 'Ver resumen', href: '/traficos' },
      }
    }
  }

  // Nothing to anticipate
  return null
}

// ── Dismiss tracking (localStorage) ──

const DISMISS_KEY = 'cruz-dismissed-suggestions'
const DISMISS_TTL = 24 * 60 * 60 * 1000 // 24h

export function isDismissed(id: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const map: Record<string, number> = JSON.parse(raw)
    const ts = map[id]
    if (!ts) return false
    return Date.now() - ts < DISMISS_TTL
  } catch {
    return false
  }
}

export function dismissSuggestion(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    const map: Record<string, number> = raw ? JSON.parse(raw) : {}
    // Clean expired entries
    const now = Date.now()
    for (const key of Object.keys(map)) {
      if (now - map[key] > DISMISS_TTL) delete map[key]
    }
    map[id] = now
    localStorage.setItem(DISMISS_KEY, JSON.stringify(map))
  } catch {
    // localStorage unavailable
  }
}
