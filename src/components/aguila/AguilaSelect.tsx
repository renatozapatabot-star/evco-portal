'use client'

import { forwardRef, useId } from 'react'
import type { ReactNode, SelectHTMLAttributes } from 'react'

export interface AguilaSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface AguilaSelectGroup {
  label: string
  options: AguilaSelectOption[]
}

export interface AguilaSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children'> {
  /** Field label above the select. */
  label?: ReactNode
  /** Hint text under the select (hidden when error is present). */
  hint?: ReactNode
  /** Error text — replaces hint, renders red. */
  error?: ReactNode
  /** Show required indicator on the label. */
  required?: boolean
  /** Flat option list — use this OR `groups`. */
  options?: AguilaSelectOption[]
  /** Grouped options (via <optgroup>). */
  groups?: AguilaSelectGroup[]
  /** Optional placeholder rendered as first disabled option. */
  placeholder?: string
  /** Wrapper className. */
  className?: string
}

/**
 * AguilaSelect — styled <select> with the same label + hint + error envelope
 * as <AguilaInput>. Composes `.portal-input` (48px height, focus-glow).
 *
 * Accepts either a flat `options` array or `groups` with nested options.
 * Placeholder renders as a disabled first option when provided + no value
 * is set — standard Spanish ergonomics for "Selecciona una opción".
 */
export const AguilaSelect = forwardRef<HTMLSelectElement, AguilaSelectProps>(
  function AguilaSelect(
    {
      label, hint, error, required,
      options, groups, placeholder,
      className, id: idProp, value, defaultValue,
      ...selectProps
    },
    ref,
  ) {
    const autoId = useId()
    const id = idProp ?? autoId
    const describedByHint = hint ? `${id}-hint` : undefined
    const describedByError = error ? `${id}-error` : undefined
    const noValue = value == null && defaultValue == null

    return (
      <div
        className={className}
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        {label ? (
          <label
            htmlFor={id}
            className="portal-label"
            style={{ display: 'inline-flex', gap: 4, alignItems: 'baseline' }}
          >
            <span>{label}</span>
            {required ? (
              <span
                aria-hidden
                style={{ color: 'var(--portal-red)', fontSize: 11 }}
              >
                *
              </span>
            ) : null}
          </label>
        ) : null}
        <select
          {...selectProps}
          id={id}
          ref={ref}
          required={required}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={[describedByHint, describedByError].filter(Boolean).join(' ') || undefined}
          className="portal-input"
          style={{
            appearance: 'none',
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='rgba(192,197,206,0.7)' stroke-width='1.6'><path d='M4 6l4 4 4-4'/></svg>\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 14px center',
            backgroundSize: '14px 14px',
            paddingRight: 36,
          }}
        >
          {placeholder && noValue ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
          {groups?.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {error ? (
          <span
            id={`${id}-error`}
            role="alert"
            style={{
              fontSize: 'var(--portal-fs-tiny, 11px)',
              color: 'var(--portal-red)',
              letterSpacing: '0.02em',
            }}
          >
            {error}
          </span>
        ) : hint ? (
          <span
            id={`${id}-hint`}
            style={{
              fontSize: 'var(--portal-fs-tiny, 11px)',
              color: 'var(--portal-fg-4)',
              letterSpacing: '0.02em',
            }}
          >
            {hint}
          </span>
        ) : null}
      </div>
    )
  },
)
