'use client'

/**
 * CRUZ · Block 6b — Live Validación + Acciones rápidas right rail.
 */

import { useMemo } from 'react'
import { usePedimento } from '@/components/pedimento/PedimentoContext'
import { TAB_LABELS_ES, type TabId, type ValidationError } from '@/lib/pedimento-types'
import { getCurrentState, getSuggestedActions } from '@/lib/events-catalog'
import { ACCENT_SILVER, ACCENT_SILVER_DIM } from '@/lib/design-system'
import { useTrack } from '@/lib/telemetry/useTrack'

const RED = '#EF4444'
const AMBER = '#F59E0B'
const GREEN = '#22C55E'

export interface RightRailProps {
  workflowEvents: Array<{ event_type: string; created_at: string }>
}

const PANEL_STYLE: React.CSSProperties = {
  padding: 20,
  borderRadius: 20,
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(192,197,206,0.18)',
  backdropFilter: 'blur(20px)',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--aguila-fs-label)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 10,
}

function groupErrorsByTab(errors: ValidationError[]): Map<TabId, ValidationError[]> {
  const map = new Map<TabId, ValidationError[]>()
  for (const err of errors) {
    const bucket = map.get(err.tab) ?? []
    bucket.push(err)
    map.set(err.tab, bucket)
  }
  return map
}

export function RightRail({ workflowEvents }: RightRailProps) {
  const { pedimentoId, validationErrors, errorsCount, warningsCount, focusField } = usePedimento()
  const track = useTrack()

  const grouped = useMemo(() => groupErrorsByTab(validationErrors), [validationErrors])

  const currentState = useMemo(() => getCurrentState(workflowEvents), [workflowEvents])
  const actions = useMemo(() => getSuggestedActions(currentState), [currentState])

  const ready = errorsCount === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
      <section style={PANEL_STYLE} aria-label="Panel de validación">
        <div style={LABEL_STYLE}>Validación</div>
        {ready ? (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: GREEN,
              fontSize: 'var(--aguila-fs-body)',
              fontWeight: 600,
            }}
          >
            Listo para validar
          </div>
        ) : (
          <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: RED }}>{errorsCount} errores</span>
            <span style={{ color: 'var(--text-muted)' }}> · </span>
            <span style={{ color: AMBER }}>{warningsCount} advertencias</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          {Array.from(grouped.entries()).map(([tab, errs]) => (
            <details key={tab} open>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: 'var(--aguila-fs-compact)',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {TAB_LABELS_ES[tab]} · {errs.length}
              </summary>
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {errs.map((err, idx) => (
                  <li key={`${err.field}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => {
                        track('page_view', {
                          metadata: {
                            event: 'pedimento_validation_error_clicked',
                            pedimentoId,
                            tab: err.tab,
                            field: err.field,
                          },
                        })
                        focusField(err.tab, err.field)
                      }}
                      style={{
                        textAlign: 'left',
                        minHeight: 44,
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: `1px solid ${err.severity === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'}`,
                        background: err.severity === 'error' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: 'var(--aguila-fs-compact)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 'var(--aguila-fs-label)',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: err.severity === 'error' ? RED : AMBER,
                        }}
                      >
                        {err.severity === 'error' ? 'Error' : 'Advertencia'} · {err.field}
                      </span>
                      <span>{err.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      <section style={PANEL_STYLE} aria-label="Acciones rápidas">
        <div style={LABEL_STYLE}>Acciones rápidas</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actions.slice(0, 5).map((a) => (
            <button
              key={a.id}
              type="button"
              title={a.event_type ?? a.label_es}
              disabled
              style={{
                textAlign: 'left',
                minHeight: 60,
                padding: '0 14px',
                background: 'rgba(192,197,206,0.06)',
                color: ACCENT_SILVER,
                border: '1px solid rgba(192,197,206,0.18)',
                borderRadius: 12,
                fontSize: 'var(--aguila-fs-body)',
                fontWeight: 500,
                cursor: 'not-allowed',
              }}
            >
              {a.label_es}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 'var(--aguila-fs-label)', color: ACCENT_SILVER_DIM }}>
          {currentState
            ? `Último evento: ${currentState}`
            : 'Sin eventos todavía'}
        </div>
      </section>
    </div>
  )
}
