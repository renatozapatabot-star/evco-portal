'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FileText, Truck, Package, CreditCard, Flag, FileCheck, ClipboardList, Circle,
  CheckCircle2, Clock, AlertTriangle, X,
} from 'lucide-react'
import {
  computeMilestones,
  formatRelative,
  formatAbsolute,
  formatCompactDate,
  type Milestone,
  type MilestoneIcon,
  type MilestoneStatus,
  type TimelineInput,
} from './timeline-logic'
import { TraficoTimelineVertical } from './TraficoTimelineVertical'

/**
 * Trafico timeline — HORIZONTAL one-screen rail (default renderer).
 *
 * Seven milestones laid out side-to-side on 393px mobile so the whole
 * embarque progress fits one screen. Tap a node → bottom-sheet drawer
 * opens with the same detail the vertical cards showed inline.
 *
 * Rollback: set `NEXT_PUBLIC_TIMELINE_HORIZONTAL='0'` to delegate to the
 * vertical fallback without a code change.
 *
 * All milestone logic lives in `./timeline-logic.ts` — this file is
 * render + interaction only.
 */

export type { Milestone, MilestoneStatus, TimelineInput }
export { computeMilestones }

const HORIZONTAL_ENABLED =
  (process.env.NEXT_PUBLIC_TIMELINE_HORIZONTAL ?? '1') !== '0'

export function TraficoTimeline({ input }: { input: TimelineInput }) {
  if (!HORIZONTAL_ENABLED) return <TraficoTimelineVertical input={input} />
  return <TraficoTimelineHorizontal input={input} />
}

function IconFor({ icon, size = 16 }: { icon: MilestoneIcon; size?: number }) {
  const common = { size, strokeWidth: 1.8 } as const
  switch (icon) {
    case 'create':    return <FileText {...common} />
    case 'route':     return <Truck {...common} />
    case 'warehouse': return <Package {...common} />
    case 'docs':      return <ClipboardList {...common} />
    case 'payment':   return <CreditCard {...common} />
    case 'cross':     return <Flag {...common} />
    case 'invoice':   return <FileCheck {...common} />
    default:          return <Circle {...common} />
  }
}

function StatusIcon({ status, size = 12 }: { status: MilestoneStatus; size?: number }) {
  if (status === 'completed') return <CheckCircle2 size={size} strokeWidth={2} color="#86EFAC" />
  if (status === 'active') return <Clock size={size} strokeWidth={2} color="#F4D47A" className="aguila-pulse" />
  if (status === 'blocked') return <AlertTriangle size={size} strokeWidth={2} color="#FCA5A5" />
  return <Circle size={size} strokeWidth={1.8} color="rgba(148,163,184,0.5)" />
}

function nodeColors(status: MilestoneStatus) {
  if (status === 'completed') return {
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.32)',
    color: '#86EFAC',
    shadow: '0 0 14px rgba(34,197,94,0.16), inset 0 1px 0 rgba(255,255,255,0.06)',
  }
  if (status === 'active') return {
    bg: 'rgba(201,167,74,0.16)',
    border: 'rgba(201,167,74,0.5)',
    color: '#F4D47A',
    shadow: '0 0 20px rgba(201,167,74,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
  }
  if (status === 'blocked') return {
    bg: 'rgba(239,68,68,0.14)',
    border: 'rgba(239,68,68,0.38)',
    color: '#FCA5A5',
    shadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  }
  return {
    bg: 'rgba(192,197,206,0.06)',
    border: 'rgba(192,197,206,0.16)',
    color: 'rgba(192,197,206,0.6)',
    shadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  }
}

function connectorColor(fromStatus: MilestoneStatus, toStatus: MilestoneStatus): string {
  if (fromStatus === 'completed' && (toStatus === 'completed' || toStatus === 'active' || toStatus === 'blocked')) {
    return 'rgba(192,197,206,0.38)'
  }
  if (fromStatus === 'completed' && toStatus === 'pending') {
    return 'linear-gradient(90deg, rgba(192,197,206,0.38) 0%, rgba(192,197,206,0.12) 100%)'
  }
  return 'rgba(192,197,206,0.12)'
}

