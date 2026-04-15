'use client'

/**
 * Block 4 · Supplier Doc Solicitation Polish — ExpedienteChecklist (extended).
 *
 * Originally shipped in V1 Polish Block 10 as a flat list of `DocType[]`.
 * Block 4 extends it to:
 *   - Accept catalog codes (strings) in addition to legacy DocType[]
 *   - Group rows by DocCategory when the catalog is in use
 *   - Apply 5-state color semantics: required+missing → gold, required+received → cyan,
 *     required+verified → cyan+check, optional+missing → muted, optional+received → cyan
 *
 * Legacy DocType[] path is preserved (translated via `mapLegacyDocType`). The
 * 9 consumers of doc-requirements.ts keep compiling.
 */

import { CheckCircle2, Circle, XCircle, MinusCircle, Info } from 'lucide-react'
import {
  ACCENT_SILVER,
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
  GOLD,
} from '@/lib/design-system'
import type { DocType } from '@/lib/doc-requirements'
import {
  getDocumentTypeByCode,
  labelForDocCode,
  mapLegacyDocType,
  type DocCategory,
} from '@/lib/document-types'
import { labelForDocType } from '@/lib/doc-requirements'
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
  doc_type_code?: string | null
  verified?: boolean | null
}

type RowState = 'verified' | 'received' | 'pending' | 'missing' | 'not_required'

const CONFIDENCE_THRESHOLD = 0.75

const CATEGORY_LABELS: Record<DocCategory, string> = {
  COMERCIAL: 'Comercial',
  TRANSPORTE: 'Transporte',
  ORIGEN: 'Origen',
  REGULATORIO: 'Regulatorio',
  TECNICO: 'Técnico',
  FISCAL: 'Fiscal',
  ADUANAL: 'Aduanal',
  FINANCIERO: 'Financiero',
  OTROS: 'Otros',
}

function stateForCode(code: string, uploaded: ChecklistDocRow[]): RowState {
  const match = uploaded.find((d) => {
    const t = d.doc_type_code ?? d.document_type ?? d.doc_type ?? ''
    // Accept legacy slugs too — they map forward to catalog codes.
    return t === code || mapLegacyDocType(t) === code
  })
  if (!match) return 'missing'
  if (match.verified === true) return 'verified'
  const conf = typeof match.document_type_confidence === 'number' ? match.document_type_confidence : null
  if (conf !== null && conf < CONFIDENCE_THRESHOLD) return 'pending'
  return 'received'
}

function StateIcon({ state, required }: { state: RowState; required: boolean }) {
  const common = { size: 18, strokeWidth: 2 }
  if (state === 'verified') return <CheckCircle2 {...common} style={{ color: ACCENT_SILVER }} aria-label="Verificado" />
  if (state === 'received') return <CheckCircle2 {...common} style={{ color: ACCENT_SILVER }} aria-label="Recibido" />
  if (state === 'pending') return <Circle {...common} style={{ color: AMBER }} aria-label="Pendiente de revisión" />
  if (state === 'missing')
    return required ? (
      <XCircle {...common} style={{ color: GOLD }} aria-label="Faltante requerido" />
    ) : (
      <MinusCircle {...common} style={{ color: TEXT_MUTED }} aria-label="Faltante opcional" />
    )
  return <MinusCircle {...common} style={{ color: TEXT_MUTED }} aria-label="No requerido" />
}

function stateLabel(state: RowState, required: boolean): string {
  if (state === 'verified') return 'Verificado'
  if (state === 'received') return 'Recibido'
  if (state === 'pending') return 'Pendiente de revisión'
  if (state === 'missing') return required ? 'Faltante · requerido' : 'Faltante'
  return 'No requerido'
}

export interface ExpedienteChecklistProps {
  /**
   * Either legacy `DocType[]` (will auto-map via `mapLegacyDocType`) or
   * catalog codes (strings). Both paths render correctly; catalog paths
   * additionally group rows by category.
   */
  requiredDocs: Array<DocType | string>
  uploadedDocs: ChecklistDocRow[]
  onMissingDocClick?: (docCode: string) => void
  /** When true, render grouped by DocCategory. Default: true when codes are catalog-resolvable. */
  grouped?: boolean
}

