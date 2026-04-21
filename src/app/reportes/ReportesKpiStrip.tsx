'use client'

import { useEffect, useState } from 'react'
import { KPITile } from '@/components/aguila/KPITile'
import type { ReportesKpis } from '@/lib/reportes/kpis'
// Canonical compact formatter lives in lib/format-utils — appends "USD"
// suffix so every financial KPI surface is unambiguous about currency.
// The local copy that used to live in this file stripped the suffix,
// making "Valor importado $30.0M" read as MXN to clients (invariant #10).
import { fmtUSDCompact } from '@/lib/format-utils'

/**
 * Six-tile KPI strip rendered above the report builder. Mirrors the totals
 * the PDF computes so what the owner sees on screen matches what gets
 * exported. Backend lives at /api/reportes/kpis (same aggregator the PDF
 * route uses — see src/lib/reportes/kpis.ts).
 */
export function ReportesKpiStrip() {
  const [kpis, setKpis] = useState<ReportesKpis | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/reportes/kpis')
      .then(r => r.json())
      .then(payload => {
        if (cancelled) return
        if (payload.error) setError(payload.error.message ?? 'Error')
        else setKpis(payload.data as ReportesKpis)
      })
      .catch(err => { if (!cancelled) setError(err?.message ?? 'Network error') })
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div style={{
        background: 'var(--portal-status-red-bg)',
        border: '1px solid rgba(239,68,68,0.2)',
        color: 'var(--portal-status-red-fg)',
        borderRadius: 12,
        padding: '12px 16px',
        marginBottom: 16,
        fontSize: 'var(--aguila-fs-body)',
      }}>
        No se pudieron cargar los KPIs: {error}
      </div>
    )
  }

  const LABELS = [
    'Operaciones totales',
    'Valor importado',
    'Despacho rápido',
    // "Tasa de éxito" read as a broker quality score, which it isn't —
    // the underlying metric is cruzados ÷ total (completed in window).
    // Relabel so a 33% reading on a month with lots of in-flight
    // shipments doesn't imply "we failed 67% of pedimentos".
    '% Cruzados en ventana',
    'Cumplimiento T-MEC',
    'Pedimentos asignados',
  ]

  const tiles: Array<{ label: string; value: string; href?: string }> = kpis
    ? [
        { label: LABELS[0], value: kpis.totalTraficos.toLocaleString('es-MX'), href: '/embarques' },
        { label: LABELS[1], value: fmtUSDCompact(kpis.totalValueUSD) },
        { label: LABELS[2], value: `${kpis.despachoRapidoPct}%` },
        { label: LABELS[3], value: `${kpis.successRate}%` },
        { label: LABELS[4], value: `${kpis.tmecRate}%` },
        { label: LABELS[5], value: `${kpis.pedimentosAsignadosPct}%`, href: '/pedimentos' },
      ]
    : LABELS.map(label => ({ label, value: '—' }))

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}
    >
      {tiles.map(t => (
        <KPITile
          key={t.label}
          label={t.label}
          value={t.value}
          href={t.href}
          compact
        />
      ))}
    </div>
  )
}
