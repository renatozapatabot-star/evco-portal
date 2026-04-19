'use client'

/**
 * Inline autosave status for the config editor. Mirrors the pedimento
 * `<AutosaveIndicator>` but keyed off `useAutosaveJsonField`'s status enum.
 */

import type { AutosaveJsonStatus } from '@/lib/hooks/useAutosaveJsonField'
import { ACCENT_SILVER, ACCENT_SILVER_DIM, TEXT_MUTED } from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'

export interface SectionAutosaveBadgeProps {
  status: AutosaveJsonStatus
  lastSaved: Date | null
  errorMessage?: string
}

export function SectionAutosaveBadge({ status, lastSaved, errorMessage }: SectionAutosaveBadgeProps) {
  let label = 'Sin cambios'
  let color: string = TEXT_MUTED
  if (status === 'saving') {
    label = 'Guardando…'
    color = ACCENT_SILVER_DIM
  } else if (status === 'saved') {
    label = 'Guardado'
    color = ACCENT_SILVER
  } else if (status === 'error') {
    label = errorMessage ? `Error: ${errorMessage}` : 'Error al guardar'
    color = 'var(--portal-status-red-fg)'
  } else if (lastSaved) {
    label = `Actualizado ${fmtDateTime(lastSaved.toISOString())}`
  }
  return (
    <span
      role="status"
      aria-live="polite"
      style={{ fontSize: 'var(--aguila-fs-meta)', letterSpacing: '0.04em', color, whiteSpace: 'nowrap' }}
    >
      {label}
    </span>
  )
}
