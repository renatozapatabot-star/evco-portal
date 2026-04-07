'use client'

import { useMemo } from 'react'
import { buildBorderTimeline, getClientBorderEvents } from '@/lib/border-events'

interface ShipmentTimelineProps {
  estatus: string
  pedimento?: string | null
  fechaCruce?: string | null
  /** Compact mode for mobile / list views */
  compact?: boolean
}

/**
 * ShipmentTimeline — 12-event border crossing progress visualization.
 *
 * Uses border-events.ts (previously dead code, now wired).
 * Shows completed/current/pending states with design system colors.
 * Touch targets 60px. JetBrains Mono timestamps. Spanish labels.
 */
export function ShipmentTimeline({ estatus, pedimento, fechaCruce, compact }: ShipmentTimelineProps) {
  const timeline = useMemo(() => {
    const clientEvents = getClientBorderEvents()
    return buildBorderTimeline(estatus, !!pedimento, !!fechaCruce, clientEvents)
  }, [estatus, pedimento, fechaCruce])

  // In compact mode, show only 6 key milestones
  const displayed = compact
    ? timeline.filter(e => [1, 2, 3, 7, 9, 11].includes(e.sequence))
    : timeline

  const currentIdx = displayed.findIndex(e => e.state === 'current')

  return (
    <div style={{ display: 'flex', flexDirection: compact ? 'row' : 'column', gap: compact ? 0 : 4, width: '100%' }}>
      {displayed.map((step, i) => {
        const isCompleted = step.state === 'completed'
        const isCurrent = step.state === 'current'
        const isPending = step.state === 'pending'
        const isLast = i === displayed.length - 1

        // Colors from design system
        const dotColor = isCompleted ? 'var(--success-500, #16A34A)'
          : isCurrent ? '#0D9488' // teal = certainty
          : 'var(--border, #E8E5E0)'
        const textColor = isCompleted ? 'var(--text-secondary, #6B6B6B)'
          : isCurrent ? 'var(--text-primary, #1A1A1A)'
          : 'var(--text-muted, #9B9B9B)'
        const lineColor = isCompleted ? 'var(--success-500, #16A34A)' : 'var(--border, #E8E5E0)'

        if (compact) {
          // Horizontal compact: dot + line
          return (
            <div key={step.type} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}>
              <div
                title={step.label}
                style={{
                  width: isCurrent ? 14 : 10,
                  height: isCurrent ? 14 : 10,
                  borderRadius: '50%',
                  background: dotColor,
                  flexShrink: 0,
                  transition: 'all 200ms',
                  boxShadow: isCurrent ? `0 0 8px ${dotColor}40` : undefined,
                }}
              />
              {!isLast && (
                <div style={{
                  flex: 1, height: 2, minWidth: 8,
                  background: lineColor,
                  transition: 'background 200ms',
                }} />
              )}
            </div>
          )
        }

        // Vertical full: icon + label + line
        return (
          <div key={step.type} style={{ display: 'flex', gap: 12, minHeight: isCurrent ? 48 : 36 }}>
            {/* Dot + vertical line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
              <div style={{
                width: isCurrent ? 24 : 16,
                height: isCurrent ? 24 : 16,
                borderRadius: '50%',
                background: isPending ? 'var(--bg-card, #FFFFFF)' : dotColor,
                border: isPending ? `2px solid var(--border, #E8E5E0)` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isCurrent ? 14 : 10,
                flexShrink: 0,
                transition: 'all 200ms',
                boxShadow: isCurrent ? `0 0 8px ${dotColor}40` : undefined,
              }}>
                {isCompleted ? '✓' : isCurrent ? step.icon : ''}
              </div>
              {!isLast && (
                <div style={{
                  width: 2, flex: 1, minHeight: 12,
                  background: lineColor,
                  transition: 'background 200ms',
                }} />
              )}
            </div>
            {/* Label */}
            <div style={{
              fontSize: isCurrent ? 14 : 13,
              fontWeight: isCurrent ? 700 : 400,
              color: textColor,
              paddingTop: isCurrent ? 2 : 0,
              lineHeight: 1.4,
            }}>
              {step.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}
