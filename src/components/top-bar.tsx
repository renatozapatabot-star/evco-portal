'use client'
import { Bell } from 'lucide-react'
import { CLIENT_NAME, CLIENT_CLAVE } from '@/lib/client-config'
import { SearchBar } from '@/components/layout/search-bar'
import { NotificationsDropdown } from '@/components/NotificationsDropdown'

export default function TopBar() {
  const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <header style={{ height: 56, minHeight: 56, background: 'var(--bg-card)', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0, zIndex: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{CLIENT_NAME}</span>
        <span style={{ color: 'var(--text-muted)' }}>&middot;</span>
        <span className="mono" style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{CLIENT_CLAVE}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><SearchBar /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <NotificationsDropdown />
        <span className="mono" style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{today}</span>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--amber-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: 'var(--amber-800)', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>RZ</div>
      </div>
    </header>
  )
}
