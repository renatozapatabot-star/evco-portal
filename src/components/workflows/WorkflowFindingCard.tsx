'use client'

import { useState } from 'react'
import type { StoredFinding, WorkflowKind, WorkflowProposal } from '@/lib/workflows/types'

export interface WorkflowFindingCardProps {
  finding: StoredFinding
  role: string
  companyId: string
  thumbsSubmitted: 'up' | 'down' | null
  errorMessage: string | null
  onFeedback: (
    finding: StoredFinding,
    thumbs: 'up' | 'down',
    comment: string,
    status?: 'acknowledged' | 'dismissed' | 'resolved',
  ) => Promise<void> | void
  busy: boolean
}

const KIND_BADGES: Record<WorkflowKind, { label: string; tone: string }> = {
  missing_nom: { label: 'NOM pendiente', tone: 'var(--portal-status-amber-fg, #FBBF24)' },
  high_value_risk: { label: 'Riesgo de valor', tone: 'var(--portal-status-red-fg, #EF4444)' },
  duplicate_shipment: { label: 'Duplicado', tone: 'var(--portal-accent-silver, #C0C5CE)' },
}

const SEVERITY_TONE: Record<StoredFinding['severity'], string> = {
  info: 'rgba(192,197,206,0.5)',
  warning: 'var(--portal-status-amber-fg, #FBBF24)',
  critical: 'var(--portal-status-red-fg, #EF4444)',
}

function formatPercent(n: number): string {
  return `${Math.round(n * 100)}%`
}

function proposalHeadline(p: WorkflowProposal): string {
  switch (p.action) {
    case 'draft_mensajeria':
      return `Mensajería a ${p.recipient_label_es}`
    case 'merge_shipments':
      return `Fusionar con ${p.duplicate_trafico}`
    case 'flag_for_review':
      return 'Marcar para revisión'
    case 'none':
      return 'Sin propuesta'
  }
}

function proposalDetail(p: WorkflowProposal): string {
  switch (p.action) {
    case 'draft_mensajeria':
      return p.subject_es
    case 'merge_shipments':
      return p.rationale_es
    case 'flag_for_review':
      return p.reason_es
    case 'none':
      return p.rationale_es
  }
}

