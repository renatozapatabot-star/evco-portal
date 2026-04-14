'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import Link from 'next/link'

interface SearchResult {
  type: 'trafico' | 'entrada' | 'pedimento'
  id: string
  title: string
  subtitle: string
  href: string
}

export function OperatorSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const doSearch = async () => {
    const q = query.trim()
    if (!q || q.length < 2) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()

      const mapped: SearchResult[] = []

      // Map traficos
      if (data.traficos) {
        for (const t of data.traficos.slice(0, 5)) {
          mapped.push({
            type: 'trafico',
            id: t.trafico || t.id,
            title: t.trafico || '',
            subtitle: `${t.estatus || ''} · ${t.descripcion_mercancia || ''} · ${t.company_id || ''}`.slice(0, 80),
            href: `/embarques/${encodeURIComponent(t.trafico || t.id)}`,
          })
        }
      }

      // Map entradas
      if (data.entradas) {
        for (const e of data.entradas.slice(0, 3)) {
          mapped.push({
            type: 'entrada',
            id: e.cve_entrada || e.id,
            title: e.cve_entrada || '',
            subtitle: `${e.descripcion_mercancia || ''} · ${e.cantidad_bultos || 0} bultos`.slice(0, 80),
            href: `/entradas/${encodeURIComponent(e.cve_entrada || e.id)}`,
          })
        }
      }

      // Map pedimento chain
      if (data.pedimento_chain) {
        const pc = data.pedimento_chain
        mapped.push({
          type: 'pedimento',
          id: pc.pedimento || '',
          title: `Pedimento: ${pc.pedimento || ''}`,
          subtitle: `${pc.trafico || ''} · ${pc.estatus || ''}`,
          href: `/embarques/${encodeURIComponent(pc.trafico || '')}`,
        })
      }

      setResults(mapped)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const typeColors: Record<string, string> = {
    trafico: '#E8EAED',
    entrada: '#0D9488',
    pedimento: '#8B949E',
  }

  const typeLabels: Record<string, string> = {
    trafico: 'Embarque',
    entrada: 'Entrada',
    pedimento: 'Pedimento',
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Search input */}
      <div style={{
        display: 'flex', gap: 8,
        background: 'rgba(255,255,255,0.045)', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '4px 4px 4px 14px',
        alignItems: 'center',
      }}>
        <Search size={14} style={{ color: '#6E7681', flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Buscar embarque, entrada, pedimento, proveedor..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#E6EDF3', fontSize: 13, padding: '10px 0',
            fontFamily: 'var(--font-jetbrains-mono)',
          }}
        />
        <button
          onClick={doSearch}
          disabled={loading || query.trim().length < 2}
          style={{
            background: 'rgba(192,197,206,0.15)', color: '#E8EAED',
            border: 'none', borderRadius: 8, padding: '8px 16px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            minHeight: 36, opacity: loading || query.trim().length < 2 ? 0.5 : 1,
          }}
        >
          {loading ? '...' : 'Buscar'}
        </button>
      </div>

      {/* Results */}
      {searched && results.length > 0 && (
        <div style={{
          marginTop: 8, background: 'rgba(255,255,255,0.045)', borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
        }}>
          {results.map((r, i) => (
            <Link key={`${r.type}-${r.id}`} href={r.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', textDecoration: 'none',
              borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.045)' : 'none',
              background: i === 0 ? 'rgba(192,197,206,0.04)' : 'transparent',
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                color: typeColors[r.type] || '#8B949E',
                letterSpacing: '0.05em', flexShrink: 0, width: 60,
              }}>
                {typeLabels[r.type]}
              </span>
              <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3', flexShrink: 0 }}>
                {r.id}
              </span>
              <span style={{
                fontSize: 12, color: '#8B949E', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {r.subtitle}
              </span>
            </Link>
          ))}
        </div>
      )}

      {searched && results.length === 0 && !loading && (
        <div style={{
          marginTop: 8, padding: '12px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)',
          fontSize: 13, color: '#6E7681', textAlign: 'center',
        }}>
          Sin resultados para &quot;{query}&quot;
        </div>
      )}
    </div>
  )
}
