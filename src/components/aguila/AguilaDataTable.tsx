'use client'

/**
 * AguilaDataTable — customs-aware table primitive.
 *
 * Composes <PortalTable> and adds column `type` props that auto-route
 * through the canonical cell-renderers (pedimento, fraccion, currency,
 * semaforo, status, number, date). Every list page (tráficos, pedimentos,
 * expedientes, anexo-24, catálogo) should use this instead of reinventing
 * `.portal-table` markup inline.
 *
 * Usage:
 *   <AguilaDataTable
 *     columns={[
 *       { key: 'pedimento', label: 'Pedimento', type: 'pedimento' },
 *       { key: 'fraccion', label: 'Fracción', type: 'fraccion' },
 *       { key: 'valor', label: 'Valor', type: 'currency', currency: 'MXN' },
 *       { key: 'semaforo', label: 'Semáforo', type: 'semaforo' },
 *       { key: 'estado', label: 'Estado', type: 'status' },
 *     ]}
 *     rows={data}
 *     rowHref={(row) => `/pedimentos/${row.id}`}
 *   />
 */

import type { ReactNode } from 'react'

import { PortalTable } from '@/components/portal/PortalTable'
import type { PortalColumn } from '@/components/portal/PortalTable'
import {
  renderCurrency,
  renderDate,
  renderFraccion,
  renderNull,
  renderNumber,
  renderPedimento,
} from '@/lib/ui/cell-renderers'
import { SemaforoPill } from './SemaforoPill'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Status } from '@/components/ui/StatusBadge'
import type { SemaforoValue } from './SemaforoPill'

export type AguilaColumnType =
  | 'text'
  | 'pedimento'
  | 'fraccion'
  | 'currency'
  | 'semaforo'
  | 'status'
  | 'number'
  | 'date'
  | 'custom'

export interface AguilaColumn<T> {
  /** Property name on each row. */
  key: string
  /** Header label — usually a string but accepts JSX for icons. */
  label: ReactNode
  /** Column type — drives the default cell renderer. Use 'custom' with `render`. */
  type?: AguilaColumnType
  /** For currency columns — MXN or USD. Required when type='currency'. */
  currency?: 'MXN' | 'USD'
  /** Decimals for number columns. Defaults to 0. */
  decimals?: number
  /** Include time on date columns. Defaults to false. */
  includeTime?: boolean
  /** Custom renderer — only honored when type='custom' or unset. */
  render?: (row: T, index: number) => ReactNode
  /** Column width (CSS or px). */
  width?: string | number
  /** Right-align (auto for number/currency types). */
  alignRight?: boolean
}

export interface AguilaDataTableProps<T> {
  columns: AguilaColumn<T>[]
  rows: T[]
  /** Clickable row navigation via href builder. */
  rowHref?: (row: T, index: number) => string | undefined
  onRowClick?: (row: T, index: number) => void
  /** Empty state node. Defaults to canonical "Sin resultados" muted line. */
  emptyState?: ReactNode
  /** Key extractor — defaults to row.id if present, otherwise index. */
  keyFor?: (row: T, index: number) => string
  className?: string
  ariaLabel?: string
}

const NUMERIC_TYPES: ReadonlySet<AguilaColumnType> = new Set([
  'currency',
  'number',
])

function defaultCellRenderer<T extends Record<string, unknown>>(
  col: AguilaColumn<T>,
): (row: T, i: number) => ReactNode {
  const type = col.type ?? 'text'
  if (col.render && (type === 'custom' || type === 'text')) {
    return col.render
  }
  return function AguilaDefaultCell(row) {
    const raw = row[col.key]
    switch (type) {
      case 'pedimento':
        return renderPedimento(raw as string | null | undefined)
      case 'fraccion':
        return renderFraccion(raw as string | null | undefined)
      case 'currency':
        return renderCurrency(
          raw as number | null | undefined,
          col.currency ?? 'MXN',
        )
      case 'number':
        return renderNumber(raw as number | null | undefined, {
          decimals: col.decimals,
        })
      case 'date':
        return renderDate(raw as string | Date | null | undefined, {
          includeTime: col.includeTime,
        })
      case 'semaforo':
        return <SemaforoPill value={raw as SemaforoValue} size="compact" />
      case 'status':
        return raw ? (
          <StatusBadge status={String(raw) as Status} />
        ) : (
          renderNull()
        )
      case 'text':
      case 'custom':
      default:
        if (raw === null || raw === undefined || raw === '') return renderNull()
        return raw as ReactNode
    }
  }
}

export function AguilaDataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowHref,
  onRowClick,
  emptyState,
  keyFor,
  className,
  ariaLabel,
}: AguilaDataTableProps<T>) {
  const portalColumns: PortalColumn<T>[] = columns.map((col) => {
    const type = col.type ?? 'text'
    const isNumeric = col.alignRight ?? NUMERIC_TYPES.has(type)
    return {
      key: col.key,
      label: col.label,
      num: isNumeric,
      width: col.width,
      render: defaultCellRenderer(col),
    }
  })

  return (
    <PortalTable
      columns={portalColumns}
      rows={rows}
      rowHref={rowHref}
      onRowClick={onRowClick}
      emptyState={
        emptyState ?? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--portal-fg-4)',
              fontSize: 13,
              padding: '24px 0',
            }}
          >
            Sin resultados · ajuste los filtros para ver más.
          </div>
        )
      }
      keyFor={keyFor}
      className={className}
      ariaLabel={ariaLabel}
    />
  )
}
