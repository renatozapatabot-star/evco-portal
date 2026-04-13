import type { PortalRole } from '@/lib/session'

const ALL_CLIENT_ROLES: readonly PortalRole[] = ['admin', 'broker', 'operator', 'contabilidad']
const FINANCE_ROLES: readonly PortalRole[] = ['admin', 'broker', 'contabilidad']
const INTERNAL_ROLES: readonly PortalRole[] = ['admin', 'broker', 'operator', 'contabilidad']

export function isInternal(role: PortalRole): boolean {
  return INTERNAL_ROLES.includes(role)
}

export function canSeeAllClients(role: PortalRole): boolean {
  return ALL_CLIENT_ROLES.includes(role)
}

export function canSeeFinance(role: PortalRole): boolean {
  return FINANCE_ROLES.includes(role)
}

export class AguilaForbiddenError extends Error {
  constructor(public readonly code: string) {
    super(`forbidden:${code}`)
    this.name = 'AguilaForbiddenError'
  }
}
