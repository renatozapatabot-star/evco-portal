'use client'

import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

export interface AguilaCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type' | 'children'> {
  /** Inline label rendered to the right of the checkbox. */
  label: ReactNode
  /** Optional hint rendered under the label. */
  hint?: ReactNode
  /** Wrapper className. */
  className?: string
}

/**
 * AguilaCheckbox — styled checkbox with a gold checked state and an
 * emerald focus ring. Replaces bare <input type="checkbox"> on forms so
 * every form page reads as the same product.
 */
export const AguilaCheckbox = forwardRef<HTMLInputElement, AguilaCheckboxProps>(
  function AguilaCheckbox(
    { label, hint, className, id: idProp, checked, defaultChecked, disabled, ...inputProps },
    ref,
  ) {
    const autoId = useId()
    const id = idProp ?? autoId
    return (
      <label
        htmlFor={id}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'flex-start',
          gap: 10,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <input
          {...inputProps}
          id={id}
          ref={ref}
          type="checkbox"
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          style={{
            width: 18,
            height: 18,
            marginTop: 2,
            accentColor: 'var(--portal-gold-500)',
            cursor: 'inherit',
            flexShrink: 0,
          }}
        />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 'var(--portal-fs-sm, 13px)', color: 'var(--portal-fg-2)' }}>
            {label}
          </span>
          {hint ? (
            <span
              style={{
                fontSize: 'var(--portal-fs-tiny, 11px)',
                color: 'var(--portal-fg-4)',
                letterSpacing: '0.02em',
              }}
            >
              {hint}
            </span>
          ) : null}
        </span>
      </label>
    )
  },
)