export function WorkflowFindingCard({
  finding,
  role,
  companyId: _companyId,
  thumbsSubmitted,
  errorMessage,
  onFeedback,
  busy,
}: WorkflowFindingCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [commentOpen, setCommentOpen] = useState(false)
  const [comment, setComment] = useState('')

  const kind = KIND_BADGES[finding.kind]
  const severityColor = SEVERITY_TONE[finding.severity]
  const isInternal = ['admin', 'broker', 'operator'].includes(role)

  const actionButtons = [
    {
      key: 'up' as const,
      label: '👍 Sirve',
      accent: 'var(--portal-green-2, #22C55E)',
      onClick: async () => {
        await onFeedback(finding, 'up', comment, 'acknowledged')
      },
    },
    {
      key: 'down' as const,
      label: '👎 No aplica',
      accent: 'var(--portal-status-amber-fg, #FBBF24)',
      onClick: async () => {
        await onFeedback(finding, 'down', comment, 'dismissed')
      },
    },
  ]

  const disabled = busy || thumbsSubmitted !== null

  return (
    <article
      style={{
        position: 'relative',
        borderRadius: 'var(--aguila-radius-compact, 16px)',
        border: '1px solid rgba(192,197,206,0.18)',
        background: 'rgba(0,0,0,0.25)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflow: 'hidden',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 3,
          height: '100%',
          background: severityColor,
          opacity: 0.85,
        }}
      />
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 'var(--aguila-fs-label)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(192,197,206,0.2)',
              color: kind.tone,
            }}
          >
            {kind.label}
          </span>
          <span
            style={{
              fontSize: 'var(--aguila-fs-label)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--portal-text-muted, rgba(255,255,255,0.55))',
            }}
          >
            Modo sombra
          </span>
        </div>
        <span
          className="portal-num"
          title="Confianza combinada con retroalimentación"
          style={{
            fontSize: 'var(--aguila-fs-meta)',
            color: 'var(--portal-text-secondary, rgba(232,234,237,0.7))',
          }}
        >
          {formatPercent(finding.confidence)}
        </span>
      </header>

      <div>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--aguila-fs-section)',
            fontWeight: 600,
            color: 'var(--portal-text-primary, #E8EAED)',
            letterSpacing: '-0.005em',
          }}
        >
          {finding.title_es}
        </h3>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 'var(--aguila-fs-body)',
            color: 'var(--portal-text-secondary, rgba(232,234,237,0.72))',
            lineHeight: 1.4,
          }}
        >
          {finding.detail_es}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          alignSelf: 'flex-start',
          padding: '4px 0',
          background: 'transparent',
          border: 0,
          color: 'var(--portal-accent-silver, #C0C5CE)',
          fontSize: 'var(--aguila-fs-meta)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        {expanded ? 'Ocultar detalle' : 'Ver propuesta'}
      </button>

      {expanded && (
        <div
          style={{
            borderTop: '1px dashed rgba(192,197,206,0.2)',
            paddingTop: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 'var(--aguila-fs-compact)',
            color: 'var(--portal-text-secondary, rgba(232,234,237,0.78))',
          }}
        >
          <div>
            <span
              style={{
                fontSize: 'var(--aguila-fs-label)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--portal-text-muted, rgba(255,255,255,0.55))',
                display: 'block',
              }}
            >
              Propuesta
            </span>
            <strong
              style={{
                fontSize: 'var(--aguila-fs-body)',
                color: 'var(--portal-text-primary, #E8EAED)',
                fontWeight: 600,
                display: 'block',
                marginTop: 2,
              }}
            >
              {proposalHeadline(finding.proposal)}
            </strong>
            <span style={{ display: 'block', marginTop: 4 }}>
              {proposalDetail(finding.proposal)}
            </span>
          </div>

          {finding.proposal.action === 'draft_mensajeria' && (
            <pre
              style={{
                margin: 0,
                padding: 12,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(192,197,206,0.15)',
                fontSize: 'var(--aguila-fs-compact)',
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-geist-sans, inherit)',
                color: 'var(--portal-text-secondary, rgba(232,234,237,0.78))',
              }}
            >
              {finding.proposal.body_es}
            </pre>
          )}

          {isInternal && (
            <div
              style={{
                fontSize: 'var(--aguila-fs-meta)',
                color: 'var(--portal-text-muted, rgba(255,255,255,0.55))',
              }}
            >
              Firma: <code style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}>{finding.signature}</code>
              {' · Visto '}
              <span className="portal-num">{finding.seen_count}</span>
              {finding.seen_count === 1 ? ' vez' : ' veces'}
            </div>
          )}
        </div>
      )}

      <footer
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {actionButtons.map((b) => {
            const active = thumbsSubmitted === b.key
            return (
              <button
                key={b.key}
                type="button"
                onClick={b.onClick}
                disabled={disabled}
                aria-pressed={active}
                style={{
                  minHeight: 36,
                  padding: '6px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(192,197,206,0.25)',
                  background: active ? 'rgba(192,197,206,0.12)' : 'rgba(255,255,255,0.02)',
                  color: active ? b.accent : 'var(--portal-text-primary, #E8EAED)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled && !active ? 0.55 : 1,
                  fontSize: 'var(--aguila-fs-compact)',
                  letterSpacing: '0.04em',
                  transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {b.label}
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setCommentOpen((v) => !v)}
            style={{
              minHeight: 36,
              padding: '6px 12px',
              borderRadius: 10,
              border: '1px solid rgba(192,197,206,0.15)',
              background: 'transparent',
              color: 'var(--portal-text-secondary, rgba(232,234,237,0.72))',
              cursor: 'pointer',
              fontSize: 'var(--aguila-fs-compact)',
              letterSpacing: '0.04em',
            }}
            aria-expanded={commentOpen}
          >
            {commentOpen ? 'Cerrar nota' : 'Añadir nota'}
          </button>
        </div>

        {commentOpen && (
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Cuenta por qué — entrena al detector para la próxima vez."
            style={{
              width: '100%',
              borderRadius: 10,
              border: '1px solid rgba(192,197,206,0.2)',
              background: 'rgba(0,0,0,0.2)',
              color: 'var(--portal-text-primary, #E8EAED)',
              padding: 10,
              fontSize: 'var(--aguila-fs-body)',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
            aria-label="Nota opcional"
          />
        )}

        {thumbsSubmitted && (
          <span
            style={{
              fontSize: 'var(--aguila-fs-meta)',
              color: 'var(--portal-green-2, #22C55E)',
              letterSpacing: '0.05em',
            }}
          >
            Gracias · CRUZ ajustó la confianza para futuros ciclos.
          </span>
        )}

        {errorMessage && (
          <span
            role="alert"
            style={{
              fontSize: 'var(--aguila-fs-meta)',
              color: 'var(--portal-status-amber-fg, #FBBF24)',
            }}
          >
            {errorMessage}
          </span>
        )}
      </footer>
    </article>
  )
}
