'use client'

import { useState } from 'react'
import { Search, Tag, Loader2 } from 'lucide-react'

interface Suggestion {
  fraccion: string
  description: string
  confidence: number
}

export default function FraccionesPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch('/api/clasificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest', description: query }),
      })
      if (res.ok) {
        const data = await res.json()
        setResults(data.suggestions || [])
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E6EDF3', marginBottom: 4 }}>
        Búsqueda de Fracciones
      </h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
        Describe un producto y AGUILA sugerirá la fracción arancelaria más probable.
      </p>

      {/* Search input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 16px', height: 52, borderRadius: 14,
          background: 'rgba(255,255,255,0.045)',
          border: '1px solid rgba(192,197,206,0.1)',
          backdropFilter: 'blur(20px)',
        }}>
          <Search size={18} style={{ color: '#64748b', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Ej: vacuum loader hose, plastic container, steel bolt..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#E6EDF3', fontSize: 14, fontFamily: 'inherit',
            }}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          style={{
            padding: '0 24px', height: 52, borderRadius: 14,
            background: '#E8EAED', color: '#05070B', fontWeight: 700, fontSize: 14,
            border: 'none', cursor: 'pointer',
            opacity: loading || !query.trim() ? 0.5 : 1,
            transition: 'opacity 150ms, box-shadow 150ms',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 0 16px rgba(192,197,206,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Buscar'}
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div>Clasificando con AGUILA AI...</div>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center', borderRadius: 20,
          background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(192,197,206,0.1)',
          backdropFilter: 'blur(20px)',
        }}>
          <Tag size={32} style={{ color: '#64748b', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 4 }}>Sin sugerencias</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Intenta con una descripción más detallada del producto.</div>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {results.map((r, i) => (
            <div key={i} style={{
              padding: 20, borderRadius: 20,
              background: 'rgba(255,255,255,0.045)',
              border: '1px solid rgba(192,197,206,0.1)',
              backdropFilter: 'blur(20px)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: '#E6EDF3' }}>
                  {r.fraccion}
                </span>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{r.description}</div>
              </div>
              <div style={{
                padding: '6px 14px', borderRadius: 10,
                background: 'rgba(192,197,206,0.08)',
                fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                color: '#C0C5CE',
              }}>
                {Math.round(r.confidence * 100)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hint when not yet searched */}
      {!searched && (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 13 }}>
          Escribe la descripción de un producto para obtener sugerencias de fracción arancelaria.
        </div>
      )}
    </div>
  )
}
