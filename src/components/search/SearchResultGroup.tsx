'use client'

import { ZAPATA } from '@/lib/search-registry'
import type { EntityConfig } from '@/lib/search-registry'
import type { UniversalSearchHit } from '@/lib/search/types'
import { SearchResultRow } from './SearchResultRow'

interface Props {
  config: EntityConfig
  rows: UniversalSearchHit[]
  visibleCount: number
  activeGlobalIdx: number
  baseIdx: number
  onActivate: (idx: number) => void
  onNavigate: (hit: UniversalSearchHit) => void
  onMoreClick: () => void
}

/**
 * Group header + up to `visibleCount` rows + "Ver más" link if more exist.
 * Stub groups (ordenes_carga) render an empty-state placeholder instead.
 */
export function SearchResultGroup({
  config, rows, visibleCount, activeGlobalIdx, baseIdx, onActivate, onNavigate, onMoreClick,
}: Props) {
  const isStub = config.scope === 'stub'

  if (isStub) {
    return (
      <div style={{ padding: '6px 0' }}>
        <div style={{
          padding: '6px 20px',
          fontSize: 'var(--aguila-fs-label)', fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: ZAPATA.TEXT_TERTIARY,
        }}>
          {config.labelEs}
        </div>
        <div style={{
          padding: '12px 20px', fontSize: 'var(--aguila-fs-compact)', color: ZAPATA.TEXT_TERTIARY, fontStyle: 'italic',
        }}>
          {config.emptyMessage ?? 'Sin datos todavía'}
        </div>
      </div>
    )
  }

  if (rows.length === 0) return null
  const visible = rows.slice(0, visibleCount)
  const extra = rows.length - visible.length

  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{
        padding: '6px 20px',
        fontSize: 'var(--aguila-fs-label)', fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: ZAPATA.TEXT_TERTIARY,
      }}>
        {config.labelEs}
      </div>
      {visible.map((hit, i) => {
        const idx = baseIdx + i
        return (
          <SearchResultRow
            key={`${hit.kind}-${hit.id}-${idx}`}
            hit={hit}
            active={idx === activeGlobalIdx}
            entityLabel={config.labelSingularEs}
            onMouseEnter={() => onActivate(idx)}
            onClick={() => onNavigate(hit)}
          />
        )
      })}
      {extra > 0 && (
        <button
          type="button"
          onClick={onMoreClick}
          style={{
            width: '100%', textAlign: 'left',
            padding: '8px 20px', minHeight: 36,
            background: 'transparent', border: 'none',
            color: 'var(--portal-fg-3)', fontSize: 'var(--aguila-fs-compact)', cursor: 'pointer',
          }}
        >
          Ver más en {config.labelEs} →
        </button>
      )}
    </div>
  )
}
