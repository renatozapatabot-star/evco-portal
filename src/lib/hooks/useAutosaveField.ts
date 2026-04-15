'use client'

/**
 * ZAPATA AI · Block 6b — Field-blur autosave hook.
 *
 * Behavior:
 * - `onBlur` → immediate POST to /api/pedimento/{id}/save
 * - `onChange` → 800ms debounced POST
 * - AbortController cancels in-flight on new change
 * - `status` cycles idle → saving → saved (2s) → idle; error on failure
 *
 * The hook is pure client-state; the server action writes to Supabase and
 * returns `updated_at` which the caller surfaces via `<AutosaveIndicator>`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TabId } from '@/lib/pedimento-types'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface UseAutosaveFieldOptions<T> {
  pedimentoId: string
  tab: TabId
  field: string
  initialValue: T
  /** Serialize the in-memory value before POST. Defaults to identity. */
  serializer?: (v: T) => unknown
  /** Fires after every successful save (for Validación panel refresh). */
  onSaved?: () => void
  /** Fires on save error (for telemetry + inline error surfacing). */
  onError?: (message: string) => void
}

export interface UseAutosaveFieldResult<T> {
  value: T
  onChange: (v: T) => void
  onBlur: () => void
  status: AutosaveStatus
  lastSaved: Date | null
  errorMessage?: string
}

const DEBOUNCE_MS = 800
const SAVED_FLASH_MS = 2000

export function useAutosaveField<T>(opts: UseAutosaveFieldOptions<T>): UseAutosaveFieldResult<T> {
  const { pedimentoId, tab, field, initialValue, serializer, onSaved, onError } = opts

  const [value, setValue] = useState<T>(initialValue)
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

  const valueRef = useRef<T>(initialValue)
  valueRef.current = value

  const initialRef = useRef<T>(initialValue)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const doSave = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const current = valueRef.current
    const serialized = serializer ? serializer(current) : current

    setStatus('saving')
    setErrorMessage(undefined)

    try {
      const res = await fetch(`/api/pedimento/${pedimentoId}/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tab, field, value: serialized }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      if (!mountedRef.current) return
      setStatus('saved')
      setLastSaved(new Date())
      onSaved?.()

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
  }, [pedimentoId, tab, field, serializer, onSaved, onError])

  const onChange = useCallback(
    (v: T) => {
      setValue(v)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void doSave()
      }, DEBOUNCE_MS)
    },
    [doSave],
  )

  const onBlur = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    // Skip save if value never changed from initial.
    if (Object.is(valueRef.current, initialRef.current) && lastSaved === null) return
    void doSave()
  }, [doSave, lastSaved])

  return { value, onChange, onBlur, status, lastSaved, errorMessage }
}

// Real `useAutosaveChildRow` lives in ./useAutosaveChildRow.ts — B6c completed.
