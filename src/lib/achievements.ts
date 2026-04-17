/**
 * CRUZ Achievement Engine
 *
 * Computes operational milestones from existing embarque + entrada data.
 * Pure functions — no DB calls, no side effects.
 * All data comes from arrays already loaded on dashboard/logros page.
 */

import { fmtUSDCompact } from '@/lib/format-utils'

export interface Achievement {
  id: string
  icon: string
  title: string
  description: string
  earned: boolean
  earnedDate?: string
  value?: string
  progress?: number      // 0-1
  progressLabel?: string // "7 de 10"
}

interface TraficoInput {
  trafico?: string
  estatus?: string | null
  pedimento?: string | null
  fecha_llegada?: string | null
  fecha_cruce?: string | null
  proveedores?: string | null
  score_reasons?: string | null
  regimen?: string | null
  [k: string]: unknown
}

interface EntradaInput {
  tiene_faltantes?: boolean | null
  mercancia_danada?: boolean | null
  fecha_llegada_mercancia?: string | null
}

// ── Helpers ──

function isCruzado(t: TraficoInput): boolean {
  return (t.estatus || '').toLowerCase().includes('cruz')
}

function hasAnomalies(t: TraficoInput): boolean {
  const reasons = t.score_reasons ? String(t.score_reasons) : ''
  return reasons.includes('"level":"critical"') || reasons.includes('"level":"elevated"')
}

function dwellDays(t: TraficoInput): number | null {
  if (!t.fecha_llegada || !t.fecha_cruce) return null
  const d = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
  return d >= 0 && d < 60 ? Math.round(d * 10) / 10 : null
}

function isClean(e: EntradaInput): boolean {
  return e.tiene_faltantes !== true && e.mercancia_danada !== true
}

// ── Achievement computations ──

