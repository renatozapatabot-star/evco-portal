'use client'
import React from 'react'
import type { ColumnSpec, FilterNode, FilterOperator } from '@/types/reports'

const OP_LABELS: Record<FilterOperator, string> = {
  eq: '=',
  neq: '≠',
  contains: 'contiene',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  between: 'entre',
  in_last_days: 'últimos N días',
  is_null: 'vacío',
  is_not_null: 'con valor',
  in: 'en lista',
}

export function FilterRow({
  columns,
  filter,
  onChange,
  onRemove,
}: {
  columns: readonly ColumnSpec[]
  filter: FilterNode
  onChange: (f: FilterNode) => void
  onRemove: () => void
}) {
  const spec = columns.find((c) => c.key === filter.column) ?? null
  const ops = spec?.operators ?? []
  const needsValue = !['is_null', 'is_not_null'].includes(filter.operator)
  const needsSecond = filter.operator === 'between'
  const isDays = filter.operator === 'in_last_days'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
      <select
        value={filter.column}
        onChange={(e) => onChange({ ...filter, column: e.target.value })}
        className="h-[44px] rounded border border-white/10 bg-transparent px-2 text-xs text-slate-100"
      >
        {columns.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
      <select
        value={filter.operator}
        onChange={(e) => onChange({ ...filter, operator: e.target.value as FilterOperator })}
        className="h-[44px] rounded border border-white/10 bg-transparent px-2 text-xs text-slate-100"
      >
        {ops.map((op) => (
          <option key={op} value={op}>
            {OP_LABELS[op]}
          </option>
        ))}
      </select>
      {isDays ? (
        <input
          type="number"
          min={1}
          max={3650}
          value={filter.days ?? 30}
          onChange={(e) => onChange({ ...filter, days: Number(e.target.value) })}
          className="h-[44px] w-24 rounded border border-white/10 bg-transparent px-2 text-xs text-slate-100"
        />
      ) : needsValue ? (
        <input
          type={spec?.type === 'number' || spec?.type === 'currency' ? 'number' : spec?.type === 'date' ? 'date' : 'text'}
          value={(filter.value as string | number | undefined) ?? ''}
          onChange={(e) => onChange({ ...filter, value: e.target.value })}
          className="h-[44px] flex-1 rounded border border-white/10 bg-transparent px-2 text-xs text-slate-100"
        />
      ) : null}
      {needsSecond ? (
        <input
          type={spec?.type === 'date' ? 'date' : 'number'}
          value={(filter.valueTo as string | number | undefined) ?? ''}
          onChange={(e) => onChange({ ...filter, valueTo: e.target.value })}
          className="h-[44px] w-32 rounded border border-white/10 bg-transparent px-2 text-xs text-slate-100"
        />
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        className="h-[44px] rounded border border-white/10 px-3 text-xs text-slate-400 hover:border-red-500/40 hover:text-red-300"
        aria-label="Quitar filtro"
      >
        Quitar
      </button>
    </div>
  )
}
