'use client'
/**
 * Block 3 — builder empty state: Portal wordmark + prompt.
 */
import React from 'react'

export function ReportsEmptyState({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
      <div
        className="font-mono text-4xl tracking-[0.08em]"
        style={{ color: '#eab308' }}
      >
        AGUILA
      </div>
      <div className="text-xs text-slate-400">Renato Zapata &amp; Co.</div>
      <div className="mt-3 text-sm text-slate-300">
        {message ?? 'Selecciona una fuente para comenzar'}
      </div>
    </div>
  )
}
