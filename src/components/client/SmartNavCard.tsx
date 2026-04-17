'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { Sparkline, type SparklineTone } from '@/components/aguila'

interface Props {
  href: string
  label: string
  icon: LucideIcon
  description: string
  count: number | null
  /** Appended to count (e.g. "%") when rendering the primary. */
  countSuffix?: string
  microStatus?: string
  microStatusWarning?: boolean
  /** Tiny parenthetical for lifetime totals that used to dominate the
   *  subtitle (e.g. "(+214K en histórico)"). Renders below microStatus
   *  in a muted color and very small font so the this-month metric
   *  keeps the headline position. Invariant #24 — the client cockpit
   *  headline is the LIVE metric, not the archival total. */
  historicMicrocopy?: string
  /** Optional 7-day sparkline. Render below label when provided. */
  trendData?: number[]
  /** Sparkline tone — defaults to silver. Client surfaces use silver/green only (invariant 24). */
  trendTone?: SparklineTone
}

export function SmartNavCard({ href, label, icon: Icon, description, count, countSuffix, microStatus, microStatusWarning, historicMicrocopy, trendData, trendTone = 'silver' }: Props) {
  const hasTrend = Array.isArray(trendData) && trendData.length >= 2
  const isLive = typeof count === 'number' && count > 0
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}>
      <motion.div
        whileHover={{ y: -3 }}
        whileTap={{ y: 0, scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className="smart-nav-card"
        style={{
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
          border: '1px solid rgba(192,197,206,0.18)',
          borderRadius: 20,
          padding: '16px 20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          minHeight: 60,
          boxShadow: '0 12px 36px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 24px rgba(192,197,206,0.1)',
          willChange: 'transform',
        }}
      >
        <div className="nav-card-icon" style={{
          position: 'relative',
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(192,197,206,0.08)',
          border: '1px solid rgba(192,197,206,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon className="nav-card-icon-svg" size={18} color="#C0C5CE" strokeWidth={1.8} />
          {isLive && (
            <span
              aria-hidden
              className="nav-card-live-dot"
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#22C55E',
                boxShadow: '0 0 8px rgba(34,197,94,0.8)',
              }}
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nav-card-label" style={{
            fontSize: 15, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.3,
          }}>
            {label}
          </div>
          <div className="nav-card-desc" style={{
            fontSize: 'var(--aguila-fs-compact)', color: '#8b9ab5', marginTop: 2, lineHeight: 1.4,
          }}>
            {description}
          </div>
          {microStatus && (
            <div className="nav-card-micro" style={{
              fontSize: 'var(--aguila-fs-meta)', marginTop: 4, lineHeight: 1.3,
              fontFamily: 'var(--font-mono)',
              color: microStatusWarning ? '#FBBF24' : '#64748b',
              fontWeight: microStatusWarning ? 600 : 400,
            }}>
              {microStatus}
            </div>
          )}
          {historicMicrocopy && (
            <div className="nav-card-historic" style={{
              fontSize: 10, marginTop: 2, lineHeight: 1.2,
              fontFamily: 'var(--font-mono)',
              color: 'rgba(100,116,139,0.65)',
              fontWeight: 400,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {historicMicrocopy}
            </div>
          )}
          {hasTrend && (
            <div className="nav-card-trend" style={{ marginTop: 6, height: 20, opacity: 0.9 }}>
              <Sparkline data={trendData!} tone={trendTone} height={20} ariaLabel={`${label} tendencia 7 días`} />
            </div>
          )}
        </div>
        {count !== null && (
          <div className="nav-card-count" style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--aguila-fs-title)', fontWeight: 800,
            color: count > 0 ? '#E6EDF3' : '#475569',
            flexShrink: 0,
          }}>
            {count}{countSuffix ? <span style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: '#94a3b8', marginLeft: 2 }}>{countSuffix}</span> : null}
          </div>
        )}
      </motion.div>

      <style>{`
        @keyframes nav-card-live-pulse {
          0%, 100% { box-shadow: 0 0 4px rgba(34,197,94,0.6); opacity: 0.9; }
          50%      { box-shadow: 0 0 12px rgba(34,197,94,0.95); opacity: 1; }
        }
        .nav-card-live-dot {
          animation: nav-card-live-pulse 2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .nav-card-live-dot { animation: none; }
        }
        @media (max-width: 640px) {
          .smart-nav-card {
            padding: 12px !important;
            gap: 8px !important;
            border-radius: 14px !important;
            min-height: 60px !important;
          }
          .nav-card-icon {
            width: 32px !important;
            height: 32px !important;
            border-radius: 10px !important;
          }
          .nav-card-icon-svg {
            width: 14px !important;
            height: 14px !important;
          }
          .nav-card-label {
            font-size: 13px !important;
          }
          .nav-card-desc {
            display: none !important;
          }
          .nav-card-micro {
            display: none !important;
          }
          .nav-card-trend {
            display: none !important;
          }
          .nav-card-count {
            font-size: 18px !important;
          }
        }
      `}</style>
    </Link>
  )
}
