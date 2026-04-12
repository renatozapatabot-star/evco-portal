'use client'

/**
 * AGUILA · Block 6b — Inline autosave status badge.
 * Three states: saving, saved (with timestamp), error. Silver palette +
 * red for errors. Tiny, mono for timestamp, 11px to sit next to form fields.
 */

import { fmtDateTime } from '@/lib/format-utils'
import { ACCENT_SILVER_DIM, ACCENT_SILVER } from '@/lib/design-system'
import type { AutosaveStatus } from '@/lib/hooks/useAutosaveField'

const RED = '#EF4444'

export interface AutosaveIndicatorProps {
  status: AutosaveStatus
  lastSaved: Date | null
  errorMessage?: string
}

export function AutosaveIndicator({ status, lastSaved, errorMessage }: AutosaveIndicatorProps) {
  if (status === 'saving') {
    return (
      <span
        role="status"
        aria-live="polite"
        style={{ fontSize: 11, color: ACCENT_SILVER_DIM, fontFamily: 'var(--font-mono)' }}
      >
        Guardando…
      </span>
    )
  }
  if (status === 'saved' && lastSaved) {
    return (
      <span
        role="status"
        aria-live="polite"
        style={{ fontSize: 11, color: ACCENT_SILVER, fontFamily: 'var(--font-mono)' }}
      >
        Guardado · {fmtDateTime(lastSaved)}
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span
        role="alert"
        title={errorMessage ?? 'Error al guardar'}
        style={{ fontSize: 11, color: RED, fontFamily: 'var(--font-mono)' }}
      >
        Error
      </span>
    )
  }
  if (lastSaved) {
    return (
      <span style={{ fontSize: 11, color: ACCENT_SILVER_DIM, fontFamily: 'var(--font-mono)' }}>
        Guardado · {fmtDateTime(lastSaved)}
      </span>
    )
  }
  return null
}
