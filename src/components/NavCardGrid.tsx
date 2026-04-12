'use client'

import type { LucideIcon } from 'lucide-react'
import { SmartNavCard } from './client/SmartNavCard'

export interface NavTile {
  href: string
  label: string
  icon: LucideIcon
  description: string
}

export interface NavCardGridItem {
  tile: NavTile
  count: number | null
  microStatus?: string
  microStatusWarning?: boolean
}

interface Props {
  items: NavCardGridItem[]
}

/**
 * Shared glass nav card grid — used by both client cockpit and operator cockpit.
 * Produces byte-identical output to the previous inline grid in ClientHome.
 */
export function NavCardGrid({ items }: Props) {
  return (
    <div className="nav-cards-grid" style={{ display: 'grid', gap: 12 }}>
      {items.map(({ tile, count, microStatus, microStatusWarning }) => (
        <SmartNavCard
          key={tile.href}
          href={tile.href}
          label={tile.label}
          icon={tile.icon}
          description={tile.description}
          count={count}
          microStatus={microStatus}
          microStatusWarning={microStatusWarning}
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
