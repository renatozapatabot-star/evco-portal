'use client'
import React from 'react'
import type { ColumnSpec } from '@/types/reports'

export function PreviewTable({
  columns,
  rows,
  loading,
  message,
  total,
  onSort,
  sortBy,
}: {
  columns: readonly ColumnSpec[]
  rows: readonly Record<string, unknown>[]
  loading: boolean
  message?: string
  total: number
  onSort: (key: string) => void
  sortBy?: { column: string; direction: 'asc' | 'desc' } | null
}) {
  if (message) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
        {message}
      </div>
    )
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>
          {loading ? 'Cargando…' : `Mostrando ${rows.length} de ${total} resultados`}
        </span>
      </div>
      <div className="max-h-[520px] overflow-auto rounded-lg border border-white/10">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-900/80 backdrop-blur">
            <tr>
              {columns.map((c) => {
                const active = sortBy?.column === c.key
                return (
                  <th
                    key={c.key}
                    onClick={() => onSort(c.key)}
                    className="cursor-pointer border-b border-white/10 px-3 py-2 text-left font-medium text-slate-300 hover:text-slate-100"
                  >
                    {c.label}
                    {active ? (sortBy?.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">
                  Sin resultados
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className={i % 2 === 1 ? 'bg-white/[0.02]' : ''}>
                  {columns.map((c) => {
                    const raw = r[c.key]
                    const text =
                      raw == null
                        ? ''
                        : typeof raw === 'object'
                          ? JSON.stringify(raw)
                          : String(raw)
                    const isNum = c.type === 'number' || c.type === 'currency' || c.type === 'date'
                    return (
                      <td
                        key={c.key}
                        className={`border-b border-white/5 px-3 py-2 text-slate-200 ${
                          isNum ? 'text-right font-mono tabular-nums' : ''
                        }`}
                      >
                        {text.length > 80 ? text.slice(0, 79) + '…' : text}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
