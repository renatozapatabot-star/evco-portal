'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Sparkles,
  ArrowRight,
  FileText,
  Truck,
  Package,
  ClipboardList,
  Users,
  Receipt,
  CornerDownLeft,
  X,
} from 'lucide-react'

/**
 * CruzCommand — universal command bar + search surface.
 *
 * This is the 10/10 moment: one input, live results, AI mode, keyboard
 * shortcut. Ships on every authenticated page via DashboardShellClient.
 *
 * Design notes:
 *   · Glass hero chemistry (rgba(0,0,0,0.4) + blur(20px) saturate(1.2)).
 *   · Cycling placeholder telegraphs the range of things PORTAL knows.
 *   · Results dropdown opens with the --ease-brand curve.
 *   · Question-mark detection promotes "Ask PORTAL" to the top row.
 *   · ⌘K / Ctrl+K focuses from anywhere on the page.
 *   · Esc blurs. ↑↓ navigates. Enter picks.
 *
 * Data contract with /api/search (hardened 2026-04-19):
 *   { results: Array<{ type, id, title, sub, date, view, href? }> }
 *
 * A single parent wraps the hero-mode version (tall, centered) and the
 * compact-mode version (fixed-top). The visual differences are purely
 * presentational; both bind to the same logic.
 */

export type CruzCommandMode = 'hero' | 'compact'

interface Props {
  mode?: CruzCommandMode
  placeholder?: string
  autoFocus?: boolean
}

interface SearchResult {
  type: string
  id: string
  title: string
  sub?: string
  date?: string | null
  view?: string
  href?: string
}

const CYCLE_PLACEHOLDERS = [
  'Busca un pedimento…',
  'Busca un embarque…',
  'Busca un SKU del Anexo 24…',
  'Busca una fracción arancelaria…',
  'Busca un proveedor…',
  'Pregúntale a PORTAL cualquier cosa…',
]

const ICONS: Record<string, (p: { size: number }) => React.ReactElement> = {
  trafico: ({ size }) => <Truck size={size} strokeWidth={1.8} />,
  entrada: ({ size }) => <Package size={size} strokeWidth={1.8} />,
  factura: ({ size }) => <Receipt size={size} strokeWidth={1.8} />,
  anexo24: ({ size }) => <ClipboardList size={size} strokeWidth={1.8} />,
  producto: ({ size }) => <ClipboardList size={size} strokeWidth={1.8} />,
  proveedor: ({ size }) => <Users size={size} strokeWidth={1.8} />,
  partida: ({ size }) => <FileText size={size} strokeWidth={1.8} />,
}

function iconFor(type: string, size = 16) {
  const C = ICONS[type] ?? ICONS.factura
  return <C size={size} />
}

