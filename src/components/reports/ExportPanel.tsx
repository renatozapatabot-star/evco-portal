'use client'
import React, { useState } from 'react'
import type { ExportFormat, ReportConfig } from '@/types/reports'

export function ExportPanel({
  config,
  name,
  disabled,
  onStart,
  onComplete,
}: {
  config: ReportConfig
  name: string
  disabled: boolean
  onStart?: (fmt: ExportFormat) => void
  onComplete?: (fmt: ExportFormat, durationMs: number) => void
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function doExport(format: ExportFormat) {
    if (busy || disabled) return
    setBusy(format)
    setError(null)
    onStart?.(format)
    const t0 = Date.now()
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config, format, name: name || undefined }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        setError(body?.error?.message ?? `Error ${res.status}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disp = res.headers.get('content-disposition') ?? ''
      const match = /filename="([^"]+)"/.exec(disp)
      a.download = match ? match[1] : `reporte.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onComplete?.(format, Date.now() - t0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-slate-400">Exportar</div>
      <div className="flex flex-wrap gap-2">
        {(['pdf', 'xlsx', 'csv'] as ExportFormat[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => doExport(f)}
            disabled={disabled || busy !== null}
            className="h-[60px] min-w-[80px] flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-100 hover:border-amber-400/40 disabled:opacity-40"
          >
            {busy === f ? '…' : f.toUpperCase()}
          </button>
        ))}
      </div>
      {error ? <div className="text-xs text-red-300">{error}</div> : null}
    </div>
  )
}
