'use client'
import { formatAbsoluteETA } from '@/lib/format-utils'

interface Props {
  lastFetched: Date | null
  onRefresh?: () => void
}

export function DataFreshness({ lastFetched, onRefresh }: Props) {
  if (!lastFetched) return null

  const diffMs = Date.now() - lastFetched.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const cls = diffMin > 15 ? 'very-stale' : diffMin > 5 ? 'stale' : ''

  return (
    <span className={`data-freshness ${cls}`}>
      Actualizado {formatAbsoluteETA(lastFetched)}
      {onRefresh && (
        <button onClick={onRefresh} aria-label="Actualizar datos" title="Actualizar datos">↻</button>
      )}
    </span>
  )
}
