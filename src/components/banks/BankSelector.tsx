'use client'

/**
 * AGUILA · Block 11 — Searchable bank selector over the 87-bank catalog.
 *
 * Filter by name OR bank_code. Keyboard nav: ↑↓ Enter Esc. Mono font on
 * codes. 60px min touch target on the trigger. All data inline (no round-trip).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_DIM,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '@/lib/design-system'
import { MEXICAN_BANKS, filterBanks, getBankByCode } from '@/lib/mexican-banks'

const BORDER_SILVER = 'rgba(192,197,206,0.22)'
const BORDER_FOCUS = 'rgba(192,197,206,0.55)'

export interface BankSelectorProps {
  value: string | null
  onChange: (code: string) => void
  onlyPece?: boolean
  disabled?: boolean
  placeholder?: string
  ariaLabel?: string
}

export function BankSelector({
  value,
  onChange,
  onlyPece = false,
  disabled = false,
  placeholder = 'Selecciona banco…',
  ariaLabel = 'Selector de banco',
}: BankSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const results = useMemo(
    () => filterBanks(query, { onlyPece }),
    [query, onlyPece],
  )

  const selected = value ? getBankByCode(value) : null

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    setHighlighted(0)
  }, [open])

  useEffect(() => {
    setHighlighted(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function selectAt(idx: number) {
    const bank = results[idx]
    if (!bank) return
    onChange(bank.bank_code)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, Math.max(0, results.length - 1)))
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
          fontSize: 14,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          textAlign: 'left',
        }}
      >
        {selected ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: ACCENT_SILVER,
              }}
            >
              {selected.bank_code}
            </span>
            <span>{selected.name}</span>
          </span>
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
            maxHeight: 320,
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
              placeholder="Buscar por nombre o clave…"
              aria-label="Buscar banco"
              style={{
                width: '100%',
                minHeight: 44,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.045)',
                color: TEXT_PRIMARY,
                border: `1px solid ${BORDER_SILVER}`,
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
          {results.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: 'center',
                color: TEXT_MUTED,
                fontSize: 13,
              }}
            >
              Sin resultados para “{query}”.
            </div>
          ) : (
            <ul
              role="presentation"
              style={{ listStyle: 'none', margin: 0, padding: 4 }}
            >
              {results.map((bank, idx) => {
                const isHighlighted = idx === highlighted
                const isSelected = bank.bank_code === value
                return (
                  <li key={bank.bank_code}>
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
                        fontSize: 13,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          minWidth: 48,
                          fontFamily: 'var(--font-mono)',
                          color: ACCENT_SILVER,
                        }}
                      >
                        {bank.bank_code}
                      </span>
                      <span style={{ flex: 1 }}>{bank.name}</span>
                      {!bank.accepts_pece && (
                        <span
                          style={{
                            fontSize: 10,
                            color: TEXT_MUTED,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}
                        >
                          Sin PECE
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
              fontSize: 10,
              color: TEXT_MUTED,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {results.length} de {MEXICAN_BANKS.length} bancos · ↑↓ Enter Esc
          </div>
        </div>
      )}
    </div>
  )
}
