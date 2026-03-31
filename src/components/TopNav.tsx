'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Bell, Search, ChevronDown } from 'lucide-react'
import { COMPANY_ID, getCookieValue } from '@/lib/client-config'
import { daysUntilMVE, mveIsCritical } from '@/lib/compliance-dates'
import { fmtDate } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { NightModeToggle } from '@/components/NightModeToggle'
import { NotificationPanel } from '@/components/NotificationPanel'
import {
  INTERNAL_TOP, INTERNAL_GROUPS, INTERNAL_BOTTOM,
  CLIENT_NAV, getActiveGroup,
  type UserRole, type NavGroup,
} from '@/components/nav/nav-config'

/* ── Design tokens (dark nav bar) ── */
const T = {
  navBg: '#1A1814',
  navBorder: '#2A2824',
  text: '#EAE6DC',
  textMuted: '#7C7870',
  gold: '#B8953F',
  goldSubtle: 'rgba(184,149,63,0.12)',
  goldBorder: 'rgba(184,149,63,0.25)',
  searchBg: '#F7F6F3',
  searchBorder: '#F0ECE4',
} as const

/* ═══════════════════════════════════════════
   DROPDOWN MENU (click-to-open)
   ═══════════════════════════════════════════ */
function NavDropdown({
  group, isActive, pathname, onNavigate,
}: {
  group: NavGroup
  isActive: boolean
  pathname: string
  onNavigate: (href: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  const Icon = group.icon

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className={`tn-tab ${isActive ? 'tn-tab-active' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Icon size={16} />
        {group.label}
        <ChevronDown
          size={12}
          style={{
            transition: 'transform 150ms',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            marginLeft: -2,
          }}
        />
      </button>

      {open && (
        <div className="tn-dropdown">
          {group.children.map(child => {
            const active = child.href === '/' ? pathname === '/' : pathname.startsWith(child.href)
            const ChildIcon = child.icon
            return (
              <button
                key={child.href}
                className={`tn-dropdown-item ${active ? 'tn-dropdown-item-active' : ''}`}
                onClick={() => { onNavigate(child.href); setOpen(false) }}
              >
                <ChildIcon size={16} strokeWidth={1.5} />
                {child.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   TOP NAV
   ═══════════════════════════════════════════ */
export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const mveDays = daysUntilMVE()

  const [role, setRole] = useState<UserRole>('client')
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [syncLabel, setSyncLabel] = useState('')
  const [syncMins, setSyncMins] = useState<number | null>(null)
  const [clientClave, setClientClave] = useState('')
  const [companyName, setCompanyName] = useState('')
  const avatarRef = useRef<HTMLDivElement>(null)

  // Read role + client info, set body attr for CSS layout
  useEffect(() => {
    const r = getCookieValue('user_role')
    if (r === 'admin' || r === 'broker') setRole(r as UserRole)
    else setRole('client')
    setClientClave(getCookieValue('company_clave') ?? '')
    const cn = getCookieValue('company_name')
    setCompanyName(cn ? decodeURIComponent(cn) : '')
    document.body.setAttribute('data-nav-role', (r === 'admin' || r === 'broker') ? 'internal' : 'client')
  }, [])

  // Close avatar dropdown on outside click
  useEffect(() => {
    if (!avatarOpen) return
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [avatarOpen])

  // Escape closes notifications
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && notifOpen) setNotifOpen(false)
  }, [notifOpen])
  useEffect(() => {
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleEscape])

  // Notification count
  useEffect(() => {
    fetch(`/api/data?table=notifications&company_id=${COMPANY_ID}&select=id&limit=1&read=false`)
      .then(r => r.json())
      .then(d => setUnreadCount(d.count ?? (d.data?.length ?? 0)))
      .catch(() => {})
  }, [])

  // Sync freshness
  useEffect(() => {
    fetch(`/api/data?table=traficos&company_id=${COMPANY_ID}&select=updated_at&limit=1&order_by=updated_at&order_dir=desc`)
      .then(r => r.json())
      .then(d => {
        const ts = d.data?.[0]?.updated_at
        if (ts) {
          const mins = Math.floor((Date.now() - new Date(ts as string).getTime()) / 60000)
          setSyncMins(mins)
          setSyncLabel(mins < 5 ? 'Ahora' : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`)
        }
      }).catch(() => {})
  }, [])

  const navigate = useCallback((href: string) => router.push(href), [router])

  const isInternal = role === 'admin' || role === 'broker'
  const activeGroup = getActiveGroup(pathname)

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  /* ─── Mobile top bar ─── */
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
                  background: '#DC2626', color: '#FFFFFF',
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

  /* ─── Desktop nav ─── */
  return (
    <>
      {/* Main nav bar — 56px, dark */}
      <nav className="tn-nav" aria-label="Navegacion principal">
        {/* Left: Logo */}
        <Link href="/" className="tn-logo">
          <div className="tn-zmark"><span>Z</span></div>
          <div className="tn-logo-text">
            <span className="tn-logo-title">CRUZ</span>
            <span className="tn-logo-sub">Renato Zapata &amp; Co</span>
          </div>
        </Link>

        {/* Center: Nav items */}
        <div className="tn-tabs">
          {isInternal ? (
            <>
              {/* Inicio */}
              {INTERNAL_TOP.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`tn-tab ${isActive(item.href) ? 'tn-tab-active' : ''}`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                )
              })}

              {/* Dropdown groups */}
              {INTERNAL_GROUPS.map(group => (
                <NavDropdown
                  key={group.key}
                  group={group}
                  isActive={activeGroup === group.key}
                  pathname={pathname}
                  onNavigate={navigate}
                />
              ))}

              {/* Bottom items (CRUZ gold + Config) */}
              {INTERNAL_BOTTOM.map(item => {
                if (item.roles && !item.roles.includes(role)) return null
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`tn-tab ${item.gold ? 'tn-tab-gold' : ''} ${isActive(item.href) ? 'tn-tab-active' : ''}`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                )
              })}
            </>
          ) : (
            /* Client nav — flat tabs */
            CLIENT_NAV.map(item => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`tn-tab ${isActive(item.href) ? 'tn-tab-active' : ''}`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              )
            })
          )}
        </div>

        {/* Right: MVE + date + night + search + bell + avatar */}
        <div className="tn-right">
          {isInternal && mveIsCritical() && (
            <button className="tn-mve" onClick={() => router.push('/mve')}>
              <span className="tn-mve-dot" />
              MVE {mveDays}d
            </button>
          )}

          <span className="tn-date">{fmtDate(new Date())}</span>

          <NightModeToggle />

          <button
            className="tn-bell-dark"
            onClick={() => setNotifOpen(true)}
            aria-label="Notificaciones"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="tn-badge-dark">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <div ref={avatarRef} style={{ position: 'relative' }}>
            <button
              className="tn-avatar-dark"
              onClick={() => setAvatarOpen(prev => !prev)}
              aria-expanded={avatarOpen}
              aria-haspopup="true"
            >
              {clientClave ? clientClave.slice(0, 2) : 'RZ'}
            </button>
            {avatarOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                background: '#1A1814', border: '1px solid rgba(184,149,63,0.2)',
                borderRadius: 8, padding: 6, minWidth: 180, zIndex: 999,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#EAE6DC' }}>
                    {companyName || (isInternal ? 'Renato Zapata & Co' : 'Cliente')}
                  </div>
                  <div style={{ fontSize: 11, color: '#7C7870', marginTop: 2 }}>
                    {role === 'broker' ? 'Operador' : role === 'admin' ? 'Admin' : clientClave}
                  </div>
                </div>
                <a
                  href="/api/auth/logout"
                  style={{
                    display: 'block', padding: '8px 12px', borderRadius: 4,
                    fontSize: 13, color: '#EAE6DC', textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Cerrar sesion
                </a>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Search subheader — admin/broker only */}
      {isInternal && (
        <div className="tn-subheader">
          <div
            className="tn-search-bar"
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          >
            <Search size={14} style={{ color: '#9C9890' }} />
            <span style={{ fontSize: 12, color: '#9C9890' }}>Buscar trafico, pedimento... &#8984;K</span>
          </div>
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
        </div>
      )}

      <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  )
}
