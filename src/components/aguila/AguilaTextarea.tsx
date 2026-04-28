'use client'

import { forwardRef, useId } from 'react'
import type { TextareaHTMLAttributes, ReactNode } from 'react'

export interface AguilaTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  /** Field label rendered above the textarea. */
  label?: ReactNode
  /** Small hint rendered under the textarea when error is absent. */
  hint?: ReactNode
  /** Error message — renders in red, replaces hint. */
  error?: ReactNode
  /** Show required indicator on the label. */
  required?: boolean
  /** Additional textarea className. */
  textareaClassName?: string
  /** Wrapper className. */
  className?: string
}

/**
 * AguilaTextarea — label + hint + error envelope over .portal-input
 * chemistry, sized for multi-line input. Mirrors AguilaInput's contract
 * so a form that mixes both primitives reads as one visual system.
 *
 * Defaults: rows={3}, vertical resize, minHeight 96px (large enough
 * for goods descriptions + pedimento notes without forcing scroll).
 */
export const AguilaTextarea = forwardRef<HTMLTextAreaElement, AguilaTextareaProps>(
  function AguilaTextarea(
    { label, hint, error, required, className, textareaClassName, id: idProp, rows = 3, style, ...textareaProps },
    ref,
  ) {
    const autoId = useId()
    const id = idProp ?? autoId
    const describedByHint = hint ? `${id}-hint` : undefined
    const describedByError = error ? `${id}-error` : undefined
    const textareaClasses = ['portal-input', textareaClassName].filter(Boolean).join(' ')

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
        <textarea
          {...textareaProps}
          id={id}
          ref={ref}
          required={required}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={[describedByHint, describedByError]
            .filter(Boolean)
            .join(' ') || undefined}
          className={textareaClasses}
          style={{
            resize: 'vertical',
            minHeight: 96,
            padding: '12px 14px',
            fontFamily: 'inherit',
            ...style,
          }}
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
