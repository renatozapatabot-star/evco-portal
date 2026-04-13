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
  microStatus?: string
  microStatusWarning?: boolean
  /** Optional 7-day sparkline. Render below label when provided. */
  trendData?: number[]
  /** Sparkline tone — defaults to silver. Client surfaces use silver/green only (invariant 24). */
  trendTone?: SparklineTone
}

export function SmartNavCard({ href, label, icon: Icon, description, count, microStatus, microStatusWarning, trendData, trendTone = 'silver' }: Props) {
  const hasTrend = Array.isArray(trendData) && trendData.length >= 2
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}>
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="smart-nav-card"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '16px 20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          minHeight: 60,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="nav-card-icon" style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(192,197,206,0.08)',
          border: '1px solid rgba(192,197,206,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon className="nav-card-icon-svg" size={18} color="#C0C5CE" strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nav-card-label" style={{
            fontSize: 15, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.3,
          }}>
            {label}
          </div>
          <div className="nav-card-desc" style={{
            fontSize: 12, color: '#8b9ab5', marginTop: 2, lineHeight: 1.4,
          }}>
            {description}
          </div>
          {microStatus && (
            <div className="nav-card-micro" style={{
              fontSize: 11, marginTop: 4, lineHeight: 1.3,
              fontFamily: 'var(--font-mono)',
              color: microStatusWarning ? '#FBBF24' : '#64748b',
              fontWeight: microStatusWarning ? 600 : 400,
            }}>
              {microStatus}
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
            fontSize: 24, fontWeight: 800,
            color: count > 0 ? '#E6EDF3' : '#475569',
            flexShrink: 0,
          }}>
            {count}
          </div>
        )}
      </motion.div>

      <style>{`
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
