'use client'

import { AGUILA } from '@/lib/search-registry'
import type { EntityId } from '@/types/search'
import type { UniversalSearchHit } from '@/lib/search/types'

interface Props {
  hit: UniversalSearchHit
  active: boolean
  entityLabel: string
  onMouseEnter: () => void
  onClick: () => void
}

/**
 * Block 2 · result row. 60px min-height (3 AM Driver rule). Mono font
 * whenever the title starts with a digit or dot (codes, pedimentos,
 * fracciones); Geist Sans otherwise.
 */
export function SearchResultRow({ hit, active, entityLabel, onMouseEnter, onClick }: Props) {
  const isCode = /^[\d.]/.test(hit.title)
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      data-entity-id={hit.kind as EntityId}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', minHeight: 60, textAlign: 'left',
        padding: '10px 20px',
        background: active ? 'rgba(0,229,255,0.08)' : 'transparent',
        borderLeft: active ? `2px solid ${AGUILA.ACCENT_SILVER}` : '2px solid transparent',
        border: 'none', borderRadius: 0, cursor: 'pointer',
        color: '#E6EDF3',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: isCode ? 'var(--font-jetbrains-mono), JetBrains Mono, monospace' : 'var(--font-geist-sans), Inter, system-ui, sans-serif',
          fontSize: 14, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {hit.title || '—'}
        </span>
        {hit.subtitle && (
          <span style={{
            fontSize: 12, color: AGUILA.TEXT_TERTIARY,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {hit.subtitle}
          </span>
        )}
      </div>
      <span style={{
        fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: AGUILA.TEXT_TERTIARY, flexShrink: 0,
      }}>
        {entityLabel}
      </span>
    </button>
  )
}
