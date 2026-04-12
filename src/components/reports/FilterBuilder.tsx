'use client'
import React from 'react'
import { FilterRow } from './FilterRow'
import type { ColumnSpec, FilterNode } from '@/types/reports'

export function FilterBuilder({
  columns,
  filters,
  onChange,
  onAdd,
  onRemove,
}: {
  columns: readonly ColumnSpec[]
  filters: FilterNode[]
  onChange: (idx: number, f: FilterNode) => void
  onAdd: () => void
  onRemove: (idx: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-400">
          Filtros ({filters.length})
        </span>
        <button
          type="button"
          onClick={onAdd}
          disabled={columns.length === 0}
          className="h-[44px] rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 hover:border-cyan-400/40 disabled:opacity-40"
        >
          + Agregar filtro
        </button>
      </div>
      {filters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
          Sin filtros — la consulta devuelve todo (hasta el tope de 5000 filas)
        </div>
      ) : (
        filters.map((f, i) => (
          <FilterRow
            key={i}
            columns={columns}
            filter={f}
            onChange={(next) => onChange(i, next)}
            onRemove={() => onRemove(i)}
          />
        ))
      )}
    </div>
  )
}
