import type { IfThenCardState } from './IfThenCard'

export interface CardStateResult {
  state: IfThenCardState
  activeCondition?: string
  activeAction?: string
  urgentCondition?: string
  urgentAction?: string
}

function pl(n: number, s: string, p: string): string {
  return n === 1 ? s : p
}

// ── Client Cards ──────────────────────────────────

export function computeStatusHeroState(
  activeShipments: number,
  entradasThisMonth: number,
): CardStateResult {
  if (activeShipments === 0 && entradasThisMonth === 0) {
    return { state: 'quiet' }
  }
  if (activeShipments > 0) {
    return {
      state: 'active',
      activeCondition: `${activeShipments} ${pl(activeShipments, 'envío', 'envíos')} en tránsito`,
      activeAction: 'Ver embarques',
    }
  }
  return { state: 'quiet' }
}

export function computeFinancialState(
  thisMonth: number,
  lastMonth: number,
): CardStateResult {
  if (lastMonth === 0 && thisMonth === 0) return { state: 'quiet' }
  if (lastMonth === 0) return { state: 'quiet' }

  const delta = ((thisMonth - lastMonth) / lastMonth) * 100
  const absDelta = Math.abs(delta)

  if (absDelta < 10) return { state: 'quiet' }
  if (absDelta >= 30) {
    return {
      state: 'urgent',
      urgentCondition: delta > 0
        ? `Facturación ↑${Math.round(absDelta)}% vs mes anterior`
        : `Facturación ↓${Math.round(absDelta)}% vs mes anterior`,
      urgentAction: delta > 0 ? 'Ver detalle financiero' : 'Revisar cuentas',
    }
  }
  return {
    state: 'active',
    activeCondition: delta > 0
      ? `Facturación ↑${Math.round(absDelta)}% vs mes anterior`
      : `Facturación ↓${Math.round(absDelta)}% vs mes anterior`,
    activeAction: 'Ver financiero',
  }
}

export function computeInventoryState(
  bultos: number,
  oldestDays: number,
): CardStateResult {
  if (bultos === 0) return { state: 'quiet' }
  if (oldestDays > 14) {
    return {
      state: 'urgent',
      urgentCondition: `${bultos} ${pl(bultos, 'bulto', 'bultos')} con más de 14 días en bodega`,
      urgentAction: 'Solicitar liberación',
    }
  }
  if (oldestDays > 7) {
    return {
      state: 'active',
      activeCondition: `${bultos} ${pl(bultos, 'bulto', 'bultos')} en bodega · ${oldestDays} días`,
      activeAction: 'Ver inventario',
    }
  }
  return { state: 'quiet' }
}

// ── Admin Cards ──────────────────────────────────

export function computeEscalationState(
  total: number,
  overdueCount: number,
): CardStateResult {
  if (total === 0) return { state: 'quiet' }
  if (overdueCount > 0) {
    return {
      state: 'urgent',
      urgentCondition: `${overdueCount} ${pl(overdueCount, 'escalación vencida', 'escalaciones vencidas')} (>24h)`,
      urgentAction: 'Resolver ahora',
    }
  }
  return {
    state: 'active',
    activeCondition: `${total} ${pl(total, 'escalación pendiente', 'escalaciones pendientes')}`,
    activeAction: 'Revisar borradores',
  }
}

export function computeQueueState(
  queueLength: number,
): CardStateResult {
  if (queueLength === 0) return { state: 'quiet' }
  return {
    state: 'active',
    activeCondition: `${queueLength} ${pl(queueLength, 'embarque', 'embarques')} sin asignar`,
    activeAction: 'Asignar siguiente',
  }
}

export function computeBridgeState(
  bridges: Array<{ commercial: number | null }>,
): CardStateResult {
  const over90 = bridges.filter(b => (b.commercial ?? 0) > 90).length
  const over60 = bridges.filter(b => (b.commercial ?? 0) > 60).length

  if (over90 > 0) {
    return {
      state: 'urgent',
      urgentCondition: `${over90} ${pl(over90, 'puente', 'puentes')} con más de 90 min de espera`,
      urgentAction: 'Ver cruces',
    }
  }
  if (over60 > 0) {
    return {
      state: 'active',
      activeCondition: `${over60} ${pl(over60, 'puente', 'puentes')} con más de 60 min`,
      activeAction: 'Ver cruces',
    }
  }
  return { state: 'quiet' }
}

// ── Operator Cards ──────────────────────────────────

export function computeBlockedState(
  blockedCount: number,
): CardStateResult {
  if (blockedCount === 0) return { state: 'quiet' }
  return {
    state: 'active',
    activeCondition: `${blockedCount} ${pl(blockedCount, 'embarque bloqueado', 'embarques bloqueados')}`,
    activeAction: 'Ver bloqueados',
  }
}

export function computeMyDayState(
  assigned: number,
  inProgress: number,
): CardStateResult {
  if (assigned === 0 && inProgress === 0) return { state: 'quiet' }
  if (inProgress > 0) {
    return {
      state: 'active',
      activeCondition: `${inProgress} ${pl(inProgress, 'embarque', 'embarques')} en progreso`,
      activeAction: 'Continuar',
    }
  }
  return { state: 'quiet' }
}
