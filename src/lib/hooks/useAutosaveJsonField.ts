'use client'

/**
 * ZAPATA AI · Block 15 — JSONB section autosave hook.
 *
 * Unlike `useAutosaveField` (scoped to a single scalar inside a pedimento tab),
 * this hook saves an entire JSONB section column on `companies` atomically.
 * A section is either an object (`general`, `fiscal`, …) or an array
 * (`direcciones`, `contactos`, …).
 *
 * Behavior:
 * - Caller mutates in-memory value via `setValue(next)` → 800ms debounced POST
 *   to `/api/clientes/:id/config/save-section`.
 * - `flush()` forces immediate save (used on blur / tab switch).
 * - AbortController cancels in-flight on new change.
 * - Status cycles idle → saving → saved (2s) → idle; error on failure.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientConfigSectionId } from '@/lib/client-config-schema'

export type AutosaveJsonStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface UseAutosaveJsonFieldOptions<T> {
  companyId: string
  section: ClientConfigSectionId
  initialValue: T
  /** Called after every successful save (for completeness refresh). */
  onSaved?: (saved: T) => void
  /** Called on save error. */
  onError?: (message: string) => void
  /** Debounce window for change-triggered saves. Defaults to 800ms. */
  debounceMs?: number
}

export interface UseAutosaveJsonFieldResult<T> {
  value: T
  setValue: (next: T) => void
  flush: () => void
  status: AutosaveJsonStatus
  lastSaved: Date | null
  errorMessage?: string
}

const DEFAULT_DEBOUNCE_MS = 800
const SAVED_FLASH_MS = 2000

export function useAutosaveJsonField<T>(
  opts: UseAutosaveJsonFieldOptions<T>,
): UseAutosaveJsonFieldResult<T> {
  const { companyId, section, initialValue, onSaved, onError, debounceMs = DEFAULT_DEBOUNCE_MS } = opts

  const [value, setValueState] = useState<T>(initialValue)
  const [status, setStatus] = useState<AutosaveJsonStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

  const valueRef = useRef<T>(initialValue)
  valueRef.current = value

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const dirtyRef = useRef(false)

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const doSave = useCallback(async () => {
    if (!dirtyRef.current) return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const snapshot = valueRef.current

    setStatus('saving')
    setErrorMessage(undefined)

    try {
      const res = await fetch(`/api/clientes/${companyId}/config/save-section`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ section, value: snapshot }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      if (!mountedRef.current) return
      dirtyRef.current = false
      setStatus('saved')
      setLastSaved(new Date())
      onSaved?.(snapshot)

      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setStatus('idle')
      }, SAVED_FLASH_MS)
    } catch (e) {
      if (controller.signal.aborted) return
      if (!mountedRef.current) return
      const msg = e instanceof Error ? e.message : 'Error al guardar'
      setStatus('error')
      setErrorMessage(msg)
      onError?.(msg)
    }
  }, [companyId, section, onSaved, onError])

  const setValue = useCallback(
    (next: T) => {
      setValueState(next)
      dirtyRef.current = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void doSave()
      }, debounceMs)
    },
    [doSave, debounceMs],
  )

  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (!dirtyRef.current) return
    void doSave()
  }, [doSave])

  return { value, setValue, flush, status, lastSaved, errorMessage }
}
