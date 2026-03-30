'use client'
import { useState } from 'react'
import { Search, Bell, X } from 'lucide-react'
import { daysUntilMVE, mveIsCritical } from '@/lib/compliance-dates'
import { useRouter } from 'next/navigation'

export function MobileHeader({ alertCount = 0 }: { alertCount?: number }) {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const mveDays = daysUntilMVE()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) { router.push(`/traficos`); setSearching(false); setQuery('') }
  }

  if (searching) {
    return (
      <header className="m-header">
        <form className="m-header-search-expanded" onSubmit={handleSearch}>
          <Search size={16} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
          <input className="m-header-search-input" placeholder="Buscar tráfico, pedimento..." value={query} onChange={e => setQuery(e.target.value)} autoFocus />
          <button type="button" className="m-header-search-close" onClick={() => { setSearching(false); setQuery('') }}><X size={18} /></button>
        </form>
      </header>
    )
  }

  return (
    <header className="m-header">
      <div className="m-header-brand">
        <div className="m-zmark"><span>Z</span></div>
        <div className="m-header-titles">
          <span className="m-header-cruz">CRUZ</span>
          <span className="m-header-client">EVCO Plastics · 9254</span>
        </div>
      </div>
      <div className="m-header-actions">
        {mveIsCritical() && (
          <div className="m-mve-chip" onClick={() => router.push('/mve')}>
            <span className="m-mve-dot" />MVE {mveDays}d
          </div>
        )}
        <button className="m-header-btn" onClick={() => setSearching(true)} aria-label="Buscar">
          <Search size={20} />
        </button>
        <button className="m-header-btn" onClick={() => router.push('/mve')} aria-label="Alertas" style={{ position: 'relative' }}>
          <Bell size={20} />
          {alertCount > 0 && <span className="m-notif-dot" />}
        </button>
      </div>
    </header>
  )
}
