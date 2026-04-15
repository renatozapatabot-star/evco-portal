'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, Plus, FileText, StickyNote } from 'lucide-react'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_MUTED, TEXT_SECONDARY, ACCENT_SILVER, GOLD,
} from '@/lib/design-system'

interface SearchResult {
  type: string
  id: string
  title: string
  sub: string
  date: string | null
  view: string
}

export function QuickActions() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        const json = await res.json()
        const list = (json.results || []) as SearchResult[]
        setResults(list.slice(0, 12))
        setOpen(true)
      } catch {
        /* aborted or failed — leave previous state */
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(handle)
  }, [q])

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'linear-gradient(to bottom, rgba(5,7,11,0.9), rgba(5,7,11,0.7))',
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        paddingTop: 8,
        paddingBottom: 12,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'stretch',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 360px', minWidth: 260 }}>
          <Search
            size={16}
            color={TEXT_MUTED}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => q.length >= 2 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
            placeholder="Buscar embarque, entrada, pedimento, proveedor, fracción…"
            style={{
              width: '100%',
              height: 60,
              paddingLeft: 40,
              paddingRight: 14,
              background: BG_CARD,
              backdropFilter: `blur(${GLASS_BLUR})`,
              WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
              border: `1px solid ${BORDER}`,
              borderRadius: 14,
              color: TEXT_PRIMARY,
              fontSize: 'var(--aguila-fs-section)',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) {
                window.location.href = viewHref(results[0])
              }
            }}
          />
          {open && (results.length > 0 || loading) && (
            <div
              style={{
                position: 'absolute',
                top: 66,
                left: 0,
                right: 0,
                background: 'rgba(10,14,22,0.96)',
                backdropFilter: `blur(${GLASS_BLUR})`,
                WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
                border: `1px solid ${BORDER}`,
                borderRadius: 14,
                boxShadow: GLASS_SHADOW,
                maxHeight: 420,
                overflowY: 'auto',
                zIndex: 30,
              }}
            >
              {loading && results.length === 0 ? (
                <div style={{ padding: 16, color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>Buscando…</div>
              ) : (
                results.map((r, i) => (
                  <a
                    key={`${r.type}-${r.id}-${i}`}
                    href={viewHref(r)}
                    style={{
                      display: 'block',
                      padding: '12px 16px',
                      borderBottom: i < results.length - 1 ? `1px solid ${BORDER}` : 'none',
                      textDecoration: 'none',
                      color: TEXT_PRIMARY,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: ACCENT_SILVER,
                          minWidth: 72,
                        }}
                      >
                        {r.type}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          fontSize: 'var(--aguila-fs-body)',
                        }}
                      >
                        {r.title}
                      </span>
                    </div>
                    <div style={{ color: TEXT_SECONDARY, fontSize: 'var(--aguila-fs-body)', marginTop: 2, marginLeft: 82 }}>
                      {r.sub}
                    </div>
                  </a>
                ))
              )}
            </div>
          )}
        </div>

        <QAButton href="/embarques?nuevo=1" icon={<Plus size={16} />} label="Nueva entrada" primary />
        <QAButton href="/operador/cola" icon={<FileText size={16} />} label="Solicitar documentos" />
        <QAButton href="/operador/inicio?nota=1" icon={<StickyNote size={16} />} label="Nota rápida" />
      </div>
    </div>
  )
}

function viewHref(r: SearchResult): string {
  if (r.view === 'traficos') return `/embarques/${encodeURIComponent(r.id)}`
  if (r.view === 'entradas') return `/documentos?entrada=${encodeURIComponent(r.id)}`
  if (r.view === 'pedimentos') return `/pedimentos?ref=${encodeURIComponent(r.id)}`
  if (r.view === 'fracciones') return `/reportes?fraccion=${encodeURIComponent(r.id)}`
  if (r.view === 'proveedores') return `/reportes?proveedor=${encodeURIComponent(r.id)}`
  return '#'
}

function QAButton({ href, icon, label, primary }: { href: string; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 60,
        padding: '0 18px',
        borderRadius: 14,
        background: primary ? GOLD : BG_CARD,
        backdropFilter: primary ? undefined : `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: primary ? undefined : `blur(${GLASS_BLUR})`,
        border: `1px solid ${primary ? GOLD : BORDER}`,
        color: primary ? '#0D0D0C' : TEXT_PRIMARY,
        fontWeight: 700,
        fontSize: 'var(--aguila-fs-body)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </Link>
  )
}
