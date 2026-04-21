'use client'

/**
 * AguilaStagePills — pill row for moving an entity between discrete stages.
 *
 * Extracted from LeadDetailClient's stage-change row 2026-04-21 so
 * future pipelines (OCA status, approval workflow, onboarding steps)
 * reuse the same chemistry: active pill = primary variant, rest =
 * ghost, optional saving indicator per pill.
 *
 * V1 token-pure. No hex, no inline glass. 44-60px touch target.
 */

import { Clock } from 'lucide-react'

export interface AguilaStageOption<T extends string> {
  value: T
  label: string
  /** Optional sub-label rendered underneath in monospace; used for counts or timing. */
  sub?: string
}

interface Props<T extends string> {
  stages: readonly AguilaStageOption<T>[]
  current: T
  onChange: (next: T) => void
  /**
   * When this is the stage a save is in-flight for, the pill gets a
   * clock icon + reduced opacity. Pass null when no save is pending.
   */
  saving?: T | null
  /** Set true to globally disable the row (e.g. converted leads). */
  disabled?: boolean
  /** Layout: 'wrap' (default) | 'scroll' for overflow-x on mobile. */
  overflow?: 'wrap' | 'scroll'
}

export function AguilaStagePills<T extends string>({
  stages,
  current,
  onChange,
  saving = null,
  disabled = false,
  overflow = 'wrap',
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      style={{
        display: 'flex',
        flexWrap: overflow === 'wrap' ? 'wrap' : 'nowrap',
        overflowX: overflow === 'scroll' ? 'auto' : 'visible',
        gap: 8,
        paddingBottom: overflow === 'scroll' ? 4 : 0,
      }}
    >
      {stages.map((s) => {
        const active = s.value === current
        const isSaving = saving === s.value
        const effectivelyDisabled = disabled || isSaving
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={s.label}
            onClick={() => onChange(s.value)}
            disabled={effectivelyDisabled}
            className={
              active
                ? 'portal-btn portal-btn--primary'
                : 'portal-btn portal-btn--ghost'
            }
            style={{
              minHeight: 44,
              padding: '0 14px',
              fontSize: 'var(--portal-fs-sm)',
              opacity: effectivelyDisabled ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            <span>{s.label}</span>
            {s.sub ? (
              <span
                style={{
                  fontFamily: 'var(--portal-font-mono)',
                  fontSize: 'var(--portal-fs-tiny)',
                  letterSpacing: '0.08em',
                  opacity: 0.7,
                }}
              >
                {s.sub}
              </span>
            ) : null}
            {isSaving ? (
              <Clock
                size={14}
                strokeWidth={2.2}
                aria-label="Guardando"
                style={{ opacity: 0.6 }}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
