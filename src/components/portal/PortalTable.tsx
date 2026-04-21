'use client'

import { useRouter } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'

export interface PortalColumn<T> {
  key: string
  label: ReactNode
  /** Custom cell renderer. Defaults to `row[key]` if the column key exists on the row. */
  render?: (row: T, index: number) => ReactNode
  /** Right-aligned numeric column (mono, tabular-nums). */
  num?: boolean
  width?: string | number
  headerStyle?: CSSProperties
  cellStyle?: CSSProperties
}

export interface PortalTableProps<T> {
  columns: PortalColumn<T>[]
  rows: T[]
  /** Optional URL built from a row — clicking the row navigates there. */
  rowHref?: (row: T, index: number) => string | undefined
  onRowClick?: (row: T, index: number) => void
  /** Shown when `rows.length === 0`. */
  emptyState?: ReactNode
  /** Key extractor — defaults to `row.id` or index. */
  keyFor?: (row: T, index: number) => string
  className?: string
  ariaLabel?: string
}

/**
 * Table primitive — composes `.portal-table` from portal-components.css.
 * Headers are mono micro uppercase, num cells align right with tabular
 * nums, row hover shows ink-2 background + emerald left rail.
 *
 * Pass `cell-renderers` from `@/lib/ui/cell-renderers` in the `render`
 * prop for null/pending/currency/pedimento/fracción handling.
 */
export function PortalTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowHref,
  onRowClick,
  emptyState,
  keyFor,
  className,
  ariaLabel,
}: PortalTableProps<T>) {
  const router = useRouter()

  function handleRowClick(row: T, index: number) {
    if (onRowClick) {
      onRowClick(row, index)
      return
    }
    const href = rowHref?.(row, index)
    if (href) router.push(href)
  }

  if (!rows || rows.length === 0) {
    return (
      <div style={{ padding: 'var(--portal-s-7) 0' }}>
        {emptyState ?? null}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        className={['portal-table', className].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.num ? 'right' : 'left',
                  width: c.width,
                  ...c.headerStyle,
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const key = keyFor?.(row, i) ?? (row.id as string | number | undefined)?.toString() ?? String(i)
            const href = rowHref?.(row, i)
            const clickable = Boolean(href || onRowClick)
            return (
              <tr
                key={key}
                onClick={clickable ? () => handleRowClick(row, i) : undefined}
                style={{
                  cursor: clickable ? 'pointer' : 'default',
                }}
              >
                {columns.map((c) => {
                  const v = c.render
                    ? c.render(row, i)
                    : (row[c.key] as ReactNode)
                  return (
                    <td
                      key={c.key}
                      className={c.num ? 'num' : undefined}
                      style={{
                        textAlign: c.num ? 'right' : 'left',
                        ...c.cellStyle,
                      }}
                    >
                      {v ?? ''}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
