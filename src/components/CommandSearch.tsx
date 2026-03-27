'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Truck, FileText, Package, Factory, Clock } from 'lucide-react'

interface Result { type: string; id: string; primary: string; secondary?: string; href: string }

const ICONS: Record<string, any> = { traficos: Truck, entradas: Package, pedimentos: FileText, proveedores: Factory }
const LABELS: Record<string, string> = { traficos: 'Traficos', entradas: 'Entradas', pedimentos: 'Pedimentos', proveedores: 'Proveedores' }

export function CommandSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(0)
  const [recents, setRecents] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    setRecents(JSON.parse(localStorage.getItem('cmd-search-recent') || '[]'))
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json())
      const items: Result[] = []
      ;(res.traficos || []).slice(0, 3).forEach((r: any) => items.push({ type: 'traficos', id: r.trafico, primary: r.trafico, secondary: r.descripcion_mercancia?.substring(0, 40), href: '/traficos' }))
      ;(res.entradas || []).slice(0, 3).forEach((r: any) => items.push({ type: 'entradas', id: r.cve_entrada, primary: r.cve_entrada, secondary: r.descripcion_mercancia?.substring(0, 40), href: '/entradas' }))
      ;(res.pedimentos || []).slice(0, 3).forEach((r: any) => items.push({ type: 'pedimentos', id: r.pedimento || r.referencia, primary: r.pedimento || r.referencia, secondary: r.proveedor, href: '/pedimentos' }))
      ;(res.proveedores || []).slice(0, 3).forEach((r: any) => items.push({ type: 'proveedores', id: r.nombre || r.proveedor, primary: r.nombre || r.proveedor, secondary: r.pais, href: '/proveedores' }))
      setResults(items)
    } catch { setResults([]) }
    setSearching(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 200)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  const navigate = (r: Result) => {
    const updated = [query, ...recents.filter(x => x !== query)].slice(0, 5)
    localStorage.setItem('cmd-search-recent', JSON.stringify(updated))
    setRecents(updated)
    setOpen(false); setQuery('')
    router.push(r.href)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) navigate(results[selected])
  }

  if (!open) return null

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    ;(acc[r.type] = acc[r.type] || []).push(r); return acc
  }, {})

  return (
    <div onClick={() => setOpen(false)} style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 640, background: 'var(--bg-card)',
        borderRadius: 12, border: '1px solid var(--border-primary)', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border-default)' }}>
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKey} placeholder="Buscar trafico, pedimento, proveedor..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 18, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-dim)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--data)' }}>ESC</span>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
          {searching && <div style={{ padding: '24px 20px', color: 'var(--text-muted)', fontSize: 14 }}>Buscando...</div>}

          {!searching && query && results.length === 0 && (
            <div style={{ padding: '24px 20px', color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
              Sin resultados para &quot;{query}&quot;
            </div>
          )}

          {!searching && Object.entries(grouped).map(([type, items]) => {
            const Icon = ICONS[type] || FileText
            return (
              <div key={type}>
                <div style={{ padding: '8px 20px 4px', fontSize: 12, fontWeight: 600, color: 'var(--amber-700)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {LABELS[type] || type}
                </div>
                {items.map((r, i) => {
                  const globalIdx = results.indexOf(r)
                  return (
                    <div key={r.id + i} onClick={() => navigate(r)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
                        cursor: 'pointer', background: globalIdx === selected ? 'var(--bg-elevated)' : 'transparent',
                        transition: 'background 80ms',
                      }}
                      onMouseEnter={() => setSelected(globalIdx)}
                    >
                      <Icon size={14} style={{ color: 'var(--border-primary)', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{r.primary}</div>
                        {r.secondary && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.secondary}</div>}
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Ver &rarr;</span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {!query && recents.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 20px 4px' }}>
                <span style={{ fontSize: 12, color: 'var(--border-primary)', fontWeight: 600 }}>BUSQUEDAS RECIENTES</span>
                <button onClick={() => { localStorage.removeItem('cmd-search-recent'); setRecents([]) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)' }}>Limpiar</button>
              </div>
              {recents.map((q, i) => (
                <div key={i} onClick={() => setQuery(q)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', cursor: 'pointer',
                }}>
                  <Clock size={12} style={{ color: 'var(--text-dim)' }} />
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{q}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