export function computeAchievements(
  traficos: TraficoInput[],
  entradas: EntradaInput[],
  tmecSavings: { totalSavings: number },
): Achievement[] {
  const cruzados = traficos
    .filter(isCruzado)
    .sort((a, b) => (a.fecha_cruce || '').localeCompare(b.fecha_cruce || ''))

  // 1. Primer despacho
  const firstCrossing = cruzados[0]
  const primerDespacho: Achievement = {
    id: 'primer_despacho',
    icon: '🚀',
    title: 'Primer despacho',
    description: 'Primer embarque despachado con PORTAL',
    earned: !!firstCrossing,
    earnedDate: firstCrossing?.fecha_cruce || undefined,
    value: firstCrossing ? `Embarque ${firstCrossing.trafico}` : undefined,
    progress: cruzados.length > 0 ? 1 : 0,
    progressLabel: cruzados.length > 0 ? undefined : 'Sin despachos aún',
  }

  // 2. Expediente perfecto — confidence 100 proxy
  const perfectShipment = cruzados.find(t =>
    t.pedimento && !hasAnomalies(t) && isCruzado(t)
  )
  const expedientePerfecto: Achievement = {
    id: 'expediente_perfecto',
    icon: '📋',
    title: 'Expediente perfecto',
    description: '100% documentos en un embarque',
    earned: !!perfectShipment,
    earnedDate: perfectShipment?.fecha_cruce || undefined,
    value: perfectShipment ? `Embarque ${perfectShipment.trafico}` : undefined,
    progress: perfectShipment ? 1 : Math.min(0.8, cruzados.filter(t => t.pedimento).length / Math.max(cruzados.length, 1)),
    progressLabel: perfectShipment ? undefined : 'Pedimento + documentos sin anomalías',
  }

  // 3. Racha de 10 — 10 consecutive clean cruzados
  const recentCruzados = [...cruzados].reverse()
  let consecutiveClean = 0
  for (const t of recentCruzados) {
    if (!hasAnomalies(t)) consecutiveClean++
    else break
  }
  const racha10: Achievement = {
    id: 'racha_10',
    icon: '🔥',
    title: 'Racha de 10',
    description: '10 despachos consecutivos sin incidencias',
    earned: consecutiveClean >= 10,
    earnedDate: consecutiveClean >= 10 ? recentCruzados[9]?.fecha_cruce || undefined : undefined,
    value: consecutiveClean >= 10 ? `${consecutiveClean} despachos consecutivos` : undefined,
    progress: Math.min(1, consecutiveClean / 10),
    progressLabel: consecutiveClean < 10 ? `${consecutiveClean} de 10 embarques` : undefined,
  }

  // 4. T-MEC campeón — $50K+ savings
  const savings = tmecSavings.totalSavings
  const tmecCampeon: Achievement = {
    id: 'tmec_campeon',
    icon: '💰',
    title: 'T-MEC campeón',
    description: 'Más de $50K en ahorro por tasas preferenciales',
    earned: savings >= 50000,
    value: savings >= 50000 ? `Ahorro: ${fmtUSDCompact(savings)}` : undefined,
    progress: Math.min(1, savings / 50000),
    progressLabel: savings < 50000 ? `${fmtUSDCompact(savings)} de $50K USD` : undefined,
  }

  // 5. Velocidad récord — any embarque ≤ 2 days dwell
  let fastest: { trafico: string; days: number; date: string } | null = null
  for (const t of cruzados) {
    const d = dwellDays(t)
    if (d !== null && d <= 2) {
      if (!fastest || d < fastest.days) {
        fastest = { trafico: t.trafico || '', days: d, date: t.fecha_cruce || '' }
      }
    }
  }
  const velocidadRecord: Achievement = {
    id: 'velocidad_record',
    icon: '⚡',
    title: 'Velocidad récord',
    description: 'Despacho en 2 días o menos',
    earned: !!fastest,
    earnedDate: fastest?.date,
    value: fastest ? `${fastest.days} días · Embarque ${fastest.trafico}` : undefined,
    progress: fastest ? 1 : 0,
    progressLabel: fastest ? undefined : 'Despacho en ≤2 días',
  }

  // 6. Proveedor estrella — supplier with 5+ clean cruzados
  const supplierMap = new Map<string, { total: number; clean: number }>()
  for (const t of cruzados) {
    const suppliers = (t.proveedores || '').split(',').map(s => s.trim()).filter(Boolean)
    for (const s of suppliers) {
      const entry = supplierMap.get(s) || { total: 0, clean: 0 }
      entry.total++
      if (!hasAnomalies(t)) entry.clean++
      supplierMap.set(s, entry)
    }
  }
  let starSupplier: string | null = null
  for (const [name, stats] of supplierMap) {
    if (stats.total >= 5 && stats.clean === stats.total) {
      starSupplier = name
      break
    }
  }
  const proveedorEstrella: Achievement = {
    id: 'proveedor_estrella',
    icon: '⭐',
    title: 'Proveedor estrella',
    description: 'Proveedor con 5+ despachos sin incidencias',
    earned: !!starSupplier,
    value: starSupplier ? starSupplier.substring(0, 30) : undefined,
    progress: starSupplier ? 1 : 0,
    progressLabel: starSupplier ? undefined : '5+ despachos limpios de un proveedor',
  }

  // 7. Cero incidencias — last 30 entradas all clean
  const recentEntradas = entradas
    .filter(e => e.fecha_llegada_mercancia)
    .sort((a, b) => (b.fecha_llegada_mercancia || '').localeCompare(a.fecha_llegada_mercancia || ''))
    .slice(0, 30)
  const allClean = recentEntradas.length >= 10 && recentEntradas.every(isClean)
  const cleanCount = recentEntradas.filter(isClean).length
  const ceroIncidencias: Achievement = {
    id: 'cero_incidencias',
    icon: '🛡️',
    title: 'Cero incidencias',
    description: '30 entradas consecutivas sin faltantes ni daños',
    earned: allClean,
    value: allClean ? `${recentEntradas.length} entradas sin incidencias` : undefined,
    progress: recentEntradas.length > 0 ? cleanCount / Math.min(30, recentEntradas.length) : 0,
    progressLabel: !allClean ? `${cleanCount} de ${Math.min(30, recentEntradas.length)} entradas` : undefined,
  }

  return [
    primerDespacho,
    expedientePerfecto,
    racha10,
    tmecCampeon,
    velocidadRecord,
    proveedorEstrella,
    ceroIncidencias,
  ]
}

// ── Streak calculator ──

export function computeStreak(entradas: EntradaInput[]): { days: number; since: string | null } {
  const sorted = entradas
    .filter(e => e.fecha_llegada_mercancia)
    .sort((a, b) => (b.fecha_llegada_mercancia || '').localeCompare(a.fecha_llegada_mercancia || ''))

  let count = 0
  let since: string | null = null

  for (const e of sorted) {
    if (isClean(e)) {
      count++
      since = e.fecha_llegada_mercancia || null
    } else {
      break
    }
  }

  return { days: count, since }
}
