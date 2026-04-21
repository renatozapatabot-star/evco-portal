'use client'

/**
 * CRUZ · Block 12 — Type-ahead carrier selector over the master catalog.
 *
 * 150ms debounce, top 5 results from `/api/carriers/search`, keyboard nav
 * (↑↓ Enter Esc), MRU cache keyed by operator + carrier_type surfaces at
 * the top when the query is empty. Mono font on SCT permit, sentence case
 * on name. 60px min touch target.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check, Clock } from 'lucide-react'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_DIM,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '@/lib/design-system'
import {
  type CarrierSearchResult,
  type CarrierType,
  mergeMruAndResults,
  searchCarriers,
} from '@/lib/carriers'
import { readMru, writeMru } from '@/lib/carrier-mru'

const BORDER_SILVER = 'rgba(192,197,206,0.22)'
const BORDER_FOCUS = 'rgba(192,197,206,0.55)'
const DEBOUNCE_MS = 150

export interface CarrierSelectorProps {
  value: { id: string; name: string } | null
  onChange: (carrier: CarrierSearchResult) => void
  carrierType: CarrierType
  operatorId: string
  onlyActive?: boolean
  disabled?: boolean
  placeholder?: string
  ariaLabel?: string
}

export function CarrierSelector({
  value,
  onChange,
  carrierType,
  operatorId,
  onlyActive = true,
  disabled = false,
  placeholder = 'Buscar transportista…',
  ariaLabel = 'Selector de transportista',
}: CarrierSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CarrierSearchResult[]>([])
  const [highlighted, setHighlighted] = useState(0)
  const [mru, setMru] = useState<import('@/lib/carriers').MruEntry[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) return
    setMru(readMru(operatorId, carrierType))
    inputRef.current?.focus()
    setHighlighted(0)
  }, [open, operatorId, carrierType])

  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      void (async () => {
        const res = await searchCarriers(
          { q: query, type: carrierType, limit: 5 },
          (input, init) =>
            fetch(input, { ...init, signal: ctrl.signal }).catch(() => {
              // Abort / network: return empty shape via Response fallback.
              return new Response(JSON.stringify({ data: [] }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              })
            }),
        )
        if (!ctrl.signal.aborted) setResults(res)
      })()
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [query, carrierType, open, onlyActive])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const displayed = useMemo(
    () => (query.trim() === '' ? mergeMruAndResults(mru, results) : results),
    [query, mru, results],
  )

  function selectAt(idx: number) {
    const carrier = displayed[idx]
    if (!carrier) return
    writeMru(operatorId, carrierType, carrier)
    onChange(carrier)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, Math.max(0, displayed.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectAt(highlighted)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const mruCount = query.trim() === '' ? mru.length : 0

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          minHeight: 60,
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.045)',
          color: TEXT_PRIMARY,
          border: `1px solid ${open ? BORDER_FOCUS : BORDER_SILVER}`,
          borderRadius: 10,
          fontSize: 'var(--aguila-fs-section)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          textAlign: 'left',
        }}
      >
        {value ? (
          <span>{value.name}</span>
        ) : (
          <span style={{ color: TEXT_MUTED }}>{placeholder}</span>
        )}
        <ChevronDown size={16} color={ACCENT_SILVER_DIM} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 50,
            maxHeight: 360,
            overflowY: 'auto',
            background: 'rgba(255,255,255,0.045)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${BORDER_SILVER}`,
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ padding: 10, borderBottom: `1px solid ${BORDER_SILVER}` }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar por nombre o alias…"
              aria-label="Buscar transportista"
              style={{
                width: '100%',
                minHeight: 44,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.045)',
                color: TEXT_PRIMARY,
                border: `1px solid ${BORDER_SILVER}`,
                borderRadius: 8,
                fontSize: 'var(--aguila-fs-section)',
                outline: 'none',
              }}
            />
          </div>
          {displayed.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: 'center',
                color: TEXT_MUTED,
                fontSize: 'var(--aguila-fs-body)',
              }}
            >
              {query
                ? `Sin resultados para "${query}".`
                : 'Escribe para buscar transportistas.'}
            </div>
          ) : (
            <ul
              role="presentation"
              style={{ listStyle: 'none', margin: 0, padding: 4 }}
            >
              {displayed.map((carrier, idx) => {
                const isHighlighted = idx === highlighted
                const isSelected = carrier.id === value?.id
                const isRecent = idx < mruCount
                return (
                  <li key={carrier.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlighted(idx)}
                      onClick={() => selectAt(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        minHeight: 44,
                        padding: '8px 12px',
                        background: isHighlighted
                          ? 'rgba(192,197,206,0.12)'
                          : 'transparent',
                        color: TEXT_PRIMARY,
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 'var(--aguila-fs-body)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {isRecent && (
                        <Clock size={12} color={ACCENT_SILVER_DIM} aria-label="Reciente" />
                      )}
                      <span style={{ flex: 1 }}>{carrier.name}</span>
                      {carrier.sct_permit && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--aguila-fs-meta)',
                            color: ACCENT_SILVER,
                          }}
                        >
                          {carrier.sct_permit}
                        </span>
                      )}
                      {isSelected && <Check size={14} color={ACCENT_SILVER} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <div
            style={{
              padding: '6px 12px',
              borderTop: `1px solid ${BORDER_SILVER}`,
              fontSize: 'var(--aguila-fs-label)',
              color: TEXT_MUTED,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {displayed.length} resultados · ↑↓ Enter Esc
          </div>
        </div>
      )}
    </div>
  )
}
