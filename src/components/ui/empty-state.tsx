import type { ReactNode } from 'react'

/**
 * EmptyState — canonical V1 audit empty-state primitive (2026-04-25).
 *
 * Calm dashed border, mono ghosted chips when `ghosted` is provided.
 * All six V1 surfaces share this component.
 */

export interface EmptyStateGhosted {
  label: string
  sub?: string
}

export interface EmptyStateProps {
  /** Headline — short, matter-of-fact. */
  title: string
  /** Optional supporting line below the title. */
  description?: string
  /** Tiny meta line below the description (e.g. cadence hint). */
  hint?: string
  /** When provided, renders ghosted "Pendiente" chips for the labels. */
  ghosted?: ReadonlyArray<EmptyStateGhosted>
}

export function EmptyState({
  title,
  description,
  hint,
  ghosted,
}: EmptyStateProps) {
  return (
    <div
      className={
        'rounded-[10px] border border-dashed border-[var(--border)] ' +
        'bg-[var(--bg-card)] px-4 py-8 text-center ' +
        'flex flex-col items-center gap-3'
      }
    >
      <div className="text-[14px] font-semibold text-[var(--text-secondary)]">
        {title}
      </div>
      {description && (
        <div className="text-[13px] text-[var(--text-muted)] max-w-[420px]">
          {description}
        </div>
      )}
      {ghosted && ghosted.length > 0 && (
        <ul
          className={
            'mt-4 grid gap-2 w-full max-w-[520px] ' +
            'grid-cols-1 sm:grid-cols-2 list-none p-0 m-0'
          }
        >
          {ghosted.map((g) => (
            <li
              key={g.label}
              className={
                'flex items-center justify-between gap-3 ' +
                'rounded-[8px] border border-dashed border-[var(--border)] ' +
                'px-3 py-2 text-left'
              }
            >
              <span className="text-[12px] text-[var(--text-secondary)] truncate">
                {g.label}
              </span>
              <span
                className={
                  'text-[10px] font-semibold uppercase tracking-wider ' +
                  'text-[var(--text-muted)] font-mono'
                }
              >
                {g.sub ?? 'Pendiente'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {hint && (
        <div className="text-[11px] text-[var(--text-muted)] mt-2">
          {hint}
        </div>
      )}
    </div>
  )
}
