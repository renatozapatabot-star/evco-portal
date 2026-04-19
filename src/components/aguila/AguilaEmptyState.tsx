'use client'

/**
 * AguilaEmptyState — icon + message + action, never blank.
 *
 * Chrome audit 2026-04-19: /health, /catalogo (PREVIEW state), and
 * /expedientes (Sin documentos) all rendered icon+message empty states
 * without action buttons. Rule 8 canonical shape: icon + message +
 * primary action. Three pages, one primitive fixes them all.
 *
 * Used as a drop-in replacement for ad-hoc empty-state markup. Renders
 * inside a <GlassCard> so spacing and chrome match the rest of the
 * portal automatically.
 *
 * Tone:
 *   default — neutral silver icon, white message, gold CTA
 *   calm    — muted silver, quieter copy, ghost CTA ("todo al corriente")
 *   urgent  — amber icon, amber CTA (for "falta algo, hazlo ahora")
 *
 * Usage:
 *   <AguilaEmptyState
 *     icon="📁"
 *     title="Sin documentos"
 *     message="Adjunta factura o packing list cuando Mario te envíe."
 *     action={{ label: 'Subir documento', href: '/docs/upload' }}
 *   />
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

import { GlassCard } from './GlassCard'

export type EmptyStateTone = 'default' | 'calm' | 'urgent'

export interface AguilaEmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

export interface AguilaEmptyStateProps {
  /** Icon or emoji rendered at the top — 32-48px equivalent. */
  icon?: ReactNode
  /** One-line headline. Keep < 60 chars. */
  title: string
  /** Two-line context under the title. Keep < 160 chars. */
  message?: ReactNode
  /** Primary forward-moving action. Optional for calm/informational states. */
  action?: AguilaEmptyStateAction
  /** Secondary action, usually a documentation link. */
  secondaryAction?: AguilaEmptyStateAction
  /** Visual tone — see component docs. */
  tone?: EmptyStateTone
  /** Wrap in <GlassCard> (default) or render bare markup (for already-carded parents). */
  bare?: boolean
}

const TONE_CFG: Record<EmptyStateTone, { iconColor: string; actionColor: string; actionBg: string; actionRing: string }> = {
  default: {
    iconColor: 'var(--portal-fg-3)',
    actionColor: 'var(--portal-ink-0)',
    actionBg: 'var(--portal-gold-500)',
    actionRing: 'var(--portal-gold-600)',
  },
  calm: {
    iconColor: 'var(--portal-fg-4)',
    actionColor: 'var(--portal-fg-2)',
    actionBg: 'rgba(255,255,255,0.04)',
    actionRing: 'var(--portal-line-2)',
  },
  urgent: {
    iconColor: 'var(--portal-status-amber-fg)',
    actionColor: 'var(--portal-ink-0)',
    actionBg: 'var(--portal-status-amber-fg)',
    actionRing: 'var(--portal-status-amber-ring)',
  },
}

export function AguilaEmptyState({
  icon,
  title,
  message,
  action,
  secondaryAction,
  tone = 'default',
  bare = false,
}: AguilaEmptyStateProps) {
  const cfg = TONE_CFG[tone]
  const inner = (
    <div
      style={{
        textAlign: 'center',
        padding: '32px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {icon ? (
        <div
          aria-hidden
          style={{
            fontSize: 'var(--aguila-fs-kpi-mid, 32px)',
            color: cfg.iconColor,
            marginBottom: 6,
            lineHeight: 1,
          }}
        >
          {icon}
        </div>
      ) : null}
      <h2
        style={{
          fontSize: 'var(--aguila-fs-section, 14px)',
          fontWeight: 600,
          color: 'var(--portal-fg-1)',
          margin: 0,
        }}
      >
        {title}
      </h2>
      {message ? (
        <p
          style={{
            fontSize: 'var(--aguila-fs-body, 13px)',
            color: 'var(--portal-fg-4)',
            margin: 0,
            maxWidth: 420,
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
      ) : null}
      {(action || secondaryAction) ? (
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 12,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {action ? renderAction(action, cfg, 'primary') : null}
          {secondaryAction ? renderAction(secondaryAction, cfg, 'secondary') : null}
        </div>
      ) : null}
    </div>
  )

  if (bare) return inner
  return <GlassCard tier="secondary">{inner}</GlassCard>
}

function renderAction(
  action: AguilaEmptyStateAction,
  cfg: typeof TONE_CFG[EmptyStateTone],
  variant: 'primary' | 'secondary',
): ReactNode {
  const isPrimary = variant === 'primary'
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 44,
    padding: '0 18px',
    borderRadius: 10,
    fontSize: 'var(--aguila-fs-body, 13px)',
    fontWeight: 600,
    letterSpacing: '0.02em',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'transform var(--portal-dur-1) var(--portal-ease-out), background var(--portal-dur-1) var(--portal-ease-out)',
    ...(isPrimary
      ? {
          background: cfg.actionBg,
          color: cfg.actionColor,
          border: `1px solid ${cfg.actionRing}`,
        }
      : {
          background: 'transparent',
          color: 'var(--portal-fg-3)',
          border: '1px solid var(--portal-line-2)',
        }),
  } as const

  if (action.href) {
    return (
      <Link href={action.href} style={style}>
        {action.label}
      </Link>
    )
  }
  return (
    <button type="button" onClick={action.onClick} style={style}>
      {action.label}
    </button>
  )
}
