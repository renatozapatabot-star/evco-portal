'use client'

import {
  BarChart3, Activity, CheckCircle2,
  XCircle, AlertTriangle,
} from 'lucide-react'
import { fmtDateTime } from '@/lib/format-utils'
import { MODEL_TYPE_LABELS } from '@/lib/intelligence'
import { D, AccuracyBadge, DeltaBadge, Th, EmptyState } from './IntelShared'
import type { SandboxRow, ShadowRow, Stats } from './IntelShared'

/* ── Model Performance Table ─────────────────────────────── */

export function ModelPerformanceTable({
  sandbox,
  loading,
}: {
  sandbox: SandboxRow[]
  loading: boolean
}) {
  return (
    <section className="mb-8">
      <h2
        className="mb-4 text-sm font-medium uppercase tracking-wider"
        style={{ color: D.textMuted }}
      >
        Rendimiento de Modelos
      </h2>
      <div
        className="overflow-hidden rounded-lg border"
        style={{ background: D.surface, borderColor: D.border }}
      >
        {sandbox.length === 0 && !loading ? (
          <EmptyState
            icon={<BarChart3 size={40} />}
            title="Sin sesiones de entrenamiento"
            subtitle="Ejecuta el primer ciclo de entrenamiento para ver resultados aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Rendimiento de modelos de inteligencia">
              <thead>
                <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                  <Th>Modelo</Th>
                  <Th align="right">Muestras</Th>
                  <Th align="right">Precision</Th>
                  <Th align="right">vs. Base</Th>
                  <Th align="right">Fecha</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${D.border}` }}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div
                            className="h-4 w-20 animate-pulse rounded"
                            style={{ background: D.surfaceHover }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  sandbox.map(row => (
                    <tr
                      key={row.id}
                      className="transition-colors duration-150"
                      style={{ borderBottom: `1px solid ${D.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = D.surfaceHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: D.text }}>
                        {MODEL_TYPE_LABELS[row.model_type] || row.model_type}
                      </td>
                      <td
                        className="px-4 py-3 text-right font-mono"
                        style={{ color: D.textSec }}
                      >
                        {row.training_samples?.toLocaleString('es-MX') ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AccuracyBadge value={row.accuracy_score} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeltaBadge value={row.improvement_delta} />
                      </td>
                      <td
                        className="px-4 py-3 text-right font-mono text-xs"
                        style={{ color: D.textMuted }}
                      >
                        {row.created_at ? fmtDateTime(row.created_at) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

/* ── Shadow Predictions Table ────────────────────────────── */

export function ShadowPredictionsTable({
  shadowLog,
  stats,
  loading,
}: {
  shadowLog: ShadowRow[]
  stats: Stats | null
  loading: boolean
}) {
  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center gap-3">
        <h2
          className="text-sm font-medium uppercase tracking-wider"
          style={{ color: D.textMuted }}
        >
          Shadow Predictions
        </h2>
        {stats?.avgShadowAccuracy != null && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-mono font-medium"
            style={{
              background: stats.avgShadowAccuracy >= 0.8 ? D.greenBg
                : stats.avgShadowAccuracy >= 0.6 ? D.amberBg
                : D.redBg,
              color: stats.avgShadowAccuracy >= 0.8 ? D.green
                : stats.avgShadowAccuracy >= 0.6 ? D.amber
                : D.red,
            }}
          >
            {(stats.avgShadowAccuracy * 100).toFixed(1)}% promedio
          </span>
        )}
      </div>
      <div
        className="overflow-hidden rounded-lg border"
        style={{ background: D.surface, borderColor: D.border }}
      >
        {shadowLog.length === 0 && !loading ? (
          <EmptyState
            icon={<Activity size={40} />}
            title="Sin predicciones shadow"
            subtitle="El Karpathy Loop generara predicciones automaticamente."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Registro de predicciones shadow">
              <thead>
                <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                  <Th>Contexto</Th>
                  <Th align="center">Resultado</Th>
                  <Th align="right">Score</Th>
                  <Th align="right">Correcciones</Th>
                  <Th align="right">Fecha</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${D.border}` }}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div
                            className="h-4 w-24 animate-pulse rounded"
                            style={{ background: D.surfaceHover }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  shadowLog.map(row => (
                    <tr
                      key={row.id}
                      className="transition-colors duration-150"
                      style={{ borderBottom: `1px solid ${D.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = D.surfaceHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td
                        className="max-w-xs truncate px-4 py-3"
                        style={{ color: D.textSec }}
                        title={row.context_summary || ''}
                      >
                        {row.context_summary || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.accepted_without_revision ? (
                          <CheckCircle2 size={16} style={{ color: D.green }} className="mx-auto" />
                        ) : row.score_overall != null && row.score_overall >= 0.6 ? (
                          <AlertTriangle size={16} style={{ color: D.amber }} className="mx-auto" />
                        ) : (
                          <XCircle size={16} style={{ color: D.red }} className="mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AccuracyBadge value={row.score_overall} />
                      </td>
                      <td
                        className="px-4 py-3 text-right font-mono"
                        style={{ color: D.textSec }}
                      >
                        {row.corrections_count ?? '—'}
                      </td>
                      <td
                        className="px-4 py-3 text-right font-mono text-xs"
                        style={{ color: D.textMuted }}
                      >
                        {row.created_at ? fmtDateTime(row.created_at) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
