'use client'

import { useState, useCallback } from 'react'

interface FraccionInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * Auto-formatting fracción arancelaria input.
 * Formats "39074001" → "3907.40.01" as user types.
 * Validates XXXX.XX.XX format.
 */
export function FraccionInput({ value, onChange, placeholder = '3907.40.01', className }: FraccionInputProps) {
  const [error, setError] = useState<string | null>(null)

  const formatFraccion = useCallback((raw: string) => {
    // Strip non-digits
    const digits = raw.replace(/[^\d]/g, '')

    // Auto-insert dots: XXXX.XX.XX
    let formatted = digits
    if (digits.length > 4) formatted = digits.slice(0, 4) + '.' + digits.slice(4)
    if (digits.length > 6) formatted = digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6, 8)

    return formatted.slice(0, 10) // max "XXXX.XX.XX"
  }, [])

  const validate = useCallback((val: string) => {
    if (!val) { setError(null); return }
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(val)) {
      setError(null)
    } else {
      setError('Formato: XXXX.XX.XX')
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatFraccion(e.target.value)
    onChange(formatted)
    validate(formatted)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={10}
        className={className}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          background: 'rgba(9,9,11,0.75)',
          border: `1.5px solid ${error ? '#EF4444' : 'rgba(192,197,206,0.3)'}`,
          color: '#E6EDF3',
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          fontWeight: 700,
          outline: 'none',
          transition: 'border-color 150ms',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = error ? '#EF4444' : 'rgba(192,197,206,0.5)'; e.currentTarget.style.boxShadow = `0 0 12px ${error ? 'rgba(239,68,68,0.2)' : 'rgba(192,197,206,0.2)'}` }}
        onBlur={e => { e.currentTarget.style.borderColor = error ? '#EF4444' : 'rgba(192,197,206,0.3)'; e.currentTarget.style.boxShadow = 'none' }}
      />
      {error && (
        <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{error}</div>
      )}
    </div>
  )
}
