'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UniversalSearchHit,
  UniversalSearchResponse,
  GROUP_LABELS_ES,
  GROUP_LIST_HREFS,
} from '@/lib/search/types'

type GroupKey = keyof typeof GROUP_LABELS_ES

const GROUP_ORDER: GroupKey[] = [
  'traficos', 'entradas', 'pedimentos',
  'proveedores', 'productos', 'fracciones', 'documentos',
]

const VISIBLE_PER_GROUP = 3

interface Props {
  open: boolean
  onClose: () => void
}

type ApiResponse = { data: UniversalSearchResponse | null; error: { code: string; message: string } | null }

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UniversalSearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

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
    }, 150)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [query, open])

  const flat = useMemo<UniversalSearchHit[]>(() => {
    if (!results) return []
    const out: UniversalSearchHit[] = []
    for (const g of GROUP_ORDER) {
      const rows = results[g].slice(0, VISIBLE_PER_GROUP)
      out.push(...rows)
    }
    return out
  }, [results])

  const navigate = useCallback((hit: UniversalSearchHit) => {
    onClose()
    router.push(hit.href)
  }, [onClose, router])

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

  let runningIdx = 0
  const totalHits = flat.length

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
          background: 'rgba(9, 9, 11, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 229, 255, 0.18)',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(0,229,255,0.12)',
          overflow: 'hidden',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span aria-hidden style={{ color: '#00E5FF', fontSize: 18 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar tráficos, pedimentos, proveedores…"
            aria-label="Buscar"
            style={{
              flex: 1, minWidth: 0, minHeight: 32,
              background: 'transparent', border: 'none', outline: 'none',
              color: '#E6EDF3', fontSize: 16,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          />
          <kbd style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
            color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6, padding: '2px 8px',
          }}>Esc</kbd>
        </div>

        <div style={{ overflowY: 'auto', padding: '8px 0' }}>
          {loading && (
            <div style={{ padding: '20px', color: '#94a3b8', fontSize: 13 }}>Cargando…</div>
          )}
          {!loading && query.trim().length >= 2 && totalHits === 0 && (
            <div style={{ padding: '24px 20px', color: '#94a3b8', fontSize: 13 }}>
              Sin resultados para &ldquo;{query.trim()}&rdquo;.
            </div>
          )}
          {!loading && query.trim().length < 2 && (
            <div style={{ padding: '20px', color: '#64748b', fontSize: 12 }}>
              Escribe al menos 2 caracteres. Prueba un número de tráfico, pedimento, fracción o nombre de proveedor.
            </div>
          )}

          {!loading && totalHits > 0 && GROUP_ORDER.map(g => {
            const rows = results?.[g] ?? []
            if (rows.length === 0) return null
            const visible = rows.slice(0, VISIBLE_PER_GROUP)
            const extra = rows.length - visible.length
            return (
              <div key={g} style={{ padding: '6px 0' }}>
                <div style={{
                  padding: '6px 20px',
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: '#64748b',
                }}>
                  {GROUP_LABELS_ES[g]}
                </div>
                {visible.map(hit => {
                  const idx = runningIdx++
                  const isActive = idx === activeIdx
                  return (
                    <button
                      key={`${hit.kind}-${hit.id}-${idx}`}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => navigate(hit)}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 2,
                        width: '100%', minHeight: 60, textAlign: 'left',
                        padding: '10px 20px',
                        background: isActive ? 'rgba(0,229,255,0.08)' : 'transparent',
                        borderLeft: isActive ? '2px solid #00E5FF' : '2px solid transparent',
                        border: 'none', borderRadius: 0, cursor: 'pointer',
                        color: '#E6EDF3',
                      }}
                    >
                      <span style={{
                        fontFamily: /^\d|\./.test(hit.title) ? 'JetBrains Mono, monospace' : 'Inter, system-ui, sans-serif',
                        fontSize: 14, fontWeight: 600,
                      }}>{hit.title}</span>
                      {hit.subtitle && (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{hit.subtitle}</span>
                      )}
                    </button>
                  )
                })}
                {extra > 0 && (
                  <button
                    onClick={() => { onClose(); router.push(GROUP_LIST_HREFS[g]) }}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '8px 20px', minHeight: 36,
                      background: 'transparent', border: 'none',
                      color: '#00E5FF', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Ver más en {GROUP_LABELS_ES[g]} →
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, padding: '10px 20px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          fontSize: 11, color: '#64748b',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          <span>↑↓ navegar · ⏎ abrir · esc cerrar</span>
          {results && <span>{results.took_ms} ms</span>}
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
