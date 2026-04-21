'use client'

import type { LucideIcon } from 'lucide-react'
import { SmartNavCard } from './client/SmartNavCard'
import type { SparklineTone } from '@/components/aguila'

export interface NavTile {
  href: string
  label: string
  icon: LucideIcon
  description: string
}

export interface NavCardGridItem {
  tile: NavTile
  count: number | null
  countSuffix?: string
  microStatus?: string
  microStatusWarning?: boolean
  historicMicrocopy?: string
  trendData?: number[]
  trendTone?: SparklineTone
}

interface Props {
  items: NavCardGridItem[]
}

/**
 * Shared glass nav card grid — used by every cockpit surface.
 * Cards optionally render a 20px sparkline when trendData is provided.
 */
export function NavCardGrid({ items }: Props) {
  return (
    <div className="nav-cards-grid" style={{ display: 'grid', gap: 12 }}>
      {items.map(({ tile, count, countSuffix, microStatus, microStatusWarning, historicMicrocopy, trendData, trendTone }) => (
        <SmartNavCard
          key={tile.href}
          href={tile.href}
          label={tile.label}
          icon={tile.icon}
          description={tile.description}
          count={count}
          countSuffix={countSuffix}
          microStatus={microStatus}
          microStatusWarning={microStatusWarning}
          historicMicrocopy={historicMicrocopy}
          trendData={trendData}
          trendTone={trendTone}
        />
      ))}
      <style>{`
        .nav-cards-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        @media (max-width: 640px) {
          .nav-cards-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  )
}
