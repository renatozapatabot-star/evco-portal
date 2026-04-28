'use client'

import { forwardRef, useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export interface AguilaPasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> {
  /** Field label rendered above the input. */
  label?: ReactNode
  /** Small hint rendered under the input when error is absent. */
  hint?: ReactNode
  /** Error message — renders in red, replaces hint. */
  error?: ReactNode
  /** Show required indicator on the label. */
  required?: boolean
  /** Additional input className. */
  inputClassName?: string
  /** Wrapper className. */
  className?: string
}

/**
 * AguilaPasswordInput — label + input + eye-toggle envelope over
 * .portal-input chemistry. Mirrors AguilaInput's contract but ships
 * a show/hide button on the right side.
 *
 * Button is positioned absolutely inside the input wrapper so the
 * toggle target never shifts when the visibility changes. 60px
 * touch target per the 3 AM Driver standard.
 *
 * aria-label on the toggle ("Mostrar" / "Ocultar") localizes the
 * icon for screen readers.
 */
export const AguilaPasswordInput = forwardRef<HTMLInputElement, AguilaPasswordInputProps>(
  function AguilaPasswordInput(
    { label, hint, error, required, className, inputClassName, id: idProp, ...inputProps },
    ref,
  ) {
    const autoId = useId()
    const id = idProp ?? autoId
    const [visible, setVisible] = useState(false)
    const describedByHint = hint ? `${id}-hint` : undefined
    const describedByError = error ? `${id}-error` : undefined
    const inputClasses = ['portal-input', inputClassName].filter(Boolean).join(' ')

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
        <div style={{ position: 'relative' }}>
          <input
            {...inputProps}
            id={id}
            ref={ref}
            type={visible ? 'text' : 'password'}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={[describedByHint, describedByError]
              .filter(Boolean)
              .join(' ') || undefined}
            className={inputClasses}
            style={{ paddingRight: 52 }}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={visible}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              minWidth: 44,
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--portal-fg-4)',
            }}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
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
