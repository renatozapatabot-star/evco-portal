'use client'

/**
 * V1 Polish Pack · Block 10 — Expediente checklist.
 *
 * Renders one row per required doc type with a state icon:
 *   ✓ green   — present (high-confidence classification)
 *   ○ yellow  — uploaded but low-confidence (< 0.75) — pending review
 *   ✕ red     — missing
 *   − gray    — not required (filter-out; should not normally appear)
 *
 * Click a missing row → `onMissingDocClick(docType)` so the Documentos
 * tab can focus the DocUploader with a `defaultDocType` hint.
 *
 * Design: glass row inside a glass card, matching the ClientHome
 * cinematic system. 60px tap targets per the 3 AM Driver standard.
 */

import { CheckCircle2, Circle, XCircle, MinusCircle, Info } from 'lucide-react'
import {
  ACCENT_CYAN,
  AMBER,
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  GREEN,
  RED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { labelForDocType, type DocType } from '@/lib/doc-requirements'
import { useTrack } from '@/lib/telemetry/useTrack'

/**
 * Minimal shape the checklist reads from. Kept local so this component
 * doesn't depend on the DocumentosTab module (avoids client→client
 * import cycles through the server-component page).
 */
export interface ChecklistDocRow {
  document_type?: string | null
  document_type_confidence?: number | null
  doc_type?: string | null
}

type RowState = 'present' | 'pending' | 'missing' | 'not_required'

const CONFIDENCE_THRESHOLD = 0.75

function stateFor(docType: DocType, uploaded: ChecklistDocRow[]): RowState {
  const match = uploaded.find((d) => {
    const t = d.document_type ?? d.doc_type ?? ''
    return t === docType
  })
  if (!match) return 'missing'
  const conf = typeof match.document_type_confidence === 'number' ? match.document_type_confidence : null
  if (conf !== null && conf < CONFIDENCE_THRESHOLD) return 'pending'
  return 'present'
}

interface StateIconProps {
  state: RowState
}

function StateIcon({ state }: StateIconProps) {
  const common = { size: 18, strokeWidth: 2 }
  if (state === 'present') return <CheckCircle2 {...common} style={{ color: GREEN }} aria-label="Presente" />
  if (state === 'pending') return <Circle {...common} style={{ color: AMBER }} aria-label="Pendiente de revisión" />
  if (state === 'missing') return <XCircle {...common} style={{ color: RED }} aria-label="Faltante" />
  return <MinusCircle {...common} style={{ color: TEXT_MUTED }} aria-label="No requerido" />
}

function stateLabel(state: RowState): string {
  if (state === 'present') return 'Presente'
  if (state === 'pending') return 'Pendiente de revisión'
  if (state === 'missing') return 'Faltante'
  return 'No requerido'
}

export interface ExpedienteChecklistProps {
  requiredDocs: DocType[]
  uploadedDocs: ChecklistDocRow[]
  onMissingDocClick?: (docType: DocType) => void
}

export function ExpedienteChecklist({ requiredDocs, uploadedDocs, onMissingDocClick }: ExpedienteChecklistProps) {
  const track = useTrack()

  if (requiredDocs.length === 0) {
    // Unknown régimen or misconfigured — fail closed with a soft message.
    return (
      <div
        style={{
          background: BG_CARD,
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: '12px 16px',
          boxShadow: GLASS_SHADOW,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: TEXT_MUTED,
          fontSize: 12,
        }}
      >
        <Info size={14} />
        Régimen sin lista de documentos configurada — sube lo que tengas y clasifica manualmente.
      </div>
    )
  }

  const rows = requiredDocs.map((docType) => ({
    docType,
    state: stateFor(docType, uploadedDocs),
    label: labelForDocType(docType),
  }))

  const presentCount = rows.filter((r) => r.state === 'present').length
  const pendingCount = rows.filter((r) => r.state === 'pending').length
  const missingCount = rows.filter((r) => r.state === 'missing').length

  function handleRowClick(docType: DocType, state: RowState) {
    track('checklist_item_viewed', {
      entityType: 'doc_type',
      entityId: docType,
      metadata: { state },
    })
    if (state === 'missing' && onMissingDocClick) {
      onMissingDocClick(docType)
    }
  }

  return (
    <div
      style={{
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        padding: '14px 16px 12px',
        boxShadow: GLASS_SHADOW,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 10,
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: TEXT_MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Expediente requerido
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: TEXT_SECONDARY,
          }}
        >
          <span style={{ color: GREEN }}>{presentCount}</span>
          <span style={{ color: TEXT_MUTED }}> / </span>
          <span style={{ color: TEXT_PRIMARY }}>{rows.length}</span>
          {pendingCount > 0 && (
            <span style={{ color: AMBER, marginLeft: 10 }}>{pendingCount} pendiente{pendingCount === 1 ? '' : 's'}</span>
          )}
          {missingCount > 0 && (
            <span style={{ color: RED, marginLeft: 10 }}>{missingCount} faltante{missingCount === 1 ? '' : 's'}</span>
          )}
        </div>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map((row, i) => {
          const isInteractive = row.state === 'missing' && !!onMissingDocClick
          return (
            <button
              type="button"
              key={row.docType}
              onClick={() => handleRowClick(row.docType, row.state)}
              aria-label={`${row.label}: ${stateLabel(row.state)}`}
              style={{
                all: 'unset',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 4px',
                minHeight: 60,
                borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none',
                cursor: isInteractive ? 'pointer' : 'default',
                width: '100%',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (isInteractive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'
                }
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <StateIcon state={row.state} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: row.state === 'missing' ? TEXT_PRIMARY : TEXT_SECONDARY,
                    fontWeight: row.state === 'missing' ? 600 : 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.label}
                </div>
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                  {stateLabel(row.state)}
                </div>
              </div>
              {isInteractive && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: ACCENT_CYAN,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Subir
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
