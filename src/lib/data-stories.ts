/**
 * CRUZ Data Storytelling
 *
 * Turns raw metrics into plain-language narratives.
 * Deterministic templates — no AI calls, no latency, no cost.
 * The plant manager can repeat these in meetings.
 */

import { fmtUSDCompact } from '@/lib/format-utils'

// ── Dashboard narrative ──

export function dashboardStory(input: {
  enProceso: number
  cruzado: number
  tiempoDespacho: number
  tmecSavings: number
  tmecOps: number
  totalOps: number
  provActivos: number
  valorYTD: number
  sinIncidencia: number
}): string {
  const { enProceso, cruzado, tiempoDespacho, tmecSavings, tmecOps, provActivos, valorYTD, sinIncidencia } = input
  const parts: string[] = []

  // Volume + success rate
  if (cruzado > 0 && sinIncidencia >= 90) {
    parts.push(`${cruzado} operaciones completadas con ${sinIncidencia}% de éxito`)
  } else if (cruzado > 0) {
    parts.push(`${cruzado} operaciones completadas`)
  }

  // Dispatch time
  if (tiempoDespacho > 0 && tiempoDespacho <= 5) {
    parts.push(`tiempo promedio de despacho: ${tiempoDespacho} días — excelente`)
  } else if (tiempoDespacho > 0) {
    parts.push(`tiempo promedio de despacho: ${tiempoDespacho} días`)
  }

  // T-MEC savings
  if (tmecSavings >= 1000 && tmecOps > 0) {
    parts.push(`${tmecOps} operaciones con T-MEC le han ahorrado ${fmtUSDCompact(tmecSavings)}`)
  }

  // Active operations
  if (enProceso > 0) {
    parts.push(`${enProceso} en proceso actualmente`)
  }

  // YTD value
  if (valorYTD >= 100000) {
    parts.push(`${fmtUSDCompact(valorYTD)} importado en el año con ${provActivos} proveedores`)
  }

  if (parts.length === 0) return ''

  // Capitalize first part
  parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  return parts.join('. ') + '.'
}

// ── Financial narrative ──

export function financialStory(input: {
  valorTotal: number
  valorCruzado: number
  ahorrosTmec: number
  activeCount: number
  promedio: number
}): string {
  const { valorTotal, valorCruzado, ahorrosTmec, activeCount, promedio } = input
  const parts: string[] = []

  if (valorTotal > 0) {
    parts.push(`${fmtUSDCompact(valorTotal)} en ${activeCount} tráficos activos`)
  }

  if (valorCruzado > 0) {
    parts.push(`este mes cruzaron ${fmtUSDCompact(valorCruzado)}`)
  }

  if (ahorrosTmec >= 1000) {
    parts.push(`gracias a T-MEC, el ahorro estimado es ${fmtUSDCompact(ahorrosTmec)} — dinero que impacta directamente su margen`)
  }

  if (promedio > 0 && activeCount > 3) {
    parts.push(`promedio por operación: ${fmtUSDCompact(promedio)}`)
  }

  if (parts.length === 0) return ''

  parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  return parts.join('. ') + '.'
}

// ── Supplier narrative ──

export function supplierStory(input: {
  name: string
  traficoCount: number
  totalValue: number
  tmecRate: number
  avgDeliveryDays: number
}): string {
  const { name, traficoCount, totalValue, tmecRate, avgDeliveryDays } = input
  const parts: string[] = []

  parts.push(`${name} ha realizado ${traficoCount} operaciones por ${fmtUSDCompact(totalValue)}`)

  if (tmecRate > 0) {
    parts.push(`T-MEC aplicado en ${Math.round(tmecRate)}% de embarques`)
  }

  if (avgDeliveryDays > 0) {
    if (avgDeliveryDays <= 3) {
      parts.push(`despacho promedio: ${avgDeliveryDays} días — muy eficiente`)
    } else if (avgDeliveryDays <= 7) {
      parts.push(`despacho promedio: ${avgDeliveryDays} días`)
    } else {
      parts.push(`despacho promedio: ${avgDeliveryDays} días — oportunidad de mejora`)
    }
  }

  if (parts.length === 0) return ''

  parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  return parts.join('. ') + '.'
}
