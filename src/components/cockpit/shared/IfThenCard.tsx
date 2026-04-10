'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export type IfThenCardState = 'quiet' | 'active' | 'urgent'

export interface IfThenCardProps {
  id: string
  state: IfThenCardState
  title: string
  icon?: ReactNode
  quietContent: ReactNode
  activeCondition?: string
  activeAction?: string
  urgentCondition?: string
  urgentAction?: string
  actionHref?: string
  onAction?: () => void
  footer?: ReactNode
  /** Card has been cleared/resolved by an operator */
  cleared?: boolean
  clearedAt?: string
  clearedBy?: string
  /** Show a "Marcar limpia" button when provided */
  onClear?: () => void
}

const STATE_STYLES: Record<IfThenCardState | 'cleared', {
  border: string; borderTop: string; conditionColor: string; actionBg: string
}> = {
  quiet: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderTop: '3px solid rgba(201,168,76,0.4)',
    conditionColor: '#8B949E',
    actionBg: 'rgba(255,255,255,0.06)',
  },
  active: {
    border: '1px solid rgba(201,168,76,0.3)',
    borderTop: '3px solid rgba(201,168,76,0.6)',
    conditionColor: '#C9A84C',
    actionBg: 'rgba(201,168,76,0.15)',
  },
  urgent: {
    border: '1px solid rgba(217,119,6,0.4)',
    borderTop: '3px solid rgba(217,119,6,0.7)',
    conditionColor: '#D97706',
    actionBg: 'rgba(217,119,6,0.15)',
  },
  cleared: {
    border: '1px solid rgba(22,163,74,0.25)',
    borderTop: '3px solid rgba(22,163,74,0.4)',
    conditionColor: '#16A34A',
    actionBg: 'rgba(22,163,74,0.1)',
  },
}

export function IfThenCard({
  id, state, title, icon, quietContent,
  activeCondition, activeAction, urgentCondition, urgentAction,
  actionHref, onAction, footer,
  cleared, clearedAt, clearedBy, onClear,
}: IfThenCardProps) {
  const effectiveState = cleared ? 'cleared' : state
  const s = STATE_STYLES[effectiveState]
  const condition = state === 'urgent' ? (urgentCondition || activeCondition) : activeCondition
  const action = state === 'urgent' ? (urgentAction || activeAction) : activeAction
  const isActionable = !cleared && state !== 'quiet' && condition && action

  // Cleared state rendering
  if (cleared) {
    return (
      <div
        data-card-id={id}
        data-card-state="cleared"
        style={{
          background: 'rgba(22,163,74,0.04)',
          borderRadius: 14,
          border: s.border,
          borderTop: s.borderTop,
          padding: 16,
          opacity: 0.7,
          transition: 'all 300ms ease',
          position: 'relative',
        }}
      >
        {/* Checkmark */}
        <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 16, color: '#16A34A' }}>✓</div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#16A34A' }}>
            {title} — limpiada
          </span>
        </div>
        <div style={{ color: '#6E7681', fontSize: 12 }}>
          {quietContent}
        </div>
        {(clearedBy || clearedAt) && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#6E7681' }}>
            {clearedBy && <span>{clearedBy}</span>}
            {clearedAt && <span> · {clearedAt}</span>}
          </div>
        )}
      </div>
    )
  }

  const actionButton = isActionable ? (
    actionHref ? (
      <Link href={actionHref} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '10px 16px', borderRadius: 8,
        background: s.actionBg, color: s.conditionColor,
        fontSize: 13, fontWeight: 600, textDecoration: 'none',
        minHeight: 44, marginTop: 8,
        border: `1px solid ${state === 'urgent' ? 'rgba(217,119,6,0.3)' : 'rgba(201,168,76,0.2)'}`,
      }}>
        {action} →
      </Link>
    ) : onAction ? (
      <button onClick={onAction} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', padding: '10px 16px', borderRadius: 8,
        background: s.actionBg, color: s.conditionColor,
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        minHeight: 44, marginTop: 8, border: `1px solid ${state === 'urgent' ? 'rgba(217,119,6,0.3)' : 'rgba(201,168,76,0.2)'}`,
      }}>
        {action} →
      </button>
    ) : null
  ) : null

  return (
    <div
      data-card-id={id}
      data-card-state={effectiveState}
      className={state === 'urgent' ? 'aduana-pulse-subtle' : undefined}
      style={{
        background: '#222222',
        borderRadius: 14,
        border: s.border,
        borderTop: s.borderTop,
        padding: 16,
        transition: 'border-color 200ms ease',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: condition && state !== 'quiet' ? 8 : 12,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: state === 'quiet' ? '#6E7681' : s.conditionColor,
        }}>
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Clear button for operators */}
          {onClear && state !== 'quiet' && (
            <button onClick={onClear} style={{
              fontSize: 10, fontWeight: 600, color: '#16A34A',
              background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)',
              borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              ✓ Limpia
            </button>
          )}
          {icon && <span style={{ color: '#6E7681' }}>{icon}</span>}
        </div>
      </div>

      {/* Condition line */}
      {isActionable && (
        <div style={{
          fontSize: 14, fontWeight: 600, color: s.conditionColor,
          marginBottom: 6, lineHeight: 1.4,
        }}>
          {condition}
        </div>
      )}

      {/* Content */}
      <div style={{
        color: state === 'quiet' ? '#E6EDF3' : '#8B949E',
        fontSize: state === 'quiet' ? 14 : 12,
      }}>
        {quietContent}
      </div>

      {/* Action button */}
      {actionButton}

      {/* Footer */}
      {footer && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#6E7681' }}>
          {footer}
        </div>
      )}
    </div>
  )
}
