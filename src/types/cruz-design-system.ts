/**
 * CRUZ Design System v1.0 — TypeScript Interfaces
 * Renato Zapata & Company · Patente 3596 · Est. 1941
 */

export type TraficoStatus = 'pendiente' | 'en_proceso' | 'cruzado' | 'detenido'

export type UrgencyLevel = 'critical' | 'urgent' | 'normal' | 'complete'

export type CRUZTheme = 'light' | 'dark' | 'system'

export type CRUZLocale = 'es' | 'en'

export interface StatusBadgeProps {
  status: TraficoStatus
  label?: string
}

export interface StatBarItem {
  key: string
  label: string
  value: number
  isDanger?: boolean
  isActive?: boolean
  onClick?: () => void
}

export interface DocCompletionProps {
  count: number
  total?: number
}

export interface PedimentoBadgeProps {
  pedimento: string
  onClick?: () => void
}

export interface UrgencyBorderProps {
  level: UrgencyLevel
}

export interface ThemeConfig {
  theme: CRUZTheme
  setTheme: (theme: CRUZTheme) => void
}

/** Maps TraficoStatus to CSS class name for status-badge */
export const STATUS_CLASS_MAP: Record<TraficoStatus, string> = {
  pendiente: 'pendiente',
  en_proceso: 'en-proceso',
  cruzado: 'cruzado',
  detenido: 'detenido',
}

/** Maps status to display label (Spanish) */
export const STATUS_LABEL_ES: Record<TraficoStatus, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En Proceso',
  cruzado: 'Cruzado',
  detenido: 'Detenido',
}

/** Maps status to display label (English) */
export const STATUS_LABEL_EN: Record<TraficoStatus, string> = {
  pendiente: 'Pending',
  en_proceso: 'In Process',
  cruzado: 'Cleared',
  detenido: 'Held',
}

/** Color tokens for semantic use */
export interface SemanticColor {
  base: string
  muted: string
  border: string
}

export const SEMANTIC_COLORS: Record<'success' | 'warning' | 'danger' | 'info', SemanticColor> = {
  success: { base: 'var(--color-success)', muted: 'var(--color-success-muted)', border: 'rgba(16,185,129,0.20)' },
  warning: { base: 'var(--color-warning)', muted: 'var(--color-warning-muted)', border: 'rgba(245,158,11,0.20)' },
  danger:  { base: 'var(--color-danger)',  muted: 'var(--color-danger-muted)',  border: 'rgba(239,68,68,0.20)' },
  info:    { base: 'var(--color-info)',    muted: 'var(--color-info-muted)',    border: 'rgba(99,102,241,0.20)' },
}
