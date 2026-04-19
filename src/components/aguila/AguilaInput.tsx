'use client'

import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

export interface AguilaInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  /** Field label rendered above the input. */
  label?: ReactNode
  /** Small hint rendered under the input when error is absent. */
  hint?: ReactNode
  /** Error message — renders in red + amber-less tone, replaces hint. */
  error?: ReactNode
  /** Show required indicator on the label. */
  required?: boolean
  /** Switch to mono font (for pedimento/fracción/ID inputs). */
  mono?: boolean
  /** Additional input className. */
  inputClassName?: string
  /** Wrapper className. */
  className?: string
}

/**
 * AguilaInput — label + hint + error envelope over <PortalInput>.
 *
 * Ship pattern: a form field is always label + input + (hint | error).
 * Inlining that composition inside every form page drifts three small
 * decisions (spacing, required indicator, error styling) in every page.
 * This primitive locks all three.
 *
 * Use `mono` for customs identifiers (pedimento, fracción, clave) so the
 * value reads as data, not sentence.
 */
export const AguilaInput = forwardRef<HTMLInputElement, AguilaInputProps>(
  function AguilaInput(
    { label, hint, error, required, mono, className, inputClassName, id: idProp, ...inputProps },
    ref,
  ) {
    const autoId = useId()
    const id = idProp ?? autoId
    const describedByHint = hint ? `${id}-hint` : undefined
    const describedByError = error ? `${id}-error` : undefined
    const inputClasses = ['portal-input', inputClassName, mono ? 'portal-num' : null]
      .filter(Boolean)
      .join(' ')

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
        <input
          {...inputProps}
          id={id}
          ref={ref}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={[describedByHint, describedByError]
            .filter(Boolean)
            .join(' ') || undefined}
          className={inputClasses}
        />
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
