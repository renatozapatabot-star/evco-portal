'use client'

/**
 * ZAPATA AI · Block 6c — Generic repeating-rows form for pedimento child tables.
 *
 * Renders a list of rows (one card per row) with per-field inputs that
 * autosave via `useAutosaveChildRow`. Handles Add / Remove via the child API.
 *
 * This is a UI shell; each tab declares its own `columns` spec.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { ACCENT_SILVER, ACCENT_SILVER_DIM, TEXT_PRIMARY, TEXT_MUTED } from '@/lib/design-system'
import type { ChildTable } from '@/lib/pedimento-types'
import { useAutosaveChildRow } from '@/lib/hooks/useAutosaveChildRow'
import { AutosaveIndicator } from './AutosaveIndicator'
import { BankSelector } from '@/components/banks/BankSelector'

const BORDER_SILVER = 'rgba(192,197,206,0.22)'
const BORDER_FOCUS = 'rgba(192,197,206,0.55)'
const RED = '#EF4444'

export type ColumnVariant = 'text' | 'number' | 'select' | 'textarea' | 'bank'

export interface Column<R> {
  field: string
  label: string
  variant?: ColumnVariant
  mono?: boolean
  placeholder?: string
  helpText?: string
  options?: readonly { code: string; label: string }[]
  /** Extract current value from row. Defaults to `row[field]`. */
  getValue?: (row: R) => string
  /** Error message (from validation engine) for this field of this row index. */
  errorFor?: (row: R, index: number) => string | undefined
  /** Override default coercion (e.g. serialize text → JSONB object). */
  serialize?: (raw: string) => unknown
}

export interface RepeatingRowsProps<R extends { id: string }> {
  title: string
  emptyMessage: string
  pedimentoId: string
  table: ChildTable
  rows: R[]
  columns: readonly Column<R>[]
  /** Default fields sent when adding a new row (server fills id, pedimento_id). */
  defaultNewRow?: Record<string, unknown>
  /** Optional summary/footer content (e.g. Contribuciones subtotal). */
  footer?: React.ReactNode
}

export function RepeatingRows<R extends { id: string }>({
  title,
  emptyMessage,
  pedimentoId,
  table,
  rows,
  columns,
  defaultNewRow,
  footer,
}: RepeatingRowsProps<R>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function callChildApi(body: Record<string, unknown>): Promise<boolean> {
    setErrorMessage(null)
    const res = await fetch(`/api/pedimento/${pedimentoId}/child`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string }
      setErrorMessage(b.error ?? `HTTP ${res.status}`)
      return false
    }
    return true
  }

  function addRow() {
    startTransition(async () => {
      const ok = await callChildApi({ op: 'add', table, row: defaultNewRow ?? {} })
      if (ok) router.refresh()
    })
  }

  function deleteRow(rowId: string) {
    startTransition(async () => {
      const ok = await callChildApi({ op: 'delete', table, rowId })
      if (ok) router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 600, color: TEXT_PRIMARY }}>
            {title}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--aguila-fs-compact)', color: TEXT_MUTED }}>
            {rows.length} {rows.length === 1 ? 'fila' : 'filas'}
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={isPending}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 60,
            padding: '0 16px',
            fontSize: 'var(--aguila-fs-body)',
            fontWeight: 600,
            color: ACCENT_SILVER,
            background: 'rgba(192,197,206,0.08)',
            border: `1px solid ${BORDER_SILVER}`,
            borderRadius: 10,
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          <Plus size={14} /> Agregar
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: `1px solid ${RED}66`,
            background: 'rgba(239,68,68,0.08)',
            color: RED,
            fontSize: 'var(--aguila-fs-body)',
          }}
        >
          {errorMessage}
        </div>
      )}

      {rows.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.045)',
            border: `1px solid ${BORDER_SILVER}`,
            backdropFilter: 'blur(20px)',
            color: TEXT_MUTED,
            fontSize: 'var(--aguila-fs-body)',
          }}
        >
          {emptyMessage}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((row, index) => (
            <RowCard
              key={row.id}
              row={row}
              index={index}
              pedimentoId={pedimentoId}
              table={table}
              columns={columns}
              onDelete={() => deleteRow(row.id)}
              disabled={isPending}
            />
          ))}
        </div>
      )}

      {footer}
    </div>
  )
}

interface RowCardProps<R extends { id: string }> {
  row: R
  index: number
  pedimentoId: string
  table: ChildTable
  columns: readonly Column<R>[]
  onDelete: () => void
  disabled: boolean
}

