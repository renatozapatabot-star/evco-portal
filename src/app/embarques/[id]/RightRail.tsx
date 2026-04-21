'use client'

import { useState, useTransition } from 'react'
import * as LucideIcons from 'lucide-react'
import {
  ACCENT_SILVER,
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  GOLD,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { useToast } from '@/components/Toast'
import { useTrack } from '@/lib/telemetry/useTrack'
import { fmtDateTime } from '@/lib/format-utils'
import {
  EVENT_CATEGORY_COLORS,
  getCurrentState,
  getSuggestedActions,
  type SuggestedAction,
} from '@/lib/events-catalog'
import { fireLifecycleEvent, assignOperator } from './actions'
import type { EventRow, AvailableUserLite } from './types'

type LucideIconName = keyof typeof LucideIcons

interface RightRailProps {
  traficoId: string
  events: EventRow[]
  isInternal: boolean
  /** Role of the signed-in session. Client surfaces suppress the entire
   *  Acciones rápidas panel; operator/admin/broker keep it with
   *  existing isInternal-driven enable/disable. */
  role: string
  clientName: string
  clientRfc: string | null
  clientAduana: string | null
  clientPatente: string | null
  proveedorName: string | null
  assignedOperator: string | null
  availableOperators: AvailableUserLite[]
  createdAt: string | null
  expedienteProgressPct: number
  onRequestAddNote: () => void
}

/**
 * Right rail — exactly two panels, 340px fixed column. Panel 1 is
 * state-machine driven; panel 2 is static context. No scroll beyond
 * the column — scroll lives inside the tab panel.
 */
export function RightRail(props: RightRailProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Acciones rápidas is hidden for client role (invariant #24 — the
          absence of the panel IS the read-only signal; no disclaimer
          needed). Operator/admin/broker still see it; enable/disable
          of individual buttons is driven by isInternal (existing). */}
      {props.role !== 'client' && <AccionesRapidas {...props} />}
      <InformacionLateral {...props} />
    </div>
  )
}

function AccionesRapidas({
  traficoId,
  events,
  isInternal,
  onRequestAddNote,
}: RightRailProps) {
  const currentState = getCurrentState(
    events.map((e) => ({ event_type: e.event_type, created_at: e.created_at })),
  )
  const actions = getSuggestedActions(currentState)
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast } = useToast()
  const track = useTrack()

  function run(action: SuggestedAction) {
    if (!isInternal) {
      toast('Solo operadores pueden emitir eventos', 'info')
      return
    }

    // ACTION_ADD_NOTE: hand off to Notas tab composer (no event fired here).
    if (action.id === 'add_note') {
      onRequestAddNote()
      track('page_view', {
        entityType: 'trafico_action',
        entityId: traficoId,
        metadata: {
          event: 'action_fired',
          action_id: action.id,
          current_state: currentState,
        },
      })
      return
    }

    const eventType = action.event_type
    if (!eventType) {
      toast('Esta acción necesita configurarse primero', 'info')
      return
    }

    setBusyId(action.id)
    startTransition(async () => {
      const res = await fireLifecycleEvent(traficoId, eventType)
      setBusyId(null)
      if (!res.ok) {
        toast(`No se pudo emitir el evento: ${res.error}`, 'error')
        return
      }
      track('page_view', {
        entityType: 'trafico_action',
        entityId: traficoId,
        metadata: {
          event: 'action_fired',
          action_id: action.id,
          event_type: eventType,
          current_state: currentState,
        },
      })
      toast(`Evento emitido: ${action.label_es}`, 'success')
    })
  }

  return (
    <div style={panelStyle}>
      <PanelTitle>Acciones rápidas</PanelTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {actions.map((a) => {
          const Icon = resolveIcon(a.icon)
          const categoryColor = EVENT_CATEGORY_COLORS[a.category]
          const isBusy = busyId === a.id && pending
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => run(a)}
              disabled={isBusy || (!isInternal && a.id !== 'add_note')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minHeight: 60,
                padding: '0 14px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${categoryColor}33`,
                borderRadius: 12,
                color: TEXT_PRIMARY,
                fontSize: 'var(--aguila-fs-body)',
                fontWeight: 600,
                cursor: isBusy ? 'wait' : 'pointer',
                textAlign: 'left',
                opacity: isBusy ? 0.6 : 1,
                width: '100%',
              }}
            >
              {Icon && <Icon size={16} style={{ color: categoryColor, flexShrink: 0 }} />}
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {a.label_es}
              </span>
            </button>
          )
        })}
      </div>

      {/* "Vista solo lectura para clientes" subtitle removed — the whole
          AccionesRapidas panel no longer renders for clients (outer
          gate in RightRail), so the disclaimer would never be seen
          anyway. Its presence was a code smell that invited regressions. */}
    </div>
  )
}

