'use client'

import Link from 'next/link'
import {
  FileText, Truck, Package, CreditCard, Flag, FileCheck, ClipboardList, Circle,
  CheckCircle2, Clock, AlertTriangle,
} from 'lucide-react'
import {
  computeMilestones,
  formatRelative,
  formatAbsolute,
  STATUS_GREEN,
  STATUS_GOLD,
  STATUS_RED,
  PRIMARY_TEXT,
  type Milestone,
  type MilestoneIcon,
  type MilestoneStatus,
  type TimelineInput,
} from './timeline-logic'

/**
 * Trafico timeline — VERTICAL status rail (fallback renderer). The
 * horizontal renderer at `TraficoTimeline.tsx` is the default; this
 * one activates when `NEXT_PUBLIC_TIMELINE_HORIZONTAL='0'` or when the
 * caller explicitly imports it for a desktop drill-down view.
 *
 * Pure milestone logic lives in `./timeline-logic.ts` — never duplicate.
 */

export type { Milestone, MilestoneStatus, TimelineInput }
export { computeMilestones }

function IconFor({ icon }: { icon: MilestoneIcon }) {
  const common = { size: 18, strokeWidth: 1.8 } as const
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

function StatusIcon({ status }: { status: MilestoneStatus }) {
  if (status === 'completed') return <CheckCircle2 size={14} strokeWidth={2} color={STATUS_GREEN} />
  if (status === 'active') return <Clock size={14} strokeWidth={2} color={STATUS_GOLD} className="aguila-pulse" />
  if (status === 'blocked') return <AlertTriangle size={14} strokeWidth={2} color={STATUS_RED} />
  return <Circle size={14} strokeWidth={1.8} color="rgba(148,163,184,0.5)" />
}

export function TraficoTimelineVertical({ input }: { input: TimelineInput }) {
  const milestones = computeMilestones(input)

  return (
    <section
      aria-label="Línea de tiempo del embarque"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        padding: '20px 0',
      }}
    >
      {milestones.map((m, i) => {
        const isLast = i === milestones.length - 1
        const isFirst = i === 0
        const prev = milestones[i - 1]
        const railAbove =
          isFirst
            ? 'transparent'
            : prev?.status === 'completed' && (m.status === 'completed' || m.status === 'active' || m.status === 'blocked')
              ? 'linear-gradient(180deg, rgba(192,197,206,0.35) 0%, rgba(192,197,206,0.35) 100%)'
              : 'rgba(192,197,206,0.12)'
        const railBelow =
          isLast
            ? 'transparent'
            : m.status === 'completed'
              ? 'linear-gradient(180deg, rgba(192,197,206,0.35) 0%, rgba(192,197,206,0.35) 100%)'
              : m.status === 'active'
                ? 'linear-gradient(180deg, rgba(201,167,74,0.55) 0%, rgba(192,197,206,0.12) 100%)'
                : 'rgba(192,197,206,0.12)'

        return (
          <div key={m.key} style={{ position: 'relative', display: 'flex', gap: 18, alignItems: 'stretch', minHeight: 92 }}>
            <div style={{ width: 42, flexShrink: 0, position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', top: 0, bottom: '50%', width: 2, background: railAbove }} aria-hidden />
              <div style={{ position: 'absolute', top: '50%', bottom: 0, width: 2, background: railBelow }} aria-hidden />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 42, height: 42,
                  borderRadius: 999,
                  background: m.status === 'completed'
                    ? 'rgba(34,197,94,0.12)'
                    : m.status === 'active'
                      ? 'rgba(201,167,74,0.16)'
                      : m.status === 'blocked'
                        ? 'rgba(239,68,68,0.14)'
                        : 'rgba(192,197,206,0.06)',
                  border: `1px solid ${
                    m.status === 'completed'
                      ? 'rgba(34,197,94,0.32)'
                      : m.status === 'active'
                        ? 'rgba(201,167,74,0.5)'
                        : m.status === 'blocked'
                          ? 'rgba(239,68,68,0.38)'
                          : 'rgba(192,197,206,0.16)'
                  }`,
                  color: m.status === 'completed'
                    ? STATUS_GREEN
                    : m.status === 'active'
                      ? STATUS_GOLD
                      : m.status === 'blocked'
                        ? STATUS_RED
                        : 'rgba(192,197,206,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: m.status === 'active'
                    ? '0 0 24px rgba(201,167,74,0.3), inset 0 1px 0 rgba(255,255,255,0.08)'
                    : m.status === 'completed'
                      ? '0 0 14px rgba(34,197,94,0.16), inset 0 1px 0 rgba(255,255,255,0.06)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  zIndex: 1,
                }}
                aria-hidden
              >
                <IconFor icon={m.icon} />
              </div>
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0,
                padding: '12px 0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <TimelineCard milestone={m} />
            </div>
          </div>
        )
      })}
    </section>
  )
}

function TimelineCard({ milestone }: { milestone: Milestone }) {
  const body = (
    <div
      style={{
        padding: '14px 18px',
        borderRadius: 14,
        background: milestone.status === 'active'
          ? 'rgba(201,167,74,0.06)'
          : milestone.status === 'blocked'
            ? 'rgba(239,68,68,0.06)'
            : 'rgba(0,0,0,0.28)',
        border: `1px solid ${
          milestone.status === 'active'
            ? 'rgba(201,167,74,0.3)'
            : milestone.status === 'blocked'
              ? 'rgba(239,68,68,0.3)'
              : milestone.status === 'completed'
                ? 'rgba(34,197,94,0.18)'
                : 'rgba(192,197,206,0.1)'
        }`,
        transition: 'border-color var(--dur-fast, 150ms) ease, background var(--dur-fast, 150ms) ease, transform var(--dur-fast, 150ms) ease',
        boxShadow: milestone.status === 'active'
          ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 20px rgba(0,0,0,0.4)'
          : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 'var(--aguila-fs-section, 15px)',
            fontWeight: 600,
            color: milestone.status === 'pending' ? 'rgba(205,214,224,0.72)' : PRIMARY_TEXT,
          }}
        >
          {milestone.label}
        </span>
        <StatusIcon status={milestone.status} />
        {milestone.timestamp_iso && (
          <span
            title={formatAbsolute(milestone.timestamp_iso)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--aguila-fs-meta, 11px)',
              color: 'rgba(148,163,184,0.8)',
              marginLeft: 'auto',
            }}
          >
            {formatRelative(milestone.timestamp_iso)} · {formatAbsolute(milestone.timestamp_iso)}
          </span>
        )}
      </div>
      {milestone.sub && (
        <div
          style={{
            fontSize: 'var(--aguila-fs-body, 13px)',
            color: milestone.status === 'pending' ? 'rgba(148,163,184,0.68)' : 'rgba(205,214,224,0.85)',
            lineHeight: 1.5,
          }}
        >
          {milestone.sub}
        </div>
      )}
      {milestone.status === 'active' && (
        <div
          style={{
            marginTop: 8,
            fontSize: 'var(--aguila-fs-meta, 11px)',
            color: STATUS_GOLD,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          Etapa actual
        </div>
      )}
    </div>
  )

  if (!milestone.href) return body
  return (
    <Link
      href={milestone.href}
      style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
      aria-label={`Abrir ${milestone.label}`}
    >
      {body}
    </Link>
  )
}
