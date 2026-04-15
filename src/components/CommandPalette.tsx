'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UniversalSearchHit,
  UniversalSearchResponse,
} from '@/lib/search/types'
import { SEARCH_ENTITIES, ZAPATA } from '@/lib/search-registry'
import { useTrack } from '@/lib/telemetry/useTrack'
import { SearchResultGroup } from './search/SearchResultGroup'
import { SmartSuggestions, pushRecent } from './search/SmartSuggestions'
import { AdvancedSearchModal } from './search/AdvancedSearchModal'
import type { EntityId } from '@/types/search'

const VISIBLE_PER_GROUP = 3
const TOTAL_HIT_CAP = 15

interface Props {
  open: boolean
  onClose: () => void
  initialMode?: 'quick' | 'advanced'
}

type ApiResponse = { data: UniversalSearchResponse | null; error: { code: string; message: string } | null }

export function CommandPalette({ open, onClose, initialMode = 'quick' }: Props) {
  const router = useRouter()
  const track = useTrack()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UniversalSearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [advancedOpen, setAdvancedOpen] = useState(initialMode === 'advanced')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const settledRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setActiveIdx(0)
      settledRef.current = new Set()
      setAdvancedOpen(initialMode === 'advanced')
      track('page_view', {
        metadata: { event: 'search_palette_opened', mode: initialMode },
      })
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open, initialMode, track])

  useEffect(() => {
    if (!open) return
    if (query.trim().length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    abortRef.current?.abort()
    abortRef.current = ctrl
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/search/universal?q=${encodeURIComponent(query.trim())}`, { signal: ctrl.signal })
        .then(r => r.json() as Promise<ApiResponse>)
        .then(r => {
          if (ctrl.signal.aborted) return
          setResults(r.data)
          setActiveIdx(0)
        })
        .catch(() => { /* aborted or network — ignore */ })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    }, 300)

    // Settled-query telemetry: 500ms after stop typing, deduped per open session.
    const settleTimer = setTimeout(() => {
      const q = query.trim()
      if (q.length >= 3 && !settledRef.current.has(q)) {
        settledRef.current.add(q)
        track('page_view', {
          metadata: { event: 'search_query_settled', query: q },
        })
      }
    }, 500)

    return () => { clearTimeout(t); clearTimeout(settleTimer); ctrl.abort() }
  }, [query, open, track])

  const flat = useMemo<UniversalSearchHit[]>(() => {
    if (!results) return []
    const out: UniversalSearchHit[] = []
    for (const e of SEARCH_ENTITIES) {
      if (e.scope === 'stub') continue
      const rows = (results[e.id as keyof UniversalSearchResponse] as UniversalSearchHit[] | undefined) ?? []
      out.push(...rows.slice(0, VISIBLE_PER_GROUP))
      if (out.length >= TOTAL_HIT_CAP) break
    }
    return out.slice(0, TOTAL_HIT_CAP)
  }, [results])

  const navigate = useCallback((hit: UniversalSearchHit) => {
    pushRecent(query)
    const pos = flat.findIndex(h => h.id === hit.id && h.kind === hit.kind)
    track('page_view', {
      metadata: {
        event: 'search_result_clicked',
        entity_id: hit.kind,
        query: query.trim(),
        position: pos,
      },
    })
    onClose()
    router.push(hit.href)
  }, [onClose, router, query, flat, track])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, Math.max(flat.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = flat[activeIdx]
      if (hit) navigate(hit)
    }
  }, [flat, activeIdx, navigate, onClose])

  if (!open) return null

  if (advancedOpen) {
    return (
      <AdvancedSearchModal
        open={advancedOpen}
        onClose={() => { setAdvancedOpen(false); onClose() }}
      />
    )
  }

  const totalHits = flat.length
  let runningBase = 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda universal"
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 'max(10vh, 24px)',
        background: 'rgba(3, 5, 8, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(680px, calc(100vw - 24px))',
          maxHeight: 'min(70vh, 640px)',
          display: 'flex', flexDirection: 'column',
          background: ZAPATA.BG_ELEVATED,
          border: `1px solid ${ZAPATA.BORDER_HAIRLINE}`,
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          overflow: 'hidden',
          fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif',
          color: '#E6EDF3',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px',
          borderBottom: `1px solid ${ZAPATA.BORDER_HAIRLINE}`,
        }}>
          <span aria-hidden style={{ color: ZAPATA.ACCENT_SILVER, fontSize: 18 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar embarques, pedimentos, proveedores…"
            aria-label="Buscar"
            style={{
              flex: 1, minWidth: 0, minHeight: 32,
              background: 'transparent', border: 'none', outline: 'none',
              color: '#E6EDF3', fontSize: 16,
              fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif',
            }}
          />
          <kbd style={{
            fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace', fontSize: 11,
            color: ZAPATA.TEXT_TERTIARY, border: `1px solid ${ZAPATA.BORDER_HAIRLINE}`,
            borderRadius: 6, padding: '2px 8px',
          }}>Esc</kbd>
        </div>

        <div style={{ overflowY: 'auto', padding: '8px 0', flex: 1 }}>
          {loading && (
            <div style={{ padding: '20px', color: ZAPATA.TEXT_TERTIARY, fontSize: 13 }}>Cargando…</div>
          )}
          {!loading && query.trim().length < 2 && (
            <SmartSuggestions
              onPick={(q) => setQuery(q)}
              onSuggestionClick={(type) => {
                track('page_view', {
                  metadata: {
                    event: type === 'recent' ? 'search_recent_clicked' : 'search_suggestion_clicked',
                    suggestion_type: type,
                  },
                })
              }}
            />
          )}
          {!loading && query.trim().length >= 2 && totalHits === 0 && (
            <div style={{ padding: '24px 20px', color: ZAPATA.TEXT_TERTIARY, fontSize: 13 }}>
              Sin resultados para &ldquo;{query.trim()}&rdquo;.
            </div>
          )}

          {!loading && totalHits > 0 && SEARCH_ENTITIES.map(cfg => {
            const rows = (results?.[cfg.id as keyof UniversalSearchResponse] as UniversalSearchHit[] | undefined) ?? []
            if (cfg.scope !== 'stub' && rows.length === 0) return null
            const baseIdx = runningBase
            if (cfg.scope !== 'stub') runningBase += Math.min(rows.length, VISIBLE_PER_GROUP)
            return (
              <SearchResultGroup
                key={cfg.id}
                config={cfg}
                rows={rows}
                visibleCount={VISIBLE_PER_GROUP}
                activeGlobalIdx={activeIdx}
                baseIdx={baseIdx}
                onActivate={setActiveIdx}
                onNavigate={navigate}
                onMoreClick={() => {
                  track('page_view', {
                    metadata: { event: 'search_group_more_clicked', entity_id: cfg.id as EntityId, query: query.trim() },
                  })
                  onClose()
                  router.push(`${cfg.listHref}?q=${encodeURIComponent(query.trim())}`)
                }}
              />
            )
          })}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, padding: '10px 20px',
          borderTop: `1px solid ${ZAPATA.BORDER_HAIRLINE}`,
          fontSize: 11, color: ZAPATA.TEXT_TERTIARY,
          fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
        }}>
          <span>↑↓ navegar · ⏎ abrir · esc cerrar</span>
          <button
            type="button"
            onClick={() => setAdvancedOpen(true)}
            style={{
              background: 'transparent', border: 'none',
              color: ZAPATA.TEXT_TERTIARY, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 11, padding: 0,
            }}
          >
            Búsqueda avanzada · Shift+⌘K
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          [role="dialog"][aria-label="Búsqueda universal"] > div {
            width: 100vw !important;
            max-height: 100vh !important;
            height: 100vh !important;
            border-radius: 0 !important;
            margin: 0 !important;
          }
          [role="dialog"][aria-label="Búsqueda universal"] {
            padding-top: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}

export default CommandPalette