function InformacionLateral({
  traficoId,
  isInternal,
  clientName,
  clientRfc,
  clientAduana,
  clientPatente,
  proveedorName,
  assignedOperator,
  availableOperators,
  createdAt,
  expedienteProgressPct,
}: RightRailProps) {
  const [operator, setOperator] = useState(assignedOperator ?? '')
  const [pending, startTransition] = useTransition()
  const { toast } = useToast()
  const track = useTrack()

  function commitOperator(next: string) {
    if (!next || next === operator) return
    startTransition(async () => {
      const res = await assignOperator(traficoId, next)
      if (!res.ok) {
        toast(`No se pudo asignar: ${res.error}`, 'error')
        return
      }
      setOperator(next)
      track('page_view', {
        entityType: 'trafico_action',
        entityId: traficoId,
        metadata: { event: 'action_fired', action_id: 'assign_operator' },
      })
      toast('Operador asignado', 'success')
    })
  }

  return (
    <div style={panelStyle}>
      <PanelTitle>Información</PanelTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <InfoField label="Cliente" value={clientName} mono={false} />
        {clientRfc && <InfoField label="RFC" value={clientRfc} mono />}
        {(clientPatente || clientAduana) && (
          <InfoField
            label="Patente / Aduana"
            value={`${clientPatente ?? '—'} / ${clientAduana ?? '—'}`}
            mono
          />
        )}
        <InfoField label="Proveedor principal" value={proveedorName ?? 'Sin proveedor principal'} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>Operador asignado</span>
          {isInternal && availableOperators.length > 0 ? (
            <select
              value={operator}
              onChange={(e) => commitOperator(e.target.value)}
              disabled={pending}
              style={{
                minHeight: 60,
                padding: '0 14px',
                background: 'rgba(0,0,0,0.3)',
                color: TEXT_PRIMARY,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                fontSize: 'var(--aguila-fs-body)',
                cursor: pending ? 'wait' : 'pointer',
              }}
            >
              <option value="">Sin asignar</option>
              {availableOperators.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          ) : (
            <span style={valueStyle(false)}>{operator || 'Sin asignar'}</span>
          )}
        </div>

        <InfoField
          label="Creado"
          value={createdAt ? fmtDateTime(createdAt) : 'Sin registro'}
          mono
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>Expediente</span>
          <div
            aria-label={`Expediente ${expedienteProgressPct}% completo`}
            style={{
              height: 8,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, expedienteProgressPct))}%`,
                height: '100%',
                background: expedienteProgressPct >= 100 ? GOLD : ACCENT_SILVER,
              }}
            />
          </div>
          <span
            style={{
              fontSize: 'var(--aguila-fs-meta)',
              color: TEXT_SECONDARY,
              fontFamily: 'var(--font-mono)',
              textAlign: 'right',
            }}
          >
            {expedienteProgressPct}%
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: BG_CARD,
  backdropFilter: `blur(${GLASS_BLUR})`,
  WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
  border: `1px solid ${BORDER}`,
  borderRadius: 20,
  padding: '16px 20px',
  boxShadow: GLASS_SHADOW,
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 'var(--aguila-fs-meta)',
        fontWeight: 800,
        color: TEXT_MUTED,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  )
}

function valueStyle(mono: boolean): React.CSSProperties {
  return {
    fontSize: 'var(--aguila-fs-body)',
    color: TEXT_PRIMARY,
    fontFamily: mono ? 'var(--font-mono)' : undefined,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>{label}</span>
      <span style={valueStyle(Boolean(mono))}>{value}</span>
    </div>
  )
}

// Dynamic lucide-react lookup. Narrowed against the module's export map
// so bogus icon names return null instead of rendering arbitrary refs.
function resolveIcon(name: string | null | undefined): React.ComponentType<{ size?: number; style?: React.CSSProperties }> | null {
  if (!name) return null
  const pascal = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  const key = pascal as LucideIconName
  const Comp = LucideIcons[key] as unknown
  if (typeof Comp === 'function' || (typeof Comp === 'object' && Comp !== null)) {
    return Comp as React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  }
  return null
}
