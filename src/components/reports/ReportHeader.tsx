'use client'
/**
 * Block 3 — shared ZAPATA AI report header (on-screen twin of PDF header).
 */
import React from 'react'

export function ReportHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <header className="flex items-end justify-between border-b border-white/10 pb-4">
      <div>
        <div
          className="font-mono text-2xl font-bold tracking-[0.08em]"
          style={{ color: '#C0C5CE' }}
        >
          ZAPATA AI
        </div>
        <div className="text-[11px] text-slate-400">Renato Zapata &amp; Co.</div>
      </div>
      <div className="text-right">
        <div className="text-base font-semibold text-slate-100">{title}</div>
        {subtitle ? <div className="text-xs text-slate-400">{subtitle}</div> : null}
      </div>
    </header>
  )
}