function TraficoTimelineHorizontal({ input }: { input: TimelineInput }) {
  const milestones = computeMilestones(input)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const selected = activeIdx != null ? milestones[activeIdx] : null

  return (
    <section
      aria-label="Línea de tiempo del embarque"
      data-testid="trafico-timeline-horizontal"
      style={{
        position: 'relative',
        width: '100%',
        padding: '18px 0 8px',
      }}
    >
      <div
        className="trafico-timeline-rail"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          width: '100%',
          padding: '0 4px',
          boxSizing: 'border-box',
        }}
      >
        {milestones.map((m, i) => {
          const isLast = i === milestones.length - 1
          const next = milestones[i + 1]
          const colors = nodeColors(m.status)
          return (
            <div
              key={m.key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
                position: 'relative',
              }}
            >
              {/* Connector to next node — absolutely positioned at node
                  vertical center, extending to the right edge of this
                  column (covers the gap + bleeds into next column). */}
              {!isLast && next && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 18,
                    left: '50%',
                    right: '-50%',
                    height: 2,
                    background: connectorColor(m.status, next.status),
                    zIndex: 0,
                  }}
                />
              )}

              <button
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-label={`${m.label} — ${m.status === 'completed' ? 'completado' : m.status === 'active' ? 'etapa actual' : m.status === 'blocked' ? 'retenido' : 'pendiente'}`}
                aria-current={m.status === 'active' ? 'step' : undefined}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  color: colors.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: colors.shadow,
                  padding: 0,
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 1,
                  transition: 'transform var(--dur-fast, 150ms) ease, box-shadow var(--dur-fast, 150ms) ease',
                }}
                className={m.status === 'active' ? 'aguila-dot-pulse' : undefined}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <IconFor icon={m.icon} />
              </button>

              <span
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  color: m.status === 'pending'
                    ? 'rgba(192,197,206,0.55)'
                    : m.status === 'active'
                      ? '#F4D47A'
                      : '#E6EDF3',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {m.labelShort ?? m.label}
              </span>

              <span
                style={{
                  marginTop: 2,
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  color: 'rgba(148,163,184,0.7)',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                {m.timestamp_iso ? formatCompactDate(m.timestamp_iso) : '—'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Bottom-sheet drawer — shows the full detail when a node is tapped. */}
      {selected && (
        <MilestoneDrawer milestone={selected} onClose={() => setActiveIdx(null)} />
      )}

      <style jsx>{`
        .trafico-timeline-rail { container-type: inline-size; }
        @container (max-width: 380px) {
          .trafico-timeline-rail { gap: 0; }
        }
      `}</style>
    </section>
  )
}

function MilestoneDrawer({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  const colors = nodeColors(milestone.status)
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 40,
          animation: 'fade-in 200ms ease',
        }}
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={milestone.label}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 41,
          background: 'rgba(10,10,12,0.98)',
          backdropFilter: 'blur(20px)',
          borderTop: `1px solid ${colors.border}`,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: '16px 18px 28px',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.6)',
          animation: 'slide-up 240ms var(--ease-brand, cubic-bezier(0.22, 1, 0.36, 1))',
        }}
      >
        {/* Grab handle */}
        <div
          aria-hidden
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(192,197,206,0.25)',
            margin: '0 auto 12px',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              color: colors.color,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconFor icon={milestone.icon} size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--aguila-fs-section, 15px)',
                fontWeight: 700,
                color: '#E6EDF3',
                letterSpacing: '-0.01em',
              }}
            >
              {milestone.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <StatusIcon status={milestone.status} size={12} />
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: milestone.status === 'active' ? '#F4D47A' : 'rgba(192,197,206,0.7)',
                  fontWeight: 600,
                }}
              >
                {milestone.status === 'completed' ? 'Completado'
                  : milestone.status === 'active' ? 'Etapa actual'
                  : milestone.status === 'blocked' ? 'Retenido'
                  : 'Pendiente'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(192,197,206,0.08)',
              border: 'none',
              color: 'rgba(192,197,206,0.8)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {milestone.timestamp_iso && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'rgba(148,163,184,0.85)',
              marginTop: 4,
              marginBottom: 10,
            }}
          >
            {formatRelative(milestone.timestamp_iso)} · {formatAbsolute(milestone.timestamp_iso)}
          </div>
        )}

        {milestone.sub && (
          <div
            style={{
              fontSize: 'var(--aguila-fs-body, 13px)',
              color: 'rgba(205,214,224,0.88)',
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            {milestone.sub}
          </div>
        )}

        {milestone.href && (
          <Link
            href={milestone.href}
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #F4D47A 0%, #C9A74A 50%, #8F7628 100%)',
              color: '#0A0A0C',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.02em',
              textDecoration: 'none',
              minHeight: 44,
            }}
          >
            Abrir detalle →
          </Link>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  )
}
