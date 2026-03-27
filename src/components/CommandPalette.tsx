'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Result = { type: string; id: string; title: string; sub: string; date?: string; href: string }
const TYPE_ICONS: Record<string, string> = { trafico: '🚢', entrada: '📦', factura: '📄' }

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [selected, setSelected] = useState(-1)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') { setOpen(false); setQuery(''); setResults([]) }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults((data.results || []).map((r: any) => ({
        ...r, href: `/${r.view || 'traficos'}`,
      })))
    } catch { setResults([]) }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(query), 200)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, search])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, -1)) }
    if (e.key === 'Enter' && selected >= 0 && results[selected]) {
      router.push(results[selected].href)
      setOpen(false); setQuery(''); setResults([])
    }
  }

  function selectResult(r: Result) {
    router.push(r.href)
    setOpen(false); setQuery(''); setResults([])
  }

  function fmtDate(d?: string) {
    if (!d) return ''
    try { return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) } catch { return '' }
  }

  if (!open) return null

  return (
    <>
      <div onClick={() => { setOpen(false); setQuery(''); setResults([]) }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 300 }} />
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 520, background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.25)', zIndex: 301, overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>🔍</span>
          <input ref={inputRef} value={query}
            onChange={e => { setQuery(e.target.value); setSelected(-1) }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar tráfico, pedimento, proveedor..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 15, fontFamily: 'inherit' }} />
          <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '2px 6px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'inherit' }}>ESC</kbd>
        </div>

        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Buscando...</div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Sin resultados para &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && results.length > 0 && results.map((r, i) => (
            <div key={`${r.type}-${r.id}-${i}`}
              onClick={() => selectResult(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                background: i === selected ? 'var(--bg-elevated)' : 'transparent',
                cursor: 'pointer', borderBottom: '1px solid var(--border-soft)' }}
              onMouseEnter={() => setSelected(i)}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{TYPE_ICONS[r.type] || '📋'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {r.date && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{fmtDate(r.date)}</span>}
                <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>{r.type}</span>
              </div>
            </div>
          ))}

          {query.length < 2 && !loading && (
            <div style={{ padding: '16px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Accesos rápidos</div>
              {[
                { label: 'Tráficos', href: '/traficos', icon: '🚢' },
                { label: 'Pedimentos', href: '/pedimentos', icon: '📄' },
                { label: 'Entradas', href: '/entradas', icon: '📦' },
                { label: 'Reportes', href: '/reportes', icon: '📊' },
                { label: 'OCA Generator', href: '/oca', icon: '⚖️' },
                { label: 'Cotización', href: '/cotizacion', icon: '💰' },
              ].map(link => (
                <div key={link.href} onClick={() => { router.push(link.href); setOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
                    cursor: 'pointer', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 13 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span>{link.icon}</span> {link.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>↑↓ navegar</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>↵ seleccionar</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>esc cerrar</span>
        </div>
      </div>
    </>
  )
}
