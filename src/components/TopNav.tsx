'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { LayoutDashboard, Truck, MessageSquare, BarChart3, FolderOpen, Bell, Search } from 'lucide-react'
import { CLIENT_CLAVE, COMPANY_ID } from '@/lib/client-config'
import { daysUntilMVE, mveIsCritical } from '@/lib/compliance-dates'
import { fmtDate } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { NotificationPanel } from '@/components/NotificationPanel'

interface NavItem {
  href: string
  icon: typeof LayoutDashboard
  label: string
  gold?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', icon: LayoutDashboard, label: 'Inicio' },
  { href: '/traficos', icon: Truck, label: 'Traficos' },
  { href: '/cruz', icon: MessageSquare, label: 'CRUZ', gold: true },
  { href: '/reportes', icon: BarChart3, label: 'Reportes' },
  { href: '/documentos', icon: FolderOpen, label: 'Documentos' },
]

// Tokens matching the reference design
const T = {
  navBg: '#1A1814',
  navBorder: '#2A2824',
  textOnDark: '#EAE6DC',
  textOnDarkMuted: '#7C7870',
  gold: '#B8953F',
  goldSubtle: 'rgba(184,149,63,0.12)',
  goldBorder: 'rgba(184,149,63,0.25)',
  searchBg: '#F7F6F3',
  searchBorder: '#F0ECE4',
} as const

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const mveDays = daysUntilMVE()
  const [mveTooltip, setMveTooltip] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [showNight, setShowNight] = useState(false)
  const [syncLabel, setSyncLabel] = useState('')

  // Night mode check
  useEffect(() => {
    const hour = parseInt(new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago', hour: 'numeric', hour12: false
    }))
    setShowNight(hour >= 20 || hour < 6)
    const saved = localStorage.getItem('cruz-theme-preference')
    if (saved === 'dark') {
      setIsDark(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  const toggleNight = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '')
    localStorage.setItem('cruz-theme-preference', next ? 'dark' : 'light')
  }

  const [syncMins, setSyncMins] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)

  // Escape key to close notification panel
  const handleEscapeNav = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && notifOpen) setNotifOpen(false)
  }, [notifOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeNav)
    return () => document.removeEventListener('keydown', handleEscapeNav)
  }, [handleEscapeNav])

  // Notification badge
  useEffect(() => {
    fetch(`/api/data?table=notifications&company_id=${COMPANY_ID}&select=id&limit=1&read=false`)
      .then(r => r.json())
      .then(d => {
        const count = d.count ?? (d.data?.length ?? 0)
        setUnreadCount(count)
      })
      .catch(() => {})
  }, [])

  // Sync status
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
      }).catch(() => { /* silent */ })
  }, [])

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)

  // Desktop nav
  const DesktopNav = () => (
    <>
      {/* Main nav bar - 56px */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 900,
        background: T.navBg, borderBottom: `1px solid ${T.navBorder}`,
        display: 'flex', alignItems: 'center', padding: '0 24px',
      }}>
        {/* Left: Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #B8953F, #D4B05C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 900, color: '#1A1710', fontFamily: 'Georgia, serif',
          }}>Z</div>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.textOnDark, letterSpacing: '0.04em' }}>CRUZ</span>
        </Link>

        {/* Center: Nav items */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4 }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href)
            if (item.gold) {
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px', borderRadius: 9999,
                  background: active ? T.goldSubtle : 'transparent',
                  border: `1px solid ${active ? T.goldBorder : 'transparent'}`,
                  color: T.gold, fontSize: 13, fontWeight: 700,
                  textDecoration: 'none', transition: 'all 150ms',
                }}>
                  <item.icon size={16} />
                  {item.label}
                </Link>
              )
            }
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', position: 'relative',
                color: active ? T.textOnDark : T.textOnDarkMuted,
                fontSize: 13, fontWeight: active ? 700 : 500,
                textDecoration: 'none', transition: 'color 150ms',
                borderBottom: active ? `2px solid ${T.gold}` : '2px solid transparent',
                marginBottom: -1,
              }}>
                <item.icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Right: MVE + timestamp + night + notifications + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {mveIsCritical() && (
            <div
              onMouseEnter={() => setMveTooltip(true)}
              onMouseLeave={() => setMveTooltip(false)}
              style={{ position: 'relative' }}
            >
              <div style={{
                padding: '4px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
                background: mveDays <= 1 ? 'rgba(194,59,34,0.15)' : 'rgba(192,122,24,0.15)',
                color: mveDays <= 1 ? '#E8634A' : '#D4A244',
                border: `1px solid ${mveDays <= 1 ? 'rgba(194,59,34,0.25)' : 'rgba(192,122,24,0.25)'}`,
                cursor: 'pointer',
              }} onClick={() => router.push('/mve')}>
                MVE {mveDays}d
              </div>
              {mveTooltip && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 8,
                  background: '#1A1814', border: '1px solid rgba(184,151,58,0.3)',
                  borderRadius: 8, padding: '10px 14px', whiteSpace: 'nowrap', zIndex: 999,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#EAE6DC' }}>
                    MVE Formato E2 vence {mveDays <= 1 ? 'manana' : `en ${mveDays} dias`}
                  </div>
                  <div style={{ fontSize: 11, color: '#7C7870', marginTop: 2 }}>
                    31 mar 2026 -- Operaciones pendientes
                  </div>
                </div>
              )}
            </div>
          )}
          <span style={{ fontSize: 11, color: T.textOnDarkMuted, fontFamily: 'var(--font-jetbrains-mono)' }}>
            {fmtDate(new Date())}
          </span>
          {showNight && (
            <button onClick={toggleNight} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 16, color: T.textOnDarkMuted, padding: '4px',
            }} title="Modo nocturno">
              {isDark ? '\u2600\uFE0F' : '\uD83C\uDF19'}
            </button>
          )}
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textOnDarkMuted, position: 'relative' }}
            onClick={() => setNotifOpen(true)} aria-label="Notificaciones">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -4,
                width: 16, height: 16, borderRadius: '50%',
                background: '#DC2626', color: '#FFFFFF',
                fontSize: 9, fontWeight: 800, lineHeight: '16px', textAlign: 'center',
                border: '2px solid #1A1814',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <div style={{
            width: 28, height: 28, borderRadius: 9999,
            background: 'rgba(184,149,63,0.15)', border: '1px solid rgba(184,149,63,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: T.gold,
          }}>
            {CLIENT_CLAVE.slice(0, 2)}
          </div>
        </div>
      </nav>

      {/* Search subheader - 40px */}
      <div style={{
        position: 'fixed', top: 56, left: 0, right: 0, height: 40, zIndex: 899,
        background: T.searchBg, borderBottom: `1px solid ${T.searchBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px',
      }}>
        <div style={{
          width: '100%', maxWidth: 480,
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#FFFFFF', border: '1px solid #E8E5E0', borderRadius: 8,
          padding: '0 12px', height: 28, cursor: 'pointer',
        }} onClick={() => {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
        }}>
          <Search size={14} style={{ color: '#9C9890' }} />
          <span style={{ fontSize: 12, color: '#9C9890' }}>Buscar trafico, pedimento... \u2318K</span>
        </div>
        {syncLabel && (
          <div style={{ position: 'absolute', right: 24, fontSize: 11, color: syncMins !== null && syncMins > 120 ? '#C47F17' : '#9C9890', fontFamily: 'var(--font-jetbrains-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
              background: syncMins !== null && syncMins <= 30 ? '#2D8540' : syncMins !== null && syncMins > 120 ? '#C47F17' : '#9C9890',
            }} />
            {syncMins !== null && syncMins <= 30
              ? `Datos de hoy, ${syncLabel}`
              : syncMins !== null && syncMins > 120
                ? `\u26A0 Actualizado hace ${syncLabel} \u2014 verificar datos`
                : `Sync: ${syncLabel}`
            }
          </div>
        )}
      </div>
    </>
  )

  // Mobile nav (top bar only - bottom nav is separate component)
  const MobileNav = () => (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 900,
      background: T.navBg, borderBottom: `1px solid ${T.navBorder}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'linear-gradient(135deg, #B8953F, #D4B05C)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 900, color: '#1A1710', fontFamily: 'Georgia, serif',
        }}>Z</div>
        <span style={{ fontSize: 14, fontWeight: 800, color: T.textOnDark }}>CRUZ</span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {mveIsCritical() && (
          <div style={{
            padding: '3px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700,
            background: 'rgba(192,122,24,0.15)', color: '#D4A244',
            border: '1px solid rgba(192,122,24,0.25)',
          }} onClick={() => router.push('/mve')}>
            MVE {mveDays}d
          </div>
        )}
        {showNight && (
          <button onClick={toggleNight} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: T.textOnDarkMuted, padding: 2,
          }}>
            {isDark ? '\u2600\uFE0F' : '\uD83C\uDF19'}
          </button>
        )}
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textOnDarkMuted }}
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))} aria-label="Buscar">
          <Search size={18} />
        </button>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textOnDarkMuted, position: 'relative' }}
          onClick={() => setNotifOpen(true)} aria-label="Notificaciones">
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
        <div style={{
          width: 24, height: 24, borderRadius: 9999,
          background: 'rgba(184,149,63,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: T.gold,
        }}>
          {CLIENT_CLAVE.slice(0, 2)}
        </div>
      </div>
    </nav>
  )

  return (
    <>
      {isMobile ? <MobileNav /> : <DesktopNav />}
      <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  )
}
