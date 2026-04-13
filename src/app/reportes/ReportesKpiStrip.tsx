'use client'

import { useEffect, useState } from 'react'
import { KPITile } from '@/components/aguila/KPITile'
import type { ReportesKpis } from '@/lib/reportes/kpis'

function fmtUSDCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

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
        background: 'rgba(239,68,68,0.06)',
        border: '1px solid rgba(239,68,68,0.2)',
        color: '#FCA5A5',
        borderRadius: 12,
        padding: '12px 16px',
        marginBottom: 16,
        fontSize: 13,
      }}>
        No se pudieron cargar los KPIs: {error}
      </div>
    )
  }

  const LABELS = [
    'Operaciones totales',
    'Valor importado',
    'Despacho rápido',
    'Tasa de éxito',
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
