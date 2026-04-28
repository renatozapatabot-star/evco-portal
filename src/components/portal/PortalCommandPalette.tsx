'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Truck,
  FileText,
  Package,
  ClipboardList,
  Users,
  Sparkles,
  Search,
  ArrowRight,
} from 'lucide-react'
import { PortalBadge } from './PortalBadge'

/**
 * Universal search + AI-ask surface — PORTAL command palette.
 *
 * Pre-demo rewrite (2026-04-22) of the previous placeholder stub that
 * rendered 4 dead suggestion buttons. Now wired to `/api/search` and
 * routes "ask intent" queries to `/cruz?q=...` (the real CRUZ AI
 * chat). Chrome (backdrop + centered card + pulse dot + input row)
 * is preserved from the original design; only the guts change.
 *
 * Data contract with /api/search (unchanged):
 *   { type: 'search_results', results: Array<{ type, id, title, sub, date?, view?, href? }> }
 *   — OR when q is exactly 7 digits —
 *   { type: 'pedimento_chain', pedimento: {...}, trafico: {...} }
 *
 * Keyboard:
 *   ↑↓ navigate · ↵ open · Esc close · ⌘K toggles (handled by useCmdK
 *   at the caller; backdrop click + Esc on the input call onClose).
 *
 * Tenant isolation: /api/search already filters by session.companyId
 * for non-internal roles. This component never reads tenant state
 * directly — it just renders whatever the API returns.
 */

export type PaletteResultType =
  | 'trafico'
  | 'entrada'
  | 'factura'
  | 'anexo24'
  | 'producto'
  | 'proveedor'
  | 'partida'

export interface PaletteSearchResult {
  type: PaletteResultType | string
  id: string
  title: string
  sub?: string
  date?: string | null
  view?: string
  href?: string
}

export interface PortalCommandPaletteProps {
  open: boolean
  onClose: () => void
  placeholder?: string
}

interface SuggestionChip {
  id: string
  label: string
  href: string
}

/** Empty-state suggestions — each routes to a real page when clicked. */
const EMPTY_SUGGESTIONS: SuggestionChip[] = [
  { id: 's1', label: 'Ver embarques en tránsito', href: '/embarques?status=en_transito' },
  { id: 's2', label: 'Mostrar último pedimento', href: '/pedimentos' },
  { id: 's3', label: 'SKUs en Anexo 24 por revisar', href: '/anexo-24' },
  { id: 's4', label: 'Expedientes del mes', href: '/expedientes' },
]

const TYPE_LABEL: Record<string, string> = {
  trafico: 'Embarque',
  entrada: 'Entrada',
  factura: 'Pedimento',
  anexo24: 'Anexo 24',
  producto: 'SKU',
  proveedor: 'Proveedor',
  partida: 'Partida',
  documento: 'Documento',
}

function iconFor(type: string) {
  switch (type) {
    case 'trafico': return <Truck size={15} strokeWidth={1.8} />
    case 'entrada': return <Package size={15} strokeWidth={1.8} />
    case 'factura': return <FileText size={15} strokeWidth={1.8} />
    case 'anexo24':
    case 'producto': return <ClipboardList size={15} strokeWidth={1.8} />
    case 'proveedor': return <Users size={15} strokeWidth={1.8} />
    case 'partida': return <FileText size={15} strokeWidth={1.8} />
    default: return <Search size={15} strokeWidth={1.8} />
  }
}

function hrefFor(r: PaletteSearchResult): string {
  if (r.href) return r.href
  switch (r.type) {
    case 'trafico': return `/embarques/${encodeURIComponent(r.id)}`
    case 'entrada': return `/entradas?q=${encodeURIComponent(r.title)}`
    case 'factura': return `/pedimentos?search=${encodeURIComponent(r.title)}`
    case 'producto':
    case 'anexo24':  return `/anexo-24/${encodeURIComponent(r.title)}`
    case 'proveedor': return `/catalogo?q=${encodeURIComponent(r.title)}`
    case 'partida': return `/embarques/${encodeURIComponent(r.id)}`
    default: return '/inicio'
  }
}

/**
 * Long or question-like queries are treated as "ask the agent"
 * intent — a question mark, an "ayúdame"/"pregúntame" opener, or
 * 4+ words all promote the first row to route to /cruz. Mirrors the
 * heuristic in `src/components/command/CruzCommand.tsx` so both
 * surfaces behave identically.
 */
function detectAskIntent(q: string): boolean {
  const t = q.trim()
  if (!t) return false
  if (t.includes('?')) return true
  const lower = t.toLowerCase()
  if (lower.startsWith('pregunt') || lower.startsWith('ayúdame') || lower.startsWith('ayudame')) return true
  const words = t.split(/\s+/).filter(Boolean)
  return words.length >= 4
}