function hrefFor(r: SearchResult): string {
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

function labelForType(type: string): string {
  switch (type) {
    case 'trafico': return 'Embarque'
    case 'entrada': return 'Entrada'
    case 'factura': return 'Pedimento'
    case 'anexo24': return 'Anexo 24'
    case 'producto': return 'SKU'
    case 'proveedor': return 'Proveedor'
    case 'partida': return 'Partida'
    default: return type
  }
}

function detectAskIntent(q: string): boolean {
  const t = q.trim()
  if (!t) return false
  if (t.includes('?') || t.toLowerCase().startsWith('pregunt') || t.toLowerCase().startsWith('ayúdame')) return true
  // 4+ words generally reads as natural language, not an entity lookup.
  const words = t.split(/\s+/).filter(Boolean)
  return words.length >= 4
}

export function CruzCommand({ mode = 'compact', placeholder, autoFocus = false }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [activeIdx, setActiveIdx] = useState(0)

  const cyclePlaceholder = placeholder ?? CYCLE_PLACEHOLDERS[placeholderIdx]
  const askIntent = detectAskIntent(value)
  const showDropdown = focused && (value.trim().length > 0 || askIntent)

  // Cycle placeholder when idle (only when unfocused + empty).
  useEffect(() => {
    if (focused || value.length > 0) return
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % CYCLE_PLACEHOLDERS.length)
    }, 3200)
    return () => clearInterval(id)
  }, [focused, value])

  // Keyboard shortcut — plain ⌘K / Ctrl+K focuses this input and wins
  // over the legacy CommandPalette modal. Capture phase so we intercept
  // BEFORE the modal's listener fires; stopImmediatePropagation keeps
  // the modal shut when the inline bar is visible. Shift+⌘K still falls
  // through to the legacy advanced-palette modal (it's a valid power
  // tool — no reason to retire it).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      if (isMeta && !e.shiftKey && e.key.toLowerCase() === 'k') {
        // Only intercept if our input is mounted in the DOM.
        if (!inputRef.current) return
        e.preventDefault()
        e.stopImmediatePropagation()
        inputRef.current.focus()
        inputRef.current.select()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  // Autofocus on hero-mode landing.
  useEffect(() => {
    if (autoFocus) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 120)
      return () => window.clearTimeout(id)
    }
  }, [autoFocus])

  // Debounced search.
  useEffect(() => {
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
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal, credentials: 'same-origin' })
        if (!res.ok) { setResults([]); setLoading(false); return }
        const body = await res.json()
        if (body.type === 'pedimento_chain') {
          // Direct pedimento match — present as single canonical result.
          const trafId = body.trafico?.trafico_id ?? body.pedimento?.num
          setResults(trafId ? [{
            type: 'factura',
            id: trafId,
            title: body.pedimento?.num ?? trafId,
            sub: `Pedimento directo · ${body.trafico?.estatus ?? ''}`.trim(),
            href: `/embarques/${encodeURIComponent(trafId)}`,
          }] : [])
        } else {
          const rows = (body.results as SearchResult[]) ?? []
          setResults(rows.slice(0, 12))
        }
        setActiveIdx(0)
      } catch {
        // aborted or network — leave prior state
      } finally {
        setLoading(false)
      }
    }, 160)
    return () => { ctrl.abort(); window.clearTimeout(id) }
  }, [value])

  const rows: Array<{ kind: 'ask' | 'result'; result?: SearchResult }> = useMemo(() => {
    const list: Array<{ kind: 'ask' | 'result'; result?: SearchResult }> = []
    if (askIntent) list.push({ kind: 'ask' })
    for (const r of results) list.push({ kind: 'result', result: r })
    return list
  }, [askIntent, results])

  const handleKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
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
        // No row — if there's an ask intent or any text, treat as "ask PORTAL".
        if (value.trim().length > 0) router.push(`/cruz?q=${encodeURIComponent(value.trim())}`)
        return
      }
      if (row.kind === 'ask') {
        router.push(`/cruz?q=${encodeURIComponent(value.trim())}`)
      } else if (row.result) {
        router.push(hrefFor(row.result))
      }
    }
  }, [rows, activeIdx, router, value])

  const isHero = mode === 'hero'
  const wrapMaxWidth = isHero ? 720 : 560

  return (
    <div
      className="cruz-command-wrap"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: wrapMaxWidth,
        margin: isHero ? '0 auto' : undefined,
      }}
    >
      <label
        htmlFor="cruz-command-input"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: isHero ? '0 18px' : '0 14px',
          minHeight: isHero ? 68 : 52,
          borderRadius: isHero ? 18 : 14,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
          border: `1px solid ${focused ? 'rgba(201,167,74,0.45)' : 'rgba(192,197,206,0.18)'}`,
          boxShadow: focused
            ? '0 18px 48px rgba(0,0,0,0.6), 0 0 0 4px rgba(201,167,74,0.12), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)',
          transition: 'border-color var(--dur-fast, 150ms) var(--ease-brand, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow var(--dur-fast, 150ms) var(--ease-brand, cubic-bezier(0.22, 1, 0.36, 1))',
          cursor: 'text',
        }}
      >
        <Search
          size={isHero ? 22 : 18}
          strokeWidth={1.8}
          color={focused ? '#F4D47A' : 'rgba(192,197,206,0.72)'}
          style={{ transition: 'color var(--dur-fast, 150ms) ease', flexShrink: 0 }}
          aria-hidden
        />
        <input
          ref={inputRef}
          id="cruz-command-input"
          type="search"
          value={value}
          placeholder={cyclePlaceholder}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setTimeout(() => setFocused(false), 120) }}
          onKeyDown={handleKey}
          autoComplete="off"
          spellCheck={false}
          aria-label="Buscar en PORTAL"
          aria-controls="cruz-command-results"
          aria-expanded={showDropdown}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--portal-fg-1)',
            fontSize: isHero ? 'var(--aguila-fs-title, 20px)' : 'var(--aguila-fs-section, 15px)',
            fontWeight: isHero ? 500 : 400,
            fontFamily: 'var(--font-sans)',
            letterSpacing: isHero ? '-0.01em' : '0',
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue('')}
            aria-label="Limpiar búsqueda"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(192,197,206,0.08)',
              border: 'none',
              color: 'rgba(192,197,206,0.8)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        )}
        <kbd
          aria-hidden
          className="cruz-command-kbd"
          style={{
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            border: '1px solid rgba(192,197,206,0.18)',
            background: 'rgba(0,0,0,0.3)',
            color: 'rgba(192,197,206,0.82)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          ⌘K
        </kbd>
      </label>

      {/* Results dropdown */}
      {showDropdown && (
        <div
          ref={listRef}
          id="cruz-command-results"
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0, right: 0,
            maxHeight: 'min(65vh, 520px)',
            overflowY: 'auto',
            borderRadius: 14,
            background: 'rgba(6,9,14,0.88)',
            backdropFilter: 'blur(24px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
            border: '1px solid rgba(192,197,206,0.14)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)',
            padding: 6,
            zIndex: 90,
            animation: 'cruzCommandDropIn 240ms var(--ease-brand, cubic-bezier(0.22, 1, 0.36, 1)) both',
          }}
        >
          {rows.length === 0 && !loading && value.trim().length >= 2 && (
            <div style={{ padding: '14px 12px', fontSize: 13, color: 'rgba(148,163,184,0.85)' }}>
              Sin resultados para &ldquo;{value.trim()}&rdquo;
            </div>
          )}

          {loading && rows.length === 0 && (
            <div style={{ padding: '14px 12px', fontSize: 13, color: 'rgba(148,163,184,0.85)' }}>
              Buscando…
            </div>
          )}

          {rows.map((row, i) => {
            const active = i === activeIdx
            if (row.kind === 'ask') {
              return (
                <Link
                  key="ask"
                  href={`/cruz?q=${encodeURIComponent(value.trim())}`}
                  role="option"
                  aria-selected={active}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: active ? 'rgba(201,167,74,0.14)' : 'transparent',
                    border: active ? '1px solid rgba(201,167,74,0.38)' : '1px solid transparent',
                    textDecoration: 'none',
                    color: 'inherit',
                    marginBottom: 4,
                  }}
                >
                  <span style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'rgba(201,167,74,0.16)',
                    border: '1px solid rgba(201,167,74,0.42)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: '#F4D47A',
                    flexShrink: 0,
                  }}>
                    <Sparkles size={16} strokeWidth={2} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--portal-fg-1)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      Preguntarle a PORTAL sobre &ldquo;{value.trim()}&rdquo;
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.75)', marginTop: 2 }}>
                      El asistente responde con tus datos reales
                    </div>
                  </span>
                  <ArrowRight size={14} strokeWidth={2} color="rgba(192,197,206,0.65)" />
                </Link>
              )
            }
            const r = row.result!
            return (
              <Link
                key={`${r.type}-${r.id}-${i}`}
                href={hrefFor(r)}
                role="option"
                aria-selected={active}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: active ? 'rgba(192,197,206,0.1)' : 'transparent',
                  border: active ? '1px solid rgba(192,197,206,0.22)' : '1px solid transparent',
                  textDecoration: 'none',
                  color: 'inherit',
                  marginBottom: 2,
                }}
              >
                <span style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'rgba(192,197,206,0.08)',
                  border: '1px solid rgba(192,197,206,0.16)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(192,197,206,0.85)',
                  flexShrink: 0,
                }}>
                  {iconFor(r.type, 16)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--portal-fg-1)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {r.title}
                    </span>
                    <span style={{
                      fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: 'rgba(192,197,206,0.6)',
                    }}>
                      {labelForType(r.type)}
                    </span>
                  </div>
                  {r.sub && (
                    <div style={{
                      fontSize: 11, color: 'rgba(148,163,184,0.78)', marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.sub}
                    </div>
                  )}
                </span>
                {active && (
                  <CornerDownLeft size={12} strokeWidth={2} color="rgba(192,197,206,0.65)" aria-hidden />
                )}
              </Link>
            )
          })}

          {/* Footer — keyboard hints */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              padding: '8px 12px 4px',
              borderTop: '1px solid rgba(192,197,206,0.08)',
              marginTop: 6,
              fontSize: 10,
              color: 'rgba(148,163,184,0.6)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <span>↑↓ navegar</span>
            <span>↵ abrir</span>
            <span>esc cerrar</span>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes cruzCommandDropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          #cruz-command-results { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
