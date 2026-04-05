'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { Bell, Search } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { daysUntilMVE, mveIsCritical } from '@/lib/compliance-dates'
import { fmtDate } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { NightModeToggle } from '@/components/NightModeToggle'
import { NotificationPanel } from '@/components/NotificationPanel'
import type { UserRole } from '@/components/nav/nav-config'
import Link from 'next/link'

const T = {
  navBg: '#1A1814',
  navBorder: '#2A2824',
  text: '#EAE6DC',
  textMuted: '#7C7870',
  gold: '#C4963C',
} as const

export function TopNav() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const mveDays = daysUntilMVE()

  const [role, setRole] = useState<UserRole>('client')
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
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
            <div style={{
              width: 28, height: 28, borderRadius: 6, background: '#CC1B2F',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ color: '#FFF', fontWeight: 900, fontSize: 15, fontFamily: 'var(--font-geist-sans)', letterSpacing: '-0.02em', lineHeight: 1 }}>Z</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>CRUZ</span>
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
                  background: 'var(--danger-500)', color: '#FFFFFF',
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
      </>
    )
  }

  /* ─── Desktop: slim 44px top bar (right-side icons only) ─── */
  return (
    <>
      <nav className="tn-bar" aria-label="Barra de herramientas">
        {/* Search trigger */}
        <div
          className="tn-search-trigger"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
        >
          <Search size={14} style={{ color: '#9C9890' }} />
          <span style={{ fontSize: 12, color: '#9C9890' }}>Buscar tráfico, pedimento... &#8984;K</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Right icons */}
        <div className="tn-right">
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
                  : syncMins !== null && syncMins > 120
                    ? `Actualizado hace ${syncLabel}`
                    : `Sync: ${syncLabel}`
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
    </>
  )
}