export function PortalCommandPalette({
  open,
  onClose,
  placeholder = "Busca pedimento, embarque, proveedor… o pregúntale al Agente IA",
}: PortalCommandPaletteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [value, setValue] = useState('')
  const [results, setResults] = useState<PaletteSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  const askIntent = detectAskIntent(value)
  const hasQuery = value.trim().length >= 2

  // Reset state every time the palette opens. Input autofocus happens
  // via the `autoFocus` attribute on mount below.
  useEffect(() => {
    if (open) {
      setValue('')
      setResults([])
      setActiveIdx(0)
      setLoading(false)
    }
  }, [open])

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Debounced search — 160ms after the last keystroke, identical
  // cadence to CruzCommand.
  useEffect(() => {
    if (!open) return
    const q = value.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
          credentials: 'same-origin',
        })
        if (!res.ok) {
          setResults([])
          setLoading(false)
          return
        }
        const body = await res.json()
        if (body.type === 'pedimento_chain') {
          const trafId = body.trafico?.trafico_id ?? body.pedimento?.num
          setResults(trafId ? [{
            type: 'factura',
            id: String(trafId),
            title: body.pedimento?.num ?? String(trafId),
            sub: `Pedimento directo · ${body.trafico?.estatus ?? ''}`.trim(),
            href: `/embarques/${encodeURIComponent(String(trafId))}`,
          }] : [])
        } else {
          const rows = (body.results as PaletteSearchResult[]) ?? []
          setResults(rows.slice(0, 12))
        }
        setActiveIdx(0)
      } catch {
        // aborted or network error — leave prior state, never throw.
      } finally {
        setLoading(false)
      }
    }, 160)
    return () => {
      ctrl.abort()
      window.clearTimeout(id)
    }
  }, [open, value])

  // Flattened row list for arrow-key navigation. The ask-intent row
  // (when present) sits at the top and routes to /cruz?q=...
  const rows = useMemo(() => {
    const list: Array<{ kind: 'ask' | 'result'; result?: PaletteSearchResult }> = []
    if (askIntent) list.push({ kind: 'ask' })
    for (const r of results) list.push({ kind: 'result', result: r })
    return list
  }, [askIntent, results])

  const navigateTo = useCallback((href: string) => {
    onClose()
    router.push(href)
  }, [onClose, router])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, rows.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[activeIdx]
      if (!row) {
        if (value.trim().length > 0) {
          navigateTo(`/cruz?q=${encodeURIComponent(value.trim())}`)
        }
        return
      }
      if (row.kind === 'ask') {
        navigateTo(`/cruz?q=${encodeURIComponent(value.trim())}`)
      } else if (row.result) {
        navigateTo(hrefFor(row.result))
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [rows, activeIdx, value, navigateTo, onClose])

  if (!open) return null

  const showEmpty = !hasQuery && !askIntent
  const showNoResults = hasQuery && !loading && results.length === 0 && !askIntent

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 120,
        animation: 'portalFadeUp 200ms var(--portal-ease-out)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda y agente"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(620px, 92vw)',
          background: 'var(--portal-ink-2)',
          border: '1px solid var(--portal-line-3)',
          borderRadius: 'var(--portal-r-4)',
          boxShadow: 'var(--portal-shadow-3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'min(70vh, 620px)',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--portal-line-1)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--portal-green-2)',
              boxShadow: '0 0 8px var(--portal-green-glow)',
              animation: 'portalDotPulse 2s ease-in-out infinite',
              flexShrink: 0,
            }}
          />
          <input
            ref={inputRef}
            autoFocus
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
            aria-label="Buscar en PORTAL"
            aria-controls="portal-palette-results"
            style={{
              flex: 1,
              background: 'transparent',
              border: 0,
              outline: 'none',
              fontSize: 'var(--portal-fs-md)',
              color: 'var(--portal-fg-1)',
              fontFamily: 'var(--portal-font-sans)',
              minWidth: 0,
            }}
          />
          <PortalBadge>ESC</PortalBadge>
        </div>

        <div
          id="portal-palette-results"
          role="listbox"
          style={{
            padding: 14,
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          {showEmpty && (
            <>
              <div className="portal-eyebrow" style={{ padding: '4px 8px 10px' }}>
                SUGERENCIAS
              </div>
              {EMPTY_SUGGESTIONS.map((s) => (
                <Link
                  key={s.id}
                  href={s.href}
                  onClick={() => onClose()}
                  role="option"
                  aria-selected={false}
                  style={{
                    width: '100%',
                    padding: '10px 8px',
                    borderRadius: 'var(--portal-r-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'left',
                    color: 'var(--portal-fg-2)',
                    fontSize: 'var(--portal-fs-sm)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLAnchorElement).style.background = 'var(--portal-ink-3)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                  }}
                >
                  <span
                    style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: 'rgba(192,197,206,0.06)',
                      border: '1px solid var(--portal-line-1)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--portal-fg-4)',
                      flexShrink: 0,
                    }}
                    aria-hidden
                  >
                    <Search size={13} strokeWidth={1.8} />
                  </span>
                  <span style={{ flex: 1 }}>{s.label}</span>
                  <ArrowRight size={12} strokeWidth={2} style={{ color: 'var(--portal-fg-5)' }} />
                </Link>
              ))}
            </>
          )}

          {!showEmpty && (
            <>
              {loading && rows.length === 0 && (
                <div style={{
                  padding: '14px 12px',
                  fontSize: 'var(--portal-fs-sm)',
                  color: 'var(--portal-fg-4)',
                }}>
                  Buscando…
                </div>
              )}

              {showNoResults && (
                <div style={{
                  padding: '14px 12px',
                  fontSize: 'var(--portal-fs-sm)',
                  color: 'var(--portal-fg-4)',
                }}>
                  Sin resultados para &ldquo;{value.trim()}&rdquo;
                </div>
              )}

              {rows.map((row, i) => {
                const active = i === activeIdx
                if (row.kind === 'ask') {
                  return (
                    <button
                      key="ask"
                      type="button"
                      onClick={() => navigateTo(`/cruz?q=${encodeURIComponent(value.trim())}`)}
                      role="option"
                      aria-selected={active}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--portal-r-2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        textAlign: 'left',
                        background: active
                          ? 'color-mix(in oklch, var(--portal-green-2) 10%, transparent)'
                          : 'transparent',
                        border: active
                          ? '1px solid color-mix(in oklch, var(--portal-green-2) 35%, transparent)'
                          : '1px solid transparent',
                        cursor: 'pointer',
                        marginBottom: 4,
                        color: 'var(--portal-fg-1)',
                      }}
                    >
                      <span
                        style={{
                          width: 32, height: 32, borderRadius: 10,
                          background: 'color-mix(in oklch, var(--portal-green-2) 12%, transparent)',
                          border: '1px solid color-mix(in oklch, var(--portal-green-2) 40%, transparent)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--portal-green-2)',
                          flexShrink: 0,
                        }}
                        aria-hidden
                      >
                        <Sparkles size={15} strokeWidth={1.8} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 'var(--portal-fs-sm)',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          Preguntarle al Agente IA sobre &ldquo;{value.trim()}&rdquo;
                        </div>
                        <div style={{
                          fontSize: "var(--portal-fs-xs)",
                          color: 'var(--portal-fg-4)',
                          marginTop: 2,
                        }}>
                          El asistente responde con tus datos reales
                        </div>
                      </span>
                      <ArrowRight size={12} strokeWidth={2} style={{ color: 'var(--portal-fg-5)' }} aria-hidden />
                    </button>
                  )
                }
                const r = row.result!
                const typeLabel = TYPE_LABEL[r.type] ?? r.type
                return (
                  <button
                    key={`${r.type}-${r.id}-${i}`}
                    type="button"
                    onClick={() => navigateTo(hrefFor(r))}
                    role="option"
                    aria-selected={active}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--portal-r-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      textAlign: 'left',
                      background: active ? 'var(--portal-ink-3)' : 'transparent',
                      border: active
                        ? '1px solid var(--portal-line-3)'
                        : '1px solid transparent',
                      cursor: 'pointer',
                      marginBottom: 2,
                      color: 'var(--portal-fg-1)',
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <span
                      style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: 'rgba(192,197,206,0.06)',
                        border: '1px solid var(--portal-line-1)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--portal-fg-3)',
                        flexShrink: 0,
                      }}
                      aria-hidden
                    >
                      {iconFor(r.type)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}>
                        <span
                          className="portal-num"
                          style={{
                            fontSize: 'var(--portal-fs-sm)',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                          }}
                        >
                          {r.title}
                        </span>
                        <span style={{
                          fontSize: "var(--portal-fs-xs)",
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--portal-fg-5)',
                        }}>
                          {typeLabel}
                        </span>
                      </div>
                      {r.sub && (
                        <div style={{
                          fontSize: "var(--portal-fs-xs)",
                          color: 'var(--portal-fg-4)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {r.sub}
                        </div>
                      )}
                    </span>
                  </button>
                )
              })}
            </>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 14,
            padding: '8px 14px 10px',
            borderTop: '1px solid var(--portal-line-1)',
            fontSize: "var(--portal-fs-xs)",
            color: 'var(--portal-fg-5)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>esc cerrar</span>
        </div>
      </div>
    </div>
  )
}
