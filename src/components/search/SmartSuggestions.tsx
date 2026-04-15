'use client'

import { useEffect, useState } from 'react'
import { ZAPATA } from '@/lib/search-registry'

const RECENT_KEY = 'aduana.search.recent'
const MAX_RECENT = 5

interface Props {
  onPick: (query: string) => void
  onSuggestionClick?: (type: string) => void
}

function readRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

export function pushRecent(query: string): void {
  if (typeof window === 'undefined') return
  const q = query.trim()
  if (q.length < 2) return
  try {
    const current = readRecent()
    const next = [q, ...current.filter((x) => x !== q)].slice(0, MAX_RECENT)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Non-fatal — telemetry stays on the server.
  }
}

/**
 * Empty-state body for the palette: recent searches (localStorage) +
 * role-specific suggestions. Suggestions are static hints for now; a real
 * role-aware feed will land alongside workflow_events indexing.
 */
export function SmartSuggestions({ onPick, onSuggestionClick }: Props) {
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    setRecent(readRecent())
  }, [])

  const staticHints = [
    { label: 'Embarques activos hoy', query: 'activo', type: 'active_today' },
    { label: 'Pedimento 3596', query: '3596', type: 'patente' },
    { label: 'Fracción 3901', query: '3901.', type: 'fraccion' },
  ]

  return (
    <div style={{ padding: '8px 0' }}>
      {recent.length > 0 && (
        <div style={{ padding: '6px 0' }}>
          <div style={{
            padding: '6px 20px',
            fontSize: 'var(--aguila-fs-label)', fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: ZAPATA.TEXT_TERTIARY,
          }}>
            Búsquedas recientes
          </div>
          {recent.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                onSuggestionClick?.('recent')
                onPick(q)
              }}
              style={{
                width: '100%', textAlign: 'left',
                minHeight: 44,
                padding: '10px 20px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#E6EDF3', fontSize: 'var(--aguila-fs-body)',
                fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}
      <div style={{ padding: '6px 0' }}>
        <div style={{
          padding: '6px 20px',
          fontSize: 'var(--aguila-fs-label)', fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: ZAPATA.TEXT_TERTIARY,
        }}>
          Sugerencias
        </div>
        {staticHints.map((h) => (
          <button
            key={h.type}
            type="button"
            onClick={() => {
              onSuggestionClick?.(h.type)
              onPick(h.query)
            }}
            style={{
              width: '100%', textAlign: 'left',
              minHeight: 44,
              padding: '10px 20px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#E6EDF3', fontSize: 'var(--aguila-fs-body)',
              fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif',
            }}
          >
            {h.label}
          </button>
        ))}
      </div>
    </div>
  )
}
