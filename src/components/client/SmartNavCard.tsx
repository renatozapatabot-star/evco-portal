'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

interface Props {
  href: string
  label: string
  icon: LucideIcon
  description: string
  count: number | null
  microStatus?: string
  microStatusWarning?: boolean
}

export function SmartNavCard({ href, label, icon: Icon, description, count, microStatus, microStatusWarning }: Props) {
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
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(0,229,255,0.08)',
          border: '1px solid rgba(0,229,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} color="#00E5FF" strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.3,
          }}>
            {label}
          </div>
          <div style={{
            fontSize: 12, color: '#8b9ab5', marginTop: 2, lineHeight: 1.4,
          }}>
            {description}
          </div>
          {microStatus && (
            <div style={{
              fontSize: 11, marginTop: 4, lineHeight: 1.3,
              fontFamily: 'var(--font-mono)',
              color: microStatusWarning ? '#FBBF24' : '#64748b',
              fontWeight: microStatusWarning ? 600 : 400,
            }}>
              {microStatus}
            </div>
          )}
        </div>
        {count !== null && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 24, fontWeight: 800,
            color: count > 0 ? '#E6EDF3' : '#475569',
            flexShrink: 0,
          }}>
            {count}
          </div>
        )}
      </motion.div>
    </Link>
  )
}
