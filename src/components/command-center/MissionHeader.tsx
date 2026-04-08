'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { CruzAvatar } from './CruzAvatar'
import type { Urgency } from '@/lib/card-urgency'

interface MissionHeaderProps {
  mood: Urgency | 'green'
  sentence: string
  quickAction: { label: string; href: string } | null
  onAvatarClick?: () => void
  loading?: boolean
}

function getMoodFromCounts(enProceso: number, urgentes: number): Urgency | 'green' {
  if (urgentes > 0) return 'red'
  if (enProceso > 0) return 'amber'
  return 'green'
}

export { getMoodFromCounts }

export function MissionHeader({ mood, sentence, quickAction, onAvatarClick, loading }: MissionHeaderProps) {
  const isAllGreen = mood === 'green' && !quickAction
  const hasUrgency = mood === 'red' || mood === 'amber'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '24px 28px',
        margin: '16px 24px',
        borderRadius: 16,
        background: '#1A1A1A',
      }}
    >
      {isAllGreen ? (
        <CheckCircle2 size={32} style={{ color: 'var(--success)', flexShrink: 0 }} />
      ) : (
        <CruzAvatar size={48} mood={mood} onClick={onAvatarClick} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {loading ? (
          <div className="skeleton-shimmer" style={{ width: '70%', height: 22, borderRadius: 4 }} />
        ) : (
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1.3,
            }}
          >
            {isAllGreen ? 'Todo en orden — Excelente trabajo' : sentence}
          </div>
        )}
      </div>

      {quickAction && !loading && (
        <Link
          href={quickAction.href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 20px',
            borderRadius: 24,
            background: 'var(--gold, #C9A84C)',
            color: '#1A1A1A',
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            animation: hasUrgency ? 'ccPillPulse 2s ease-in-out infinite' : 'none',
            transition: 'transform 150ms, background 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold-hover, #B8933B)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--gold, #C9A84C)' }}
        >
          {quickAction.label} &rarr;
        </Link>
      )}
    </div>
  )
}
