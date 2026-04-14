'use client'

/**
 * AGUILA · Block 15 — Field primitives for the client config editor.
 *
 * Thin wrappers around <input>/<select>/<textarea> with AGUILA silver
 * styling, 60px desktop touch targets, and onBlur wiring to the section
 * autosave hook. Kept self-contained so each tab file reads cleanly.
 */

import type { ChangeEvent, ReactNode } from 'react'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_DIM,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'

const BORDER_SILVER = 'rgba(192,197,206,0.22)'
const BG_INPUT = 'rgba(255,255,255,0.045)'

export const MONO_STACK = 'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace'

export function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: TEXT_MUTED,
        marginBottom: 6,
      }}
    >
      {children}
      {required && <span style={{ color: ACCENT_SILVER, marginLeft: 4 }}>*</span>}
    </label>
  )
}

interface TextFieldProps {
  label: string
  value: string | undefined | null
  onChange: (next: string) => void
  onBlur?: () => void
  placeholder?: string
  required?: boolean
  mono?: boolean
  type?: 'text' | 'email' | 'url' | 'tel'
  disabled?: boolean
  autoComplete?: string
  maxLength?: number
}

export function TextField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  required,
  mono,
  type = 'text',
  disabled,
  autoComplete,
  maxLength,
}: TextFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Label required={required}>{label}</Label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        maxLength={maxLength}
        style={{
          minHeight: 60,
          padding: '0 14px',
          background: BG_INPUT,
          border: `1px solid ${BORDER_SILVER}`,
          borderRadius: 10,
          color: TEXT_PRIMARY,
          fontSize: 14,
          fontFamily: mono ? MONO_STACK : 'inherit',
          outline: 'none',
        }}
      />
    </div>
  )
}

interface NumberFieldProps {
  label: string
  value: number | undefined | null
  onChange: (next: number | undefined) => void
  onBlur?: () => void
  required?: boolean
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}

export function NumberField({
  label,
  value,
  onChange,
  onBlur,
  required,
  min,
  max,
  step,
  disabled,
}: NumberFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Label required={required}>{label}</Label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const v = e.target.value
          onChange(v === '' ? undefined : Number(v))
        }}
        onBlur={onBlur}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        style={{
          minHeight: 60,
          padding: '0 14px',
          background: BG_INPUT,
          border: `1px solid ${BORDER_SILVER}`,
          borderRadius: 10,
          color: TEXT_PRIMARY,
          fontSize: 14,
          fontFamily: MONO_STACK,
          outline: 'none',
        }}
      />
    </div>
  )
}

interface SelectFieldProps<T extends string> {
  label: string
  value: T | undefined | null
  onChange: (next: T | undefined) => void
  onBlur?: () => void
  options: readonly { value: T; label: string }[]
  required?: boolean
  placeholder?: string
  disabled?: boolean
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  onBlur,
  options,
  required,
  placeholder,
  disabled,
}: SelectFieldProps<T>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Label required={required}>{label}</Label>
      <select
        value={value ?? ''}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
          const v = e.target.value
          onChange(v === '' ? undefined : (v as T))
        }}
        onBlur={onBlur}
        disabled={disabled}
        style={{
          minHeight: 60,
          padding: '0 14px',
          background: BG_INPUT,
          border: `1px solid ${BORDER_SILVER}`,
          borderRadius: 10,
          color: TEXT_PRIMARY,
          fontSize: 14,
          outline: 'none',
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface TextAreaFieldProps {
  label: string
  value: string | undefined | null
  onChange: (next: string) => void
  onBlur?: () => void
  placeholder?: string
  rows?: number
  disabled?: boolean
}

export function TextAreaField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  rows = 6,
  disabled,
}: TextAreaFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Label>{label}</Label>
      <textarea
        value={value ?? ''}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        style={{
          padding: 14,
          background: BG_INPUT,
          border: `1px solid ${BORDER_SILVER}`,
          borderRadius: 10,
          color: TEXT_PRIMARY,
          fontSize: 14,
          lineHeight: 1.5,
          resize: 'vertical',
          outline: 'none',
        }}
      />
    </div>
  )
}

export function FieldGrid({ children, columns = 2 }: { children: ReactNode; columns?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 14,
      }}
      className="aguila-field-grid"
    >
      {children}
      <style>{`
        @media (max-width: 640px) {
          .aguila-field-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

interface ActionButtonProps {
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  variant?: 'primary' | 'danger' | 'ghost'
  type?: 'button' | 'submit'
}

export function ActionButton({
  onClick,
  children,
  disabled,
  variant = 'primary',
  type = 'button',
}: ActionButtonProps) {
  const palette: Record<string, { bg: string; color: string; border: string }> = {
    primary: {
      bg: 'rgba(192,197,206,0.12)',
      color: ACCENT_SILVER,
      border: BORDER_SILVER,
    },
    danger: {
      bg: 'rgba(239,68,68,0.12)',
      color: '#fca5a5',
      border: 'rgba(239,68,68,0.35)',
    },
    ghost: {
      bg: 'transparent',
      color: ACCENT_SILVER_DIM,
      border: BORDER_SILVER,
    },
  }
  const { bg, color, border } = palette[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 60,
        padding: '0 16px',
        fontSize: 13,
        fontWeight: 600,
        color,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {children}
    </button>
  )
}

export function RowCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        background: 'rgba(255,255,255,0.045)',
        border: `1px solid ${BORDER_SILVER}`,
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {children}
    </div>
  )
}
