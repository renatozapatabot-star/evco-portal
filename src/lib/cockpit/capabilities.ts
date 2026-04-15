import { ClipboardCheck, ScanLine, AtSign } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type CapabilityKey = 'checklist' | 'clasificador' | 'mensajes'

export interface CapabilityCardDef {
  key: CapabilityKey
  href: string
  label: string
  subtitle: string
  icon: LucideIcon
}

/**
 * ZAPATA AI v10 — three capability cards shown on every role cockpit,
 * between the 6 nav cards and the main estado grid. Actions, not
 * destinations — distinct semantics from UNIFIED_NAV_TILES.
 *
 * Hrefs are flat (role-scoping happens inside the target page by
 * reading the session). Middleware already gates by role.
 */
export const CAPABILITY_CARDS: readonly CapabilityCardDef[] = [
  { key: 'checklist',    href: '/checklist',    icon: ClipboardCheck, label: 'Checklist Documental', subtitle: '61 tipos · auto-validado' },
  { key: 'clasificador', href: '/clasificador', icon: ScanLine,       label: 'Clasificador',         subtitle: 'Sube · auto-clasifica · TIGIE' },
  { key: 'mensajes',     href: '/mensajeria',   icon: AtSign,         label: 'Chat',                 subtitle: '@ menciona a tu equipo' },
] as const

export interface CapabilityCell {
  count: number | null
  countSuffix?: string
  microStatus?: string
  microStatusWarning?: boolean
}

export type CapabilityCounts = Record<CapabilityKey, CapabilityCell>

export const EMPTY_CAPABILITY_COUNTS: CapabilityCounts = {
  checklist:    { count: null },
  clasificador: { count: null },
  mensajes:     { count: null },
}
