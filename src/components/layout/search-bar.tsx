'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const T = {
  surface: 'var(--bg-card)', border: 'var(--border-primary)', surfaceAlt: 'var(--bg-elevated)',
  text: 'var(--text-primary)', textSub: 'var(--text-secondary)', textMuted: 'var(--text-muted)',
  navy: 'var(--amber-600)', shadow: 'var(--shadow-lg)',
}

const TYPE_ICONS: Record<string, string> = {
  trafico: '🚢', entrada: '📦', factura: '📄',
}

type SearchResult = {
  type: string
  id: string
  title: string
  sub: string
  date: string
  view: string
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(-1)
  const [focused, setFocused] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.results || [])
        setOpen(true)
      } catch { setResults([]) }
      setLoading(false)
    }, 300)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [query])

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, -1)) }
    if (e.key === 'Enter' && selected >= 0) { handleSelect(results[selected]) }
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  function handleSelect(result: SearchResult) {
    const href = result.type === 'trafico'
      ? `/embarques/${encodeURIComponent(result.id)}`
      : result.type === 'entrada'
        ? `/entradas/${encodeURIComponent(result.id)}`
        : `/${result.view}`
    router.push(href)
    setQuery('')
    setOpen(false)
    setSelected(-1)
  }

  function fmtDate(d: string) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 600 }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, fontSize: 'var(--aguila-fs-section)', pointerEvents: 'none' }}>🔍</span>
        <input value={query}
          onChange={e => { setQuery(e.target.value); setSelected(-1) }}
          onKeyDown={handleKey}
          onFocus={() => { setFocused(true); results.length > 0 && setOpen(true) }}
          onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 150) }}
          placeholder="Buscar embarque, pedimento..."
          style={{ paddingLeft: 32, paddingRight: loading ? 32 : 12, height: 32,
            border: `1px solid ${focused ? 'rgba(192,197,206,0.5)' : T.border}`, borderRadius: 7, background: T.surface,
            color: T.text, fontSize: 'var(--aguila-fs-compact)', outline: 'none', width: '100%', fontFamily: 'inherit',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: focused ? '0 0 0 2px rgba(192,197,206,0.1)' : 'none',
          }} />
        {loading && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            width: 12, height: 12, border: `2px solid #E6E3DC`, borderTopColor: T.navy,
            borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
          boxShadow: T.shadow, zIndex: 1000, overflow: 'hidden' }}>
          {results.map((r, i) => (
            <div key={`${r.type}-${r.id}-${i}`}
              onMouseDown={() => handleSelect(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: i === selected ? T.surfaceAlt : T.surface,
                borderBottom: i < results.length - 1 ? `1px solid ${T.border}` : 'none',
                cursor: 'pointer' }}>
              <span style={{ fontSize: 'var(--aguila-fs-body-lg)', flexShrink: 0 }}>{TYPE_ICONS[r.type] || '📋'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: T.text, fontSize: 'var(--aguila-fs-compact)', fontWeight: 600 }}>{r.title}</div>
                <div style={{ color: T.textMuted, fontSize: 'var(--aguila-fs-meta)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {r.date && <span style={{ color: T.textMuted, fontSize: 'var(--aguila-fs-label)' }}>{fmtDate(r.date)}</span>}
                <span style={{ background: T.surfaceAlt, color: T.textMuted, border: `1px solid ${T.border}`,
                  borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>{r.type}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && results.length === 0 && query.length >= 2 && !loading && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
          boxShadow: T.shadow, zIndex: 1000, padding: '16px 14px', textAlign: 'center' }}>
          <span style={{ color: T.textMuted, fontSize: 'var(--aguila-fs-compact)' }}>Sin resultados para &ldquo;{query}&rdquo;</span>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
