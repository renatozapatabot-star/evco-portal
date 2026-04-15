'use client'

/**
 * ZAPATA AI · Block 6b — Shared pedimento context.
 * Exposes live validation state + refresh trigger so every tab can surface
 * inline errors and the right rail can re-read after each autosave.
 */

import { createContext, useContext } from 'react'
import type { ValidationError } from '@/lib/pedimento-types'

export interface PedimentoContextValue {
  pedimentoId: string
  traficoId: string
  companyId: string
  /** Latest validation errors grouped nowhere; components filter by tab+field. */
  validationErrors: ValidationError[]
  errorsCount: number
  warningsCount: number
  /** Caller invokes after each autosave; context debounces the API call. */
  requestValidation: () => void
  /** Jump to a tab and scroll-focus the field (used by RightRail). */
  focusField: (tab: string, field: string) => void
}

export const PedimentoContext = createContext<PedimentoContextValue | null>(null)

export function usePedimento(): PedimentoContextValue {
  const ctx = useContext(PedimentoContext)
  if (!ctx) throw new Error('usePedimento must be used inside <PedimentoContext.Provider>')
  return ctx
}

/** Find the engine error for a given (tab, field). */
export function errorFor(
  errors: ValidationError[],
  tab: string,
  field: string,
): ValidationError | undefined {
  return errors.find((e) => e.tab === tab && e.field === field)
}
