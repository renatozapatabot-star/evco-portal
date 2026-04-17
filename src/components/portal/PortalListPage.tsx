'use client'

import type { ReactNode } from 'react'
import { PortalCard } from './PortalCard'
import { PortalSection } from './PortalSection'
import { PortalTable } from './PortalTable'
import type { PortalColumn } from './PortalTable'

export interface PortalListPageProps<T> {
  title: ReactNode
  subtitle?: ReactNode
  /** Right-aligned eyebrow text (e.g. "1,248 pedimentos · abril 2026"). */
  eyebrow?: ReactNode
  /** Optional row above the table (month selector, search, filters). */
  toolbar?: ReactNode
  columns: PortalColumn<T>[]
  rows: T[]
  rowHref?: (row: T, index: number) => string | undefined
  onRowClick?: (row: T, index: number) => void
  emptyState?: ReactNode
  /** Optional panel rendered below the table (pagination, summary). */
  footer?: ReactNode
  ariaLabel?: string
}

/**
 * Composition primitive for list pages — wraps a PortalCard with a
 * PortalSection header + optional toolbar + PortalTable. Shared
 * template for /embarques, /pedimentos, /expedientes, /entradas,
 * /catalogo, /documentos, /oca, /admin/aprobaciones, /anexo-24.
 */
export function PortalListPage<T extends Record<string, unknown>>({
  title,
  subtitle,
  eyebrow,
  toolbar,
  columns,
  rows,
  rowHref,
  onRowClick,
  emptyState,
  footer,
  ariaLabel,
}: PortalListPageProps<T>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--portal-s-6)' }}>
      <PortalSection title={title} eyebrow={eyebrow}>
        {subtitle ? (
          <p
            style={{
              color: 'var(--portal-fg-3)',
              fontSize: 'var(--portal-fs-sm)',
              marginTop: -12,
              marginBottom: 'var(--portal-s-5)',
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </PortalSection>
      {toolbar ? (
        <div
          style={{
            display: 'flex',
            gap: 'var(--portal-s-3)',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {toolbar}
        </div>
      ) : null}
      <PortalCard tier="raised" padding={0}>
        <PortalTable
          columns={columns}
          rows={rows}
          rowHref={rowHref}
          onRowClick={onRowClick}
          emptyState={emptyState}
          ariaLabel={ariaLabel}
        />
      </PortalCard>
      {footer ? <div>{footer}</div> : null}
    </div>
  )
}
