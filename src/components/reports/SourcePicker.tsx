'use client'
import React from 'react'
import type { ReportEntity, ReportEntityId } from '@/types/reports'

export function SourcePicker({
  entities,
  value,
  onChange,
}: {
  entities: readonly ReportEntity[]
  value: ReportEntityId | null
  onChange: (id: ReportEntityId) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-slate-400">
        Fuente
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value as ReportEntityId)}
        className="h-[60px] w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-slate-100 focus:border-slate-300 focus:outline-none"
      >
        <option value="" disabled>
          Selecciona una fuente…
        </option>
        {entities.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </select>
    </label>
  )
}
