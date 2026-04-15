'use client'

import Link from 'next/link'
import { ArrowRight, AlertTriangle, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ClientSuggestedAction } from '@/components/cockpit/shared/fetchCockpitData'

interface Props {
  suggestedActions: ClientSuggestedAction[]
}

const urgencyStyles: Record<ClientSuggestedAction['urgency'], {
  border: string; bg: string; iconColor: string
}> = {
  high: {
    border: 'rgba(251,191,36,0.2)',
    bg: 'rgba(251,191,36,0.06)',
    iconColor: '#FBBF24',
  },
  medium: {
    border: 'rgba(192,197,206,0.15)',
    bg: 'rgba(192,197,206,0.04)',
    iconColor: '#C0C5CE',
  },
  low: {
    border: 'rgba(255,255,255,0.08)',
    bg: 'rgba(255,255,255,0.03)',
    iconColor: '#8b9ab5',
  },
}

export function SuggestedActions({ suggestedActions }: Props) {
  if (suggestedActions.length === 0) return null

  return (
    <div style={{
      display: 'flex', gap: 10, marginBottom: 16,
      overflowX: 'auto',
      scrollbarWidth: 'none',
    }}>
      {suggestedActions.map((action, i) => {
        const style = urgencyStyles[action.urgency]
        const Icon = action.urgency === 'high' ? AlertTriangle : Zap
        return (
          <Link key={i} href={action.href} style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0 }}>
            <motion.div
              whileHover={{ y: -1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px',
                background: style.bg,
                border: `1px solid ${style.border}`,
                borderRadius: 12,
                minHeight: 44,
              }}
            >
              <Icon size={14} color={style.iconColor} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: '#E6EDF3', whiteSpace: 'nowrap' }}>
                  {action.label}
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: '#64748b', whiteSpace: 'nowrap' }}>
                  {action.reason}
                </div>
              </div>
              <ArrowRight size={12} color="#8b9ab5" style={{ flexShrink: 0 }} />
            </motion.div>
          </Link>
        )
      })}
    </div>
  )
}
