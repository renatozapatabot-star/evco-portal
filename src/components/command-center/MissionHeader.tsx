'use client'

import Link from 'next/link'
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
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '20px 20px 16px',
      }}
    >
      <CruzAvatar size={48} mood={mood} onClick={onAvatarClick} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {loading ? (
          <div className="skeleton-shimmer" style={{ width: '80%', height: 18, borderRadius: 4 }} />
        ) : (
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.4,
            }}
          >
            {sentence}
          </div>
        )}

        {quickAction && !loading && (
          <Link
            href={quickAction.href}
            style={{
              display: 'inline-block',
              marginTop: 6,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--gold-dark, #8B6914)',
              textDecoration: 'none',
            }}
          >
            {quickAction.label} &rarr;
          </Link>
        )}
      </div>
    </div>
  )
}
