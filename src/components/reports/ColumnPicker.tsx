'use client'
import React, { useState } from 'react'
import type { ColumnSpec } from '@/types/reports'

export function ColumnPicker({
  columns,
  selected,
  onToggle,
  onClear,
}: {
  columns: readonly ColumnSpec[]
  selected: string[]
  onToggle: (key: string) => void
  onClear: () => void
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const visible = columns.filter((c) => !c.advanced || showAdvanced)
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-400">
          Columnas ({selected.length})
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
        >
          Limpiar
        </button>
      </div>
      <div className="max-h-[320px] space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] p-2">
        {visible.map((c) => {
          const active = selected.includes(c.key)
          return (
            <label
              key={c.key}
              className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => onToggle(c.key)}
                className="h-4 w-4"
              />
              <span className="flex-1">{c.label}</span>
              {c.advanced ? (
                <span className="text-[10px] uppercase text-slate-500">avanzada</span>
              ) : null}
            </label>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="mt-2 text-xs text-slate-400 hover:text-slate-200"
      >
        {showAdvanced ? 'Ocultar avanzadas' : 'Mostrar avanzadas'}
      </button>
    </div>
  )
}
