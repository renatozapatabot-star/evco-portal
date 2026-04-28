import type { ReactNode } from 'react'
import Link from 'next/link'

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

export interface EmptyStateAction {
  label: string
  /** Absolute or relative URL. Renders a styled <Link>. */
  href: string
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
  /** Optional CTA — renders a 60px button-link below the content. */
  action?: EmptyStateAction
}

export function EmptyState({
  title,
  description,
  hint,
  ghosted,
  action,
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
      {action && (
        <Link
          href={action.href}
          className={
            'mt-2 inline-flex items-center justify-center px-5 ' +
            'rounded-[10px] border border-[var(--border)] ' +
            'bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(192,197,206,0.10)] ' +
            'text-[var(--text-primary)] text-[13px] font-semibold ' +
            'no-underline transition-colors duration-[120ms]'
          }
          style={{ minHeight: 60 }}
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
