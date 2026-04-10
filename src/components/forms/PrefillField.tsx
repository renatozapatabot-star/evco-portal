'use client'

import { useState, useCallback } from 'react'

interface PrefillValue {
  value: string
  confidence: number
  source: string
  reasoning?: string
}

interface Props {
  label: string
  name: string
  prefill?: PrefillValue | null
  type?: string
  placeholder?: string
  required?: boolean
  onChange?: (value: string, source: 'cruz_prefill' | 'operator_corrected') => void
}

/**
 * Form field that renders pre-filled values in gold (CRUZ proposed)
 * and turns white when the operator edits it (corrected).
 *
 * The reviewer thesis applied to forms:
 * Gold = "ADUANA filled this, just confirm"
 * White = "You changed it, CRUZ will learn"
 */
export function PrefillField({ label, name, prefill, type = 'text', placeholder, required, onChange }: Props) {
  const [value, setValue] = useState(prefill?.value || '')
  const [touched, setTouched] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)

  const isPrefilled = !!prefill && !touched
  const textColor = isPrefilled ? '#C9A84C' : '#E6EDF3'
  const borderColor = isPrefilled ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.12)'

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value
    setValue(newVal)
    if (!touched) setTouched(true)
    onChange?.(newVal, newVal === prefill?.value ? 'cruz_prefill' : 'operator_corrected')
  }, [touched, prefill?.value, onChange])

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#8B949E',
        }}>
          {label} {required && <span style={{ color: '#DC2626' }}>*</span>}
        </label>
        {isPrefilled && (
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            style={{
              fontSize: 9, fontWeight: 600, color: '#C9A84C',
              background: 'rgba(201,168,76,0.1)', border: 'none',
              padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}
          >
            {showReasoning ? '✕' : `${Math.round(prefill!.confidence * 100)}% · Ver razón`}
          </button>
        )}
      </div>

      {/* Reasoning tooltip */}
      {showReasoning && prefill && (
        <div style={{
          fontSize: 11, color: '#8B949E', padding: '6px 10px',
          background: 'rgba(201,168,76,0.06)', borderRadius: 6,
          border: '1px solid rgba(201,168,76,0.1)', marginBottom: 6,
          lineHeight: 1.5,
        }}>
          {prefill.reasoning || `Basado en ${prefill.source}`}
        </div>
      )}

      {/* Input */}
      <div style={{ position: 'relative' }}>
        <input
          name={name}
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          style={{
            width: '100%', padding: '12px 14px',
            paddingRight: isPrefilled ? 36 : 14,
            borderRadius: 8,
            background: '#222222',
            border: `1px solid ${borderColor}`,
            color: textColor,
            fontSize: 14,
            fontFamily: type === 'number' || name.includes('rfc') || name.includes('fraccion') || name.includes('pedimento')
              ? 'var(--font-jetbrains-mono)' : 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'color 200ms ease, border-color 200ms ease',
            minHeight: 48,
          }}
        />
        {/* Gold indicator for pre-filled */}
        {isPrefilled && (
          <span style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            fontSize: 12, color: '#C9A84C', pointerEvents: 'none',
          }}>
            ⚡
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * "Confirmar todo" sticky button for pre-filled forms.
 * Shows count of pre-filled fields and submits all at once.
 */
export function ConfirmAllButton({
  prefillCount,
  totalFields,
  onConfirm,
  loading,
}: {
  prefillCount: number
  totalFields: number
  onConfirm: () => void
  loading?: boolean
}) {
  if (prefillCount < 3) return null

  const pct = Math.round((prefillCount / totalFields) * 100)

  return (
    <div style={{
      background: 'rgba(201,168,76,0.08)', borderRadius: 10,
      border: '1px solid rgba(201,168,76,0.2)', padding: '14px 16px',
      marginBottom: 16, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#C9A84C' }}>
          CRUZ pre-llenó {prefillCount} de {totalFields} campos ({pct}%)
        </div>
        <div style={{ fontSize: 11, color: '#8B949E', marginTop: 2 }}>
          Revisa los campos en dorado y confirma si todo es correcto
        </div>
      </div>
      <button
        onClick={onConfirm}
        disabled={loading}
        style={{
          padding: '12px 24px', borderRadius: 8,
          background: '#C9A84C', color: '#111',
          fontSize: 14, fontWeight: 700, border: 'none',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.6 : 1, minHeight: 48,
          flexShrink: 0,
        }}
      >
        {loading ? 'Confirmando...' : 'Confirmar todo →'}
      </button>
    </div>
  )
}
