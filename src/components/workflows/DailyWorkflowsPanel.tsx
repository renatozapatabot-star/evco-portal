'use client'

import { useMemo, useState, useTransition } from 'react'
import { GlassCard } from '@/components/aguila/GlassCard'
import type { StoredFinding, WorkflowKind } from '@/lib/workflows/types'
import type { WorkflowSummary } from '@/lib/workflows/query'
import { WorkflowFindingCard } from './WorkflowFindingCard'

export interface DailyWorkflowsPanelProps {
  companyId: string
  role: string
  findings: StoredFinding[]
  summary: WorkflowSummary
}

interface FeedbackState {
  id: string
  thumbs: 'up' | 'down'
}

const KIND_LABELS: Record<WorkflowKind, string> = {
  missing_nom: 'NOM pendientes',
  high_value_risk: 'Riesgos de valor',
  duplicate_shipment: 'Posibles duplicados',
}

const FILTER_ORDER: Array<WorkflowKind | 'all'> = [
  'all',
  'missing_nom',
  'high_value_risk',
  'duplicate_shipment',
]

function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

export function DailyWorkflowsPanel({
  companyId,
  role,
  findings: initialFindings,
  summary,
}: DailyWorkflowsPanelProps) {
  const [findings, setFindings] = useState<StoredFinding[]>(initialFindings)
  const [filter, setFilter] = useState<WorkflowKind | 'all'>('all')
  const [submitted, setSubmitted] = useState<Map<string, FeedbackState>>(new Map())
  const [errorById, setErrorById] = useState<Map<string, string>>(new Map())
  const [isPending, startTransition] = useTransition()

  const visibleFindings = useMemo(() => {
    if (filter === 'all') return findings
    return findings.filter((f) => f.kind === filter)
  }, [findings, filter])

  const counts = useMemo(() => {
    const by: Record<WorkflowKind, number> = {
      missing_nom: 0,
      high_value_risk: 0,
      duplicate_shipment: 0,
    }
    for (const f of findings) by[f.kind] = (by[f.kind] ?? 0) + 1
    return by
  }, [findings])

  async function submitFeedback(
    finding: StoredFinding,
    thumbs: 'up' | 'down',
    comment: string,
    status?: 'acknowledged' | 'dismissed' | 'resolved',
  ) {
    setErrorById((prev) => {
      const next = new Map(prev)
      next.delete(finding.id)
      return next
    })

    // Optimistic — record feedback locally immediately; rollback on error.
    const previousSubmitted = submitted
    setSubmitted((prev) => {
      const next = new Map(prev)
      next.set(finding.id, { id: finding.id, thumbs })
      return next
    })

    try {
      const res = await fetch('/api/workflows/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finding_id: finding.id,
          thumbs,
          comment_es: comment.trim().length > 0 ? comment.trim() : undefined,
          status,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(body?.error?.message ?? 'No pudimos guardar la retro.')
      }
      if (status) {
        startTransition(() => {
          setFindings((prev) => prev.filter((f) => f.id !== finding.id))
        })
      }
    } catch (e) {
      setSubmitted(previousSubmitted)
      setErrorById((prev) => {
        const next = new Map(prev)
        next.set(finding.id, e instanceof Error ? e.message : 'Error inesperado')
        return next
      })
    }
  }

  const header = (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div
          className="portal-eyebrow"
          style={{
            color: 'var(--portal-text-muted, rgba(255,255,255,0.6))',
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          Flujos diarios · Modo sombra
        </div>
        <h2
          style={{
            fontSize: 'var(--aguila-fs-title, 24px)',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--portal-text-primary, #E8EAED)',
            margin: '4px 0 0',
          }}
        >
          Lo que CRUZ vigila hoy
        </h2>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 13,
            color: 'var(--portal-text-secondary, rgba(255,255,255,0.64))',
            maxWidth: 520,
          }}
        >
          {summary.total === 0
            ? 'Sin alertas activas. CRUZ sigue revisando cada 5 minutos.'
            : `CRUZ detectó ${summary.total} ${pluralize(summary.total, 'señal', 'señales')} en los últimos ciclos. ` +
              'Todas en modo sombra — nada se envía sin autorización.'}
        </p>
      </div>
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 999,
          border: '1px solid rgba(192,197,206,0.25)',
          background: 'rgba(255,255,255,0.04)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--portal-text-secondary, rgba(232,234,237,0.78))',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: 'var(--portal-status-amber-fg, #FBBF24)',
            boxShadow: '0 0 8px rgba(251,191,36,0.6)',
          }}
        />
        Sin acción automática
      </div>
    </div>
  )

  const filters = (
    <div
      role="tablist"
      aria-label="Filtro de flujos"
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginTop: 16,
      }}
    >
      {FILTER_ORDER.map((key) => {
        const active = key === filter
        const label =
          key === 'all' ? 'Todo' : KIND_LABELS[key]
        const count =
          key === 'all' ? findings.length : counts[key]
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setFilter(key)}
            style={{
              minHeight: 36,
              padding: '6px 14px',
              borderRadius: 999,
              border: active
                ? '1px solid rgba(192,197,206,0.55)'
                : '1px solid rgba(192,197,206,0.18)',
              background: active
                ? 'rgba(192,197,206,0.10)'
                : 'rgba(255,255,255,0.02)',
              color: active
                ? 'var(--portal-text-primary, #E8EAED)'
                : 'var(--portal-text-secondary, rgba(232,234,237,0.70))',
              cursor: 'pointer',
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {label}
            <span
              className="portal-num"
              style={{
                marginLeft: 8,
                fontSize: 11,
                opacity: 0.75,
              }}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )

  const empty = (
    <div
      style={{
        padding: '20px 12px',
        textAlign: 'center',
        color: 'var(--portal-text-secondary, rgba(255,255,255,0.64))',
        fontSize: 13,
      }}
    >
      {filter === 'all'
        ? 'Todo en orden · CRUZ no encontró alertas en este ciclo.'
        : 'Ningún hallazgo de este tipo en los últimos ciclos.'}
    </div>
  )

  return (
    <GlassCard tier="hero" padding={20} ariaLabel="Flujos diarios · Modo sombra">
      {header}
      {findings.length > 0 && filters}
      <div
        style={{
          display: 'grid',
          gap: 12,
          marginTop: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        {visibleFindings.length === 0
          ? empty
          : visibleFindings.map((f) => (
              <WorkflowFindingCard
                key={f.id}
                finding={f}
                role={role}
                companyId={companyId}
                thumbsSubmitted={submitted.get(f.id)?.thumbs ?? null}
                errorMessage={errorById.get(f.id) ?? null}
                onFeedback={submitFeedback}
                busy={isPending}
              />
            ))}
      </div>
    </GlassCard>
  )
}
