'use client'

import Link from 'next/link'
import { ChevronRight, FileCheck, AlertTriangle, MessageSquareWarning, Truck } from 'lucide-react'
import { GlassCard } from '@/components/aguila'
import { ACCENT_SILVER, ACCENT_SILVER_BRIGHT, AMBER, RED, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'

export interface DecisionItem {
  key: string
  count: number
  label: string
  sublabel: string
  href: string
  icon: 'draft' | 'mve' | 'mensajeria' | 'atrasado'
  tone?: 'silver' | 'amber' | 'red'
}

interface Props {
  items: DecisionItem[]
}

const ICON: Record<DecisionItem['icon'], typeof FileCheck> = {
  draft: FileCheck,
  mve: AlertTriangle,
  mensajeria: MessageSquareWarning,
  atrasado: Truck,
}

const TONE_COLOR: Record<NonNullable<DecisionItem['tone']>, string> = {
  silver: ACCENT_SILVER,
  amber: AMBER,
  red: RED,
}

/**
 * "Decisiones para Tito" — top-of-page actionable panel on /admin/eagle.
 * Lists only items where count > 0 — empty rows are noise.
 * Each item is a 1-click destination to the surface where Tito acts on it.
 *
 * If every count is 0, panel renders a calm "Todo al corriente" line so
 * Tito immediately knows nothing needs his decision today.
 */
export function DecisionesPanel({ items }: Props) {
  const actionable = items.filter(i => i.count > 0)

  if (actionable.length === 0) {
    return (
      <GlassCard size="compact">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#22C55E',
            boxShadow: '0 0 8px rgba(34,197,94,0.6)',
          }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
              Todo al corriente
            </div>
            <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>
              Sin decisiones pendientes hoy. Sigue el ritmo.
            </div>
          </div>
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard size="compact">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{
          fontSize: 'var(--aguila-fs-label, 10px)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 'var(--aguila-ls-label, 0.08em)',
          color: TEXT_MUTED,
        }}>
          Decisiones para Tito
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: TEXT_MUTED,
          fontFamily: 'var(--font-jetbrains-mono), monospace',
        }}>
          {actionable.length} · ahora
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {actionable.map((i) => {
          const Icon = ICON[i.icon]
          const tone = TONE_COLOR[i.tone ?? 'silver']
          return (
            <Link
              key={i.key}
              href={i.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                textDecoration: 'none',
                color: 'inherit',
                minHeight: 60,
                transition: 'background 120ms ease, border-color 120ms ease',
              }}
              className="aguila-decision-card"
            >
              <span
                aria-hidden
                className={i.tone === 'red' || i.tone === 'amber' ? 'aguila-pulse' : ''}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${tone}33`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <Icon size={16} color={tone} />
                {(i.tone === 'red' || i.tone === 'amber') && (
                  <span aria-hidden style={{
                    position: 'absolute', top: -2, right: -2,
                    width: 8, height: 8, borderRadius: '50%',
                    background: tone, boxShadow: `0 0 8px ${tone}`,
                  }} className="aguila-dot-pulse" />
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 22, fontWeight: 800,
                  color: ACCENT_SILVER_BRIGHT,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  lineHeight: 1,
                }}>
                  {i.count}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, marginTop: 4 }}>
                  {i.label}
                </div>
                <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 1 }}>
                  {i.sublabel}
                </div>
              </div>
              <ChevronRight size={16} color={TEXT_MUTED} />
            </Link>
          )
        })}
      </div>
      <style jsx>{`
        .aguila-decision-card:hover {
          background: rgba(255,255,255,0.045) !important;
          border-color: rgba(192,197,206,0.2) !important;
        }
      `}</style>
    </GlassCard>
  )
}
