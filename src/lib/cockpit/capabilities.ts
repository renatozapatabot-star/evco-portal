import { ClipboardCheck, ScanLine } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Removed 'mensajes' card 2026-04-15 per Tito audit — Chat surface wasn't
// functional and the floating Asistente AI button covers that intent.
// Capability row now feels more substantial as a 2-card layout with each
// card given more visual weight.
export type CapabilityKey = 'checklist' | 'clasificador'

export interface CapabilityCardDef {
  key: CapabilityKey
  href: string
  label: string
  subtitle: string
  icon: LucideIcon
}

/**
 * CRUZ v10 — capability cards shown on every role cockpit, between
 * the 6 nav cards and the main estado grid. Actions, not destinations.
 *
 * Hrefs are flat (role-scoping happens inside the target page by
 * reading the session). Middleware already gates by role.
 */
export const CAPABILITY_CARDS: readonly CapabilityCardDef[] = [
  { key: 'checklist',    href: '/checklist',    icon: ClipboardCheck, label: 'Checklist Documental', subtitle: '61 tipos · auto-validado' },
  { key: 'clasificador', href: '/clasificador', icon: ScanLine,       label: 'Clasificador',         subtitle: 'Sube · auto-clasifica · TIGIE' },
] as const

export interface CapabilityCell {
  count: number | null
  countSuffix?: string
  microStatus?: string
  microStatusWarning?: boolean
}

/**
 * Counts for capability cards. Each key is optional so surfaces can opt
 * out of specific cards — CapabilityCardGrid hides any card whose key
 * isn't present in the counts map (per 2026-04-15 operator audit: the
 * operator cockpit drops the Clasificador card entirely; Clasificación
 * now lives only on the Asistente/Clasificador fab).
 */
export type CapabilityCounts = Partial<Record<CapabilityKey, CapabilityCell>>

export const EMPTY_CAPABILITY_COUNTS: CapabilityCounts = {
  checklist:    { count: null },
  clasificador: { count: null },
}