function RowCard<R extends { id: string }>({
  row,
  index,
  pedimentoId,
  table,
  columns,
  onDelete,
  disabled,
}: RowCardProps<R>) {
  const { status, lastSaved, errorMessage, saveField, flush } = useAutosaveChildRow({
    pedimentoId,
    table,
    rowId: row.id,
  })

  // Local values per column (edits debounced through hook).
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const col of columns) {
      const v = col.getValue
        ? col.getValue(row)
        : stringFromUnknown((row as unknown as Record<string, unknown>)[col.field])
      out[col.field] = v
    }
    return out
  })

  const onChange = (col: Column<R>, raw: string) => {
    setValues((s) => ({ ...s, [col.field]: raw }))
    saveField(col.field, coerce(col, raw))
  }

  const onBlur = (col: Column<R>) => {
    const raw = values[col.field] ?? ''
    flush(col.field, coerce(col, raw))
  }

  return (
    <div
      style={{
        padding: 20,
        borderRadius: 20,
        background: 'rgba(255,255,255,0.045)',
        border: `1px solid ${BORDER_SILVER}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 'var(--aguila-fs-meta)',
            fontFamily: 'var(--font-mono)',
            color: ACCENT_SILVER_DIM,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Fila #{index + 1}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AutosaveIndicator status={status} lastSaved={lastSaved} errorMessage={errorMessage} />
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            aria-label="Eliminar fila"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 60,
              height: 60,
              borderRadius: 10,
              background: 'transparent',
              border: `1px solid ${BORDER_SILVER}`,
              color: RED,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {columns.map((col) => {
          const value = values[col.field] ?? ''
          const error = col.errorFor?.(row, index)
          return (
            <FieldCell
              key={col.field}
              col={col}
              value={value}
              error={error}
              onChange={(raw) => onChange(col, raw)}
              onBlur={() => onBlur(col)}
            />
          )
        })}
      </div>
    </div>
  )
}

interface FieldCellProps<R> {
  col: Column<R>
  value: string
  error?: string
  onChange: (v: string) => void
  onBlur: () => void
}

function FieldCell<R>({ col, value, error, onChange, onBlur }: FieldCellProps<R>) {
  const borderColor = error ? RED : BORDER_SILVER
  const common: React.CSSProperties = {
    minHeight: 60,
    padding: '10px 12px',
    width: '100%',
    background: 'rgba(255,255,255,0.045)',
    color: TEXT_PRIMARY,
    border: `1px solid ${borderColor}`,
    borderRadius: 10,
    fontSize: 'var(--aguila-fs-section)',
    fontFamily: col.mono ? 'var(--font-mono)' : 'inherit',
    outline: 'none',
  }
  const onFocus = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = error ? RED : BORDER_FOCUS
  }
  const onBlurStyle = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = error ? RED : BORDER_SILVER
    onBlur()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 'var(--aguila-fs-meta)',
          color: TEXT_MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {col.label}
      </label>
      {col.variant === 'bank' ? (
        <BankSelector
          value={value || null}
          onChange={(code) => {
            onChange(code)
            setTimeout(() => onBlur(), 0)
          }}
          onlyPece
          ariaLabel={col.label}
        />
      ) : col.variant === 'textarea' ? (
        <textarea
          value={value}
          placeholder={col.placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlurStyle}
          style={{ ...common, minHeight: 100, resize: 'vertical' }}
        />
      ) : col.variant === 'select' ? (
        <select
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setTimeout(() => onBlur(), 0)
          }}
          onFocus={onFocus}
          onBlur={onBlurStyle}
          style={common}
        >
          <option value="">— Selecciona —</option>
          {(col.options ?? []).map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={col.variant === 'number' ? 'number' : 'text'}
          step={col.variant === 'number' ? 'any' : undefined}
          value={value}
          placeholder={col.placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlurStyle}
          style={common}
        />
      )}
      {error ? (
        <div role="alert" style={{ fontSize: 'var(--aguila-fs-meta)', color: RED }}>
          {error}
        </div>
      ) : col.helpText ? (
        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>{col.helpText}</div>
      ) : null}
    </div>
  )
}

function stringFromUnknown(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return ''
}

function coerce<R>(col: Column<R>, raw: string): unknown {
  if (col.serialize) return col.serialize(raw)
  const trimmed = raw.trim()
  if (col.variant === 'number') {
    if (trimmed.length === 0) return null
    const n = Number.parseFloat(trimmed)
    return Number.isFinite(n) ? n : null
  }
  // Empty string → null for nullable text columns
  return trimmed.length === 0 ? null : raw
}
