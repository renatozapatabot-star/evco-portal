'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER, GLOW_SILVER,
} from '@/lib/design-system'
import { CAPABILITY_CARDS, type CapabilityCounts } from '@/lib/cockpit/capabilities'

interface Props {
  counts: CapabilityCounts
}

/**
 * AGUILA v10 — 3-card capability row. Icon left, title/subtitle center,
 * count right. Same glass chrome as SmartNavCard but semantically distinct
 * (action, not destination). Rendered inside CockpitInicio between the
 * nav grid and the main estado grid.
 */
export function CapabilityCardGrid({ counts }: Props) {
  return (
    <div
      className="aguila-capability-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--aguila-gap-card, 16px)',
      }}
    >
      <style>{`
        @media (max-width: 1024px) {
          .aguila-capability-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {CAPABILITY_CARDS.map((c) => {
        const cell = counts[c.key]
        return (
          <CapabilityCard
            key={c.key}
            href={c.href}
            label={c.label}
            subtitle={c.subtitle}
            Icon={c.icon}
            count={cell?.count ?? null}
            countSuffix={cell?.countSuffix}
            microStatus={cell?.microStatus}
            microStatusWarning={cell?.microStatusWarning}
          />
        )
      })}
    </div>
  )
}

interface CardProps {
  href: string
  label: string
  subtitle: string
  Icon: LucideIcon
  count: number | null
  countSuffix?: string
  microStatus?: string
  microStatusWarning?: boolean
}

function CapabilityCard({ href, label, subtitle, Icon, count, countSuffix, microStatus, microStatusWarning }: CardProps) {
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div
        className="aguila-capability-card"
        style={{
          background: BG_CARD,
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER}`,
          borderRadius: 'var(--aguila-radius-card, 20px)',
          padding: '16px 20px',
          boxShadow: GLASS_SHADOW,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          minHeight: 64,
          cursor: 'pointer',
          transition: 'background 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(192,197,206,0.10)',
          border: '1px solid rgba(192,197,206,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} color={ACCENT_SILVER} strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.3 }}>
            {label}
          </div>
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </div>
          {microStatus ? (
            <div style={{
              fontSize: 11, marginTop: 3,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              color: microStatusWarning ? '#FBBF24' : TEXT_MUTED,
              fontWeight: microStatusWarning ? 600 : 400,
            }}>
              {microStatus}
            </div>
          ) : null}
        </div>
        {count !== null ? (
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 22, fontWeight: 800,
            color: count > 0 ? TEXT_PRIMARY : TEXT_MUTED,
            flexShrink: 0,
          }}>
            {count}{countSuffix ? <span style={{ fontSize: 12, fontWeight: 700, color: TEXT_MUTED, marginLeft: 2 }}>{countSuffix}</span> : null}
          </div>
        ) : null}
        <style jsx>{`
          .aguila-capability-card:hover {
            background: rgba(255,255,255,0.06);
            border-color: rgba(192,197,206,0.22);
            box-shadow:
              0 12px 40px rgba(0,0,0,0.5),
              inset 0 1px 0 rgba(255,255,255,0.08),
              0 0 24px ${GLOW_SILVER};
          }
          @media (prefers-reduced-motion: reduce) {
            .aguila-capability-card { transition: none; }
          }
        `}</style>
      </div>
    </Link>
  )
}
