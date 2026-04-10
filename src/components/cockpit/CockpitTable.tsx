'use client'

import { type ReactNode } from 'react'

export interface CockpitColumn<T> {
  key: string
  label: string
  /** Render function for the cell */
  render: (row: T, index: number) => ReactNode
  /** Alignment — 'right' for numbers/currency */
  align?: 'left' | 'right' | 'center'
  /** Use JetBrains Mono for this column */
  mono?: boolean
  /** Sortable */
  sortable?: boolean
}

interface CockpitTableProps<T> {
  columns: CockpitColumn<T>[]
  data: T[]
  /** Unique key extractor */
  keyExtractor: (row: T, index: number) => string
  /** Callback when a row is clicked */
  onRowClick?: (row: T) => void
  /** Sort state */
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  /** Empty state message */
  emptyMessage?: string
  /** Empty state icon */
  emptyIcon?: ReactNode
}

/**
 * Dark-themed data table for the cockpit aesthetic.
 * Uses existing .aduana-dark .aduana-table styles.
 * Alternating rows, JetBrains Mono on numeric columns.
 */
export function CockpitTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  sortKey,
  sortDir,
  onSort,
  emptyMessage = 'Sin datos disponibles',
  emptyIcon,
}: CockpitTableProps<T>) {
  if (data.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '48px 24px',
        color: 'var(--text-muted, #6E7681)',
      }}>
        {emptyIcon && <div style={{ marginBottom: 12 }}>{emptyIcon}</div>}
        <p style={{ fontSize: 14, fontWeight: 500 }}>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table className="aduana-table" style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
      }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                style={{
                  padding: '10px 12px',
                  textAlign: col.align || 'left',
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-secondary, #8B949E)',
                  background: 'var(--bg-elevated, #222222)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  cursor: col.sortable ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span style={{ marginLeft: 4, opacity: 0.6 }}>
                    {sortDir === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={keyExtractor(row, i)}
              className={i % 2 === 0 ? 'row-even' : 'row-odd'}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background 100ms ease',
              }}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  style={{
                    padding: '10px 12px',
                    textAlign: col.align || 'left',
                    fontFamily: col.mono ? 'var(--font-mono)' : undefined,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    color: 'var(--text-primary, #E6EDF3)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
