'use client'
import React, { useState } from 'react'
import type { ReportTemplateRow } from '@/types/reports'

function Section({
  title,
  rows,
  deletable,
  onLoad,
  onDelete,
}: {
  title: string
  rows: ReportTemplateRow[]
  deletable: boolean
  onLoad: (t: ReportTemplateRow) => void
  onDelete?: (id: string) => void
}) {
  if (rows.length === 0) {
    return (
      <div>
        {title ? (
          <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">{title}</div>
        ) : null}
        <div className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-xs text-slate-500">
          Sin plantillas
        </div>
      </div>
    )
  }
  return (
    <div>
      {title ? (
        <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">{title}</div>
      ) : null}
      <ul className="space-y-1">
        {rows.map((t) => (
          <li
            key={t.id}
            className="flex min-h-[60px] items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
          >
            <button
              type="button"
              onClick={() => onLoad(t)}
              className="flex-1 text-left text-sm text-slate-200 hover:text-slate-300"
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-[11px] text-slate-500">{t.source_entity}</div>
            </button>
            {deletable && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(t.id)}
                className="h-[44px] rounded border border-white/10 px-2 text-xs text-slate-400 hover:border-red-500/40 hover:text-red-300"
                aria-label="Eliminar plantilla"
              >
                Eliminar
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TemplateList({
  privateTpls,
  teamTpls,
  seedTpls,
  onLoad,
  onDelete,
}: {
  privateTpls: ReportTemplateRow[]
  teamTpls: ReportTemplateRow[]
  seedTpls: ReportTemplateRow[]
  onLoad: (t: ReportTemplateRow) => void
  onDelete?: (id: string) => void
}) {
  const [showSeed, setShowSeed] = useState(false)

  return (
    <div className="space-y-3">
      <Section title="Mis plantillas" rows={privateTpls} deletable onLoad={onLoad} onDelete={onDelete} />
      <Section title="Plantillas del equipo" rows={teamTpls} deletable={false} onLoad={onLoad} />
      <div>
        <button
          type="button"
          onClick={() => setShowSeed((v) => !v)}
          className="mb-1 text-xs uppercase tracking-wider text-slate-400 hover:text-slate-200"
        >
          {showSeed ? '▾' : '▸'} Plantillas de PORTAL ({seedTpls.length})
        </button>
        {showSeed ? <Section title="" rows={seedTpls} deletable={false} onLoad={onLoad} /> : null}
      </div>
    </div>
  )
}
