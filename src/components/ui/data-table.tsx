import type { ReactNode } from 'react'

/**
 * DataTable — canonical V1 audit table chrome (2026-04-25).
 *
 * Locks the visual language used across all six V1 surfaces:
 *   - Bordered rounded shell
 *   - Sticky 11px uppercase headers (tracking-wider, muted fg, bg-muted/40)
 *   - 1.5%-white row-odd zebra
 *   - Silver 0.06 hover with 120ms transition
 *   - Tabular-nums on numerics
 *
 * Tailwind-only chrome — no inline <style>. CSS module overrides live
 * per-screen for layout-specific concerns.
 */

export interface DataTableColumn<T> {
  key: string
  header: string
  width?: number | string
  align?: 'left' | 'right' | 'center'
  /** When true, the cell renders with `font-mono`. */
  mono?: boolean
  /** Accessible/visual hint that the cell is numeric (right-aligned + tabular-nums). */
  numeric?: boolean
  /** Content renderer per row. */
  render: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>
  data: ReadonlyArray<T>
  /** Stable React key extractor — defaults to row index. */
  rowKey?: (row: T, index: number) => string | number
  /** Min width for the inner table; outer wrapper provides horizontal scroll. */
  mobileMinWidth?: number
  /** Optional aria-label for the table. */
  ariaLabel?: string
  /** Per-row click handler. When provided, rows are wrapped as clickable + cursor-pointer. */
  onRowClick?: (row: T) => void
  /** Class hook for callers that need extra cell tweaks scoped per screen. */
  className?: string
  /** Body fallback when `data` is empty. Caller usually provides an <EmptyState>. */
  empty?: ReactNode
}

const HEADER_CLS =
  'sticky top-0 z-10 bg-[rgba(255,255,255,0.02)] backdrop-blur-sm ' +
  'border-b border-[var(--border)] ' +
  'text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] ' +
  'px-3 py-2.5 text-left whitespace-nowrap'

const CELL_CLS =
  'px-3 py-2.5 text-[13px] text-[var(--text-secondary)] ' +
  'border-b border-[rgba(255,255,255,0.04)] whitespace-nowrap'

const ROW_BASE = 'transition-colors duration-[120ms]'
const ROW_ODD = 'odd:bg-[rgba(255,255,255,0.015)]'
const ROW_HOVER = 'hover:bg-[rgba(192,197,206,0.06)]'

export function DataTable<T>({
  columns,
  data,
  rowKey,
  mobileMinWidth = 720,
  ariaLabel,
  onRowClick,
  className,
  empty,
}: DataTableProps<T>) {
  if (data.length === 0 && empty !== undefined) {
    return <>{empty}</>
  }

  const wrapperCls = [
    'border border-[var(--border)] rounded-[10px] overflow-x-auto',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapperCls}>
      <table
        role="table"
        aria-label={ariaLabel}
        style={{ minWidth: mobileMinWidth }}
        className="w-full border-collapse [font-variant-numeric:tabular-nums]"
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={HEADER_CLS}
                style={{
                  width: c.width,
                  textAlign: c.numeric ? 'right' : (c.align ?? 'left'),
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const k = rowKey ? rowKey(row, i) : i
            const clickable = !!onRowClick
            const rowCls = [
              ROW_BASE,
              ROW_ODD,
              ROW_HOVER,
              clickable ? 'cursor-pointer' : '',
              i === data.length - 1 ? '[&>td]:border-b-0' : '',
            ].filter(Boolean).join(' ')
            return (
              <tr
                key={k}
                className={rowCls}
                onClick={clickable ? () => onRowClick!(row) : undefined}
              >
                {columns.map((c) => {
                  const align = c.numeric ? 'right' : (c.align ?? 'left')
                  const cellCls = [
                    CELL_CLS,
                    c.mono || c.numeric ? 'font-mono' : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <td
                      key={c.key}
                      className={cellCls}
                      style={{ textAlign: align }}
                    >
                      {c.render(row)}
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