export function ExpedienteChecklist({
  requiredDocs,
  uploadedDocs,
  onMissingDocClick,
  grouped,
}: ExpedienteChecklistProps) {
  const track = useTrack()

  if (requiredDocs.length === 0) {
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
          fontSize: 'var(--aguila-fs-compact)',
        }}
      >
        <Info size={14} />
        Régimen sin lista de documentos configurada — sube lo que tengas y clasifica manualmente.
      </div>
    )
  }

  // Normalize input to catalog codes, remembering originals for fallback labels.
  const rows = requiredDocs.map((d) => {
    const code = mapLegacyDocType(d)
    const entry = getDocumentTypeByCode(code)
    const label = entry?.name_es ?? labelForDocCode(code) ?? labelForDocType(String(d))
    const state = stateForCode(code, uploadedDocs)
    return {
      code,
      label,
      category: entry?.category ?? ('OTROS' as DocCategory),
      required: entry?.required ?? true,
      state,
    }
  })

  const presentCount = rows.filter((r) => r.state === 'received' || r.state === 'verified').length
  const pendingCount = rows.filter((r) => r.state === 'pending').length
  const missingCount = rows.filter((r) => r.state === 'missing').length

  const shouldGroup = grouped ?? rows.some((r) => r.category !== 'OTROS')

  function handleRowClick(code: string, state: RowState) {
    track('checklist_item_viewed', {
      entityType: 'doc_type',
      entityId: code,
      metadata: { state },
    })
    if (state === 'missing' && onMissingDocClick) {
      onMissingDocClick(code)
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
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontSize: 'var(--aguila-fs-meta)',
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
            fontSize: 'var(--aguila-fs-meta)',
            color: TEXT_SECONDARY,
          }}
        >
          <span style={{ color: GREEN }}>{presentCount}</span>
          <span style={{ color: TEXT_MUTED }}> / </span>
          <span style={{ color: TEXT_PRIMARY }}>{rows.length}</span>
          {pendingCount > 0 && (
            <span style={{ color: AMBER, marginLeft: 10 }}>
              {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
            </span>
          )}
          {missingCount > 0 && (
            <span style={{ color: GOLD, marginLeft: 10 }}>
              {missingCount} faltante{missingCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {shouldGroup ? (
        <GroupedRows rows={rows} onRowClick={handleRowClick} />
      ) : (
        <FlatRows rows={rows} onRowClick={handleRowClick} />
      )}
    </div>
  )
}

type Row = {
  code: string
  label: string
  category: DocCategory
  required: boolean
  state: RowState
}

function GroupedRows({
  rows,
  onRowClick,
}: {
  rows: Row[]
  onRowClick: (code: string, state: RowState) => void
}) {
  const byCat = new Map<DocCategory, Row[]>()
  for (const r of rows) {
    const list = byCat.get(r.category) ?? []
    list.push(r)
    byCat.set(r.category, list)
  }
  const cats = Array.from(byCat.keys())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {cats.map((cat) => (
        <div key={cat}>
          <div
            style={{
              fontSize: 'var(--aguila-fs-label)',
              fontWeight: 800,
              color: TEXT_MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 4,
              padding: '0 4px',
            }}
          >
            {CATEGORY_LABELS[cat]}
          </div>
          <FlatRows rows={byCat.get(cat) ?? []} onRowClick={onRowClick} />
        </div>
      ))}
    </div>
  )
}

function FlatRows({
  rows,
  onRowClick,
}: {
  rows: Row[]
  onRowClick: (code: string, state: RowState) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {rows.map((row, i) => {
        const isInteractive = row.state === 'missing'
        const borderLeft =
          row.state === 'missing' && row.required ? `3px solid ${GOLD}` : 'none'
        return (
          <button
            type="button"
            key={row.code}
            onClick={() => onRowClick(row.code, row.state)}
            aria-label={`${row.label}: ${stateLabel(row.state, row.required)}`}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 4px 0 8px',
              paddingLeft: borderLeft === 'none' ? 4 : 8,
              minHeight: 60,
              borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none',
              borderLeft,
              cursor: isInteractive ? 'pointer' : 'default',
              width: '100%',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => {
              if (isInteractive) {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'
              }
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <StateIcon state={row.state} required={row.required} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 'var(--aguila-fs-body)',
                  color:
                    row.state === 'missing' && row.required
                      ? TEXT_PRIMARY
                      : row.state === 'missing'
                        ? TEXT_MUTED
                        : TEXT_SECONDARY,
                  fontWeight: row.state === 'missing' && row.required ? 700 : 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.label}
              </div>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 2 }}>
                {stateLabel(row.state, row.required)}
              </div>
            </div>
            {isInteractive && (
              <span
                style={{
                  fontSize: 'var(--aguila-fs-meta)',
                  fontWeight: 700,
                  color: ACCENT_SILVER,
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
  )
}

// Silence lint for unused imports that might be pruned.
void RED
