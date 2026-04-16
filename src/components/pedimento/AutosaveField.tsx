'use client'

/**
 * CRUZ · Block 6b — Labeled autosave input used by the pedimento tabs.
 * Wraps `useAutosaveField` + `<AutosaveIndicator>` + inline validation error.
 *
 * Supports input, textarea, select variants. Mono font for numeric/monospace
 * fields (pedimento, patente, aduana, RFC, exchange_rate, signatures).
 */

import { useId } from 'react'
import type { TabId } from '@/lib/pedimento-types'
import { useAutosaveField } from '@/lib/hooks/useAutosaveField'
import { AutosaveIndicator } from './AutosaveIndicator'

const RED = '#EF4444'
const BORDER_SILVER = 'rgba(192,197,206,0.22)'
const BORDER_FOCUS = 'rgba(192,197,206,0.55)'

type Variant = 'input' | 'textarea' | 'select'

export interface AutosaveFieldProps {
  pedimentoId: string
  tab: TabId
  field: string
  label: string
  initialValue: string
  variant?: Variant
  mono?: boolean
  placeholder?: string
  helpText?: string
  /** Validation error message from the engine for this field. */
  validationError?: string
  /** Options for select variant. */
  options?: readonly { code: string; label: string }[]
  /** Optional min width override. */
  minWidth?: number
  /** Coerce empty strings to null on save. */
  nullableString?: boolean
  /** Parse value as number before save. */
  numeric?: boolean
  onFocus?: () => void
  onSaved?: () => void
  onError?: (msg: string) => void
}

export function AutosaveField(props: AutosaveFieldProps) {
  const {
    pedimentoId, tab, field, label, initialValue, variant = 'input',
    mono, placeholder, helpText, validationError, options, minWidth,
    nullableString, numeric, onFocus, onSaved, onError,
  } = props
  const id = useId()

  const serializer = (v: string): unknown => {
    if (numeric) {
      const n = Number.parseFloat(v)
      return Number.isFinite(n) ? n : null
    }
    if (nullableString) return v.trim().length === 0 ? null : v
    return v
  }

  const { value, onChange, onBlur, status, lastSaved, errorMessage } =
    useAutosaveField<string>({
      pedimentoId, tab, field, initialValue, serializer,
      onSaved, onError,
    })

  const borderColor = validationError ? RED : BORDER_SILVER
  const commonInputStyle: React.CSSProperties = {
    minHeight: 60,
    padding: '10px 12px',
    width: '100%',
    minWidth,
    background: 'rgba(255,255,255,0.045)',
    color: 'var(--text-primary)',
    border: `1px solid ${borderColor}`,
    borderRadius: 10,
    fontSize: 'var(--aguila-fs-section)',
    fontFamily: mono ? 'var(--font-mono)' : 'inherit',
    outline: 'none',
  }

  const handleFocus = () => onFocus?.()
  const handleKey = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = validationError ? RED : BORDER_FOCUS
  }
  const handleBlurStyle = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = validationError ? RED : BORDER_SILVER
    onBlur()
  }

  return (
    <div id={`field-${field}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, scrollMarginTop: 120 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <label
          htmlFor={id}
          style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          {label}
        </label>
        <div style={{ flex: 1 }} />
        <AutosaveIndicator status={status} lastSaved={lastSaved} errorMessage={errorMessage} />
      </div>

      {variant === 'textarea' && (
        <textarea
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => { handleFocus(); handleKey(e) }}
          onBlur={handleBlurStyle}
          style={{ ...commonInputStyle, minHeight: 120, resize: 'vertical', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}
        />
      )}
      {variant === 'input' && (
        <input
          id={id}
          type={numeric ? 'number' : 'text'}
          step={numeric ? 'any' : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => { handleFocus(); handleKey(e) }}
          onBlur={handleBlurStyle}
          style={commonInputStyle}
        />
      )}
      {variant === 'select' && (
        <select
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            // Selects don't fire blur reliably after change; save immediately.
            setTimeout(onBlur, 0)
          }}
          onFocus={(e) => { handleFocus(); handleKey(e) }}
          onBlur={handleBlurStyle}
          style={commonInputStyle}
        >
          <option value="">— Selecciona —</option>
          {(options ?? []).map((o) => (
            <option key={o.code} value={o.code}>{o.label}</option>
          ))}
        </select>
      )}

      {validationError && (
        <div role="alert" style={{ fontSize: 'var(--aguila-fs-meta)', color: RED }}>
          {validationError}
        </div>
      )}
      {!validationError && helpText && (
        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)' }}>{helpText}</div>
      )}
    </div>
  )
}
