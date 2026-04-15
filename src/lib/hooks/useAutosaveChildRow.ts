'use client'

/**
 * ZAPATA AI · Block 6c — Child-row autosave hook.
 *
 * Same debounce + AbortController pattern as `useAutosaveField`, scoped to a
 * single row in a pedimento child table (e.g. `pedimento_destinatarios`).
 *
 * Behavior:
 * - `saveField(field, value)` → debounced 800ms POST to
 *   `/api/pedimento/[pedimentoId]/child` with `{ table, rowId, field, value }`
 * - `flush()` → cancels debounce and fires immediate save (onBlur)
 * - AbortController cancels in-flight on new save
 * - Status cycles idle → saving → saved (2s) → idle; error on failure
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChildTable } from '@/lib/pedimento-types'
import type { AutosaveStatus } from '@/lib/hooks/useAutosaveField'

export interface UseAutosaveChildRowOptions {
  pedimentoId: string
  table: ChildTable
  rowId: string
  onSaved?: () => void
  onError?: (message: string) => void
}

export interface UseAutosaveChildRowResult {
  status: AutosaveStatus
  lastSaved: Date | null
  errorMessage?: string
  /** Debounced save on change. */
  saveField: (field: string, value: unknown) => void
  /** Immediate save on blur. */
  flush: (field: string, value: unknown) => void
}

const DEBOUNCE_MS = 800
const SAVED_FLASH_MS = 2000

export function useAutosaveChildRow(
  opts: UseAutosaveChildRowOptions,
): UseAutosaveChildRowResult {
  const { pedimentoId, table, rowId, onSaved, onError } = opts

  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

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

  const doSave = useCallback(
    async (field: string, value: unknown) => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setStatus('saving')
      setErrorMessage(undefined)

      try {
        const res = await fetch(`/api/pedimento/${pedimentoId}/child`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op: 'update', table, rowId, field, value }),
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
    },
    [pedimentoId, table, rowId, onSaved, onError],
  )

  const saveField = useCallback(
    (field: string, value: unknown) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void doSave(field, value)
      }, DEBOUNCE_MS)
    },
    [doSave],
  )

  const flush = useCallback(
    (field: string, value: unknown) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      void doSave(field, value)
    },
    [doSave],
  )

  return { status, lastSaved, errorMessage, saveField, flush }
}
