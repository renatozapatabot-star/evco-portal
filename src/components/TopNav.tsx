'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { Bell, Search, Plus } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { daysUntilMVE, mveIsCritical } from '@/lib/compliance-dates'
import { fmtDate } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { NightModeToggle } from '@/components/NightModeToggle'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { NotificationPanel } from '@/components/NotificationPanel'
import { LauncherTray } from '@/components/launcher/LauncherTray'
import type { LauncherCounts, LauncherRole } from '@/lib/launcher-tools'
import type { UserRole } from '@/components/nav/nav-config'
import Link from 'next/link'

const T = {
  navBg: '#1A1814',
  navBorder: '#2A2824',
  text: '#EAE6DC',
  textMuted: '#7C7870',
  gold: 'var(--gold)',
} as const

export function TopNav() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const mveDays = daysUntilMVE()

  const [role, setRole] = useState<UserRole>('client')
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [launcherCounts] = useState<LauncherCounts>({})
  const [companyId, setCompanyId] = useState('')
  const [syncLabel, setSyncLabel] = useState('')
  const [syncMins, setSyncMins] = useState<number | null>(null)

  useEffect(() => {
    const r = getCookieValue('user_role')
    if (r === 'admin' || r === 'broker') setRole(r as UserRole)
    else setRole('client')
    setCompanyId(getCookieValue('company_id') ?? '')
    document.body.setAttribute('data-nav-role', (r === 'admin' || r === 'broker') ? 'internal' : 'client')
  }, [])

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && notifOpen) setNotifOpen(false)
    // Cmd+J / Ctrl+J toggles the launcher tray
    if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
      e.preventDefault()
      setLauncherOpen((v) => !v)
    }
  }, [notifOpen])
  useEffect(() => {
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleEscape])

  useEffect(() => {
    if (!companyId) return
    fetch(`/api/data?table=notifications&company_id=${companyId}&select=id&limit=1&read=false`)
      .then(r => r.json())
      .then(d => setUnreadCount(d.count ?? (d.data?.length ?? 0)))
      .catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
    fetch(`/api/data?table=traficos&company_id=${companyId}&select=updated_at&limit=1&order_by=updated_at&order_dir=desc`)
      .then(r => r.json())
      .then(d => {
        const ts = d.data?.[0]?.updated_at
        if (ts) {
          const mins = Math.floor((Date.now() - new Date(ts as string).getTime()) / 60000)
          setSyncMins(mins)
          setSyncLabel(mins < 5 ? 'Ahora' : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`)
        }
      }).catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
  }, [companyId])

  const isInternal = role === 'admin' || role === 'broker'

  /* ─── Mobile top bar (unchanged) ─── */
  if (isMobile) {
    return (
      <>
        <nav
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 900,
            background: T.navBg, borderBottom: `1px solid ${T.navBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
          }}
        >
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <AguilaMark size={28} />
            <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>ZAPATA AI</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isInternal && mveIsCritical() && (
              <div
                style={{
                  padding: '3px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700,
                  background: 'rgba(192,122,24,0.15)', color: '#D4A244',
                  border: '1px solid rgba(192,122,24,0.25)', cursor: 'pointer',
                }}
                onClick={() => router.push('/mve')}
              >
                MVE {mveDays}d
              </div>
            )}
            <NightModeToggle />
            <button
              style={{
                background: 'transparent',
                border: '1px solid rgba(192,197,206,0.25)',
                borderRadius: 8, padding: '4px 8px',
                cursor: 'pointer', color: '#F4D47A',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 12, fontWeight: 700,
                position: 'relative',
              }}
              onClick={() => setLauncherOpen(true)}
              aria-label="Herramientas"
              title="Herramientas (⌘J)"
            >
              <Plus size={14} />
              <span>Tools</span>
              {Object.values(launcherCounts).some(v => typeof v === 'number' && v > 0) && (
                <span aria-hidden style={{
                  position: 'absolute', top: -3, right: -3,
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--danger-500, #EF4444)',
                  boxShadow: '0 0 6px rgba(239,68,68,0.6)',
                }} />
              )}
            </button>
            <button
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textMuted }}
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              aria-label="Buscar"
            >
              <Search size={18} />
            </button>
            <button
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textMuted, position: 'relative' }}
              onClick={() => setNotifOpen(true)}
              aria-label="Notificaciones"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -4,
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'var(--danger-500)', color: 'var(--bg-card)',
                  fontSize: 8, fontWeight: 800, lineHeight: '14px', textAlign: 'center',
                  border: '2px solid #1A1814',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </nav>
        <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
        <LauncherTray
          open={launcherOpen}
          onClose={() => setLauncherOpen(false)}
          role={(role as LauncherRole) || 'client'}
          counts={launcherCounts}
        />
      </>
    )
  }

  /* ─── Desktop: slim 44px top bar (right-side icons only) ─── */
  return (
    <>
      <nav className="tn-bar" aria-label="Barra de herramientas" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Search trigger */}
        <div
          className="tn-search-trigger"
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
        >
          <Search size={14} style={{ color: '#9C9890', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#9C9890' }}>Buscar embarque, pedimento... &#8984;K</span>
        </div>

        {/* Right icons */}
        <div className="tn-right" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {syncLabel && (
            <div className="tn-sync-indicator">
              <span
                className="tn-sync-dot-v2"
                style={{
                  background: syncMins !== null && syncMins <= 30 ? '#2D8540' : syncMins !== null && syncMins > 120 ? '#C47F17' : '#9C9890',
                }}
              />
              <span style={{ color: syncMins !== null && syncMins > 120 ? '#C47F17' : '#9C9890' }}>
                {syncMins !== null && syncMins <= 30
                  ? `Datos de hoy, ${syncLabel}`
                  : `Última sincronización: ${syncLabel}`
                }
              </span>
            </div>
          )}

          {isInternal && mveIsCritical() && (
            <button className="tn-mve" onClick={() => router.push('/mve')}>
              <span className="tn-mve-dot" />
              MVE {mveDays}d
            </button>
          )}

          <span className="tn-date">{fmtDate(new Date())}</span>

          <NightModeToggle />

          {/*
            Herramientas launcher tray. + icon, gold accent so it reads as a
            primary affordance distinct from the silver utility icons. Cmd+J
            opens it from anywhere; tooltip surfaces the shortcut.
          */}
          <button
            type="button"
            onClick={() => setLauncherOpen(true)}
            aria-label="Herramientas (⌘J)"
            title="Herramientas (⌘J)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 8,
              background: 'transparent',
              border: '1px solid rgba(192,197,206,0.22)',
              color: '#F4D47A',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              lineHeight: 1.2,
              position: 'relative',
            }}
          >
            <Plus size={13} />
            <span>TOOLS</span>
            {Object.values(launcherCounts).some(v => typeof v === 'number' && v > 0) && (
              <span aria-hidden style={{
                position: 'absolute', top: -3, right: -3,
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--danger-500, #EF4444)',
                boxShadow: '0 0 6px rgba(239,68,68,0.6)',
              }} />
            )}
          </button>

          <button
            className="tn-bell-bar"
            onClick={() => setNotifOpen(true)}
            aria-label="Notificaciones"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="tn-badge-bar">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
      <LauncherTray
        open={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        role={(role as LauncherRole) || 'client'}
        counts={launcherCounts}
      />
    </>
  )
}
