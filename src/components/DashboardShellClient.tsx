'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Sidebar from './sidebar'
import TopBar from './top-bar'
import { CommandPalette } from './command-palette'
import { ShortcutHelp } from './shortcut-help'
import { ToastProvider } from './Toast'
import { useKeyboardShortcuts } from '@/hooks/use-shortcuts'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileHeader } from './mobile-header'
import { MobileBottomNav } from './mobile-bottom-nav'
import { CruzFAB } from './cruz-fab'
import { IntelligenceTicker } from './IntelligenceTicker'
import { WelcomeOverlay } from './WelcomeOverlay'
import { daysUntilMVE } from '@/lib/compliance-dates'

interface Props { children: React.ReactNode }

function LoadingBar() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t) }, [pathname])
  if (!loading) return null
  return <div className="load-bar" />
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [visible, setVisible] = useState(true)
  useEffect(() => { setVisible(false); const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t) }, [pathname])
  return <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 200ms ease-out, transform 200ms ease-out' }}>{children}</div>
}

export default function DashboardShellClient({ children }: Props) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  const [idle, setIdle] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const warnTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useKeyboardShortcuts()

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => setScrolled(el.scrollTop > 8)
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    const mveDays = daysUntilMVE()
    setAlertCount(mveDays <= 30 ? 1 : 0)
  }, [])

  useEffect(() => {
    document.body.setAttribute('data-page', pathname)
    return () => { document.body.removeAttribute('data-page') }
  }, [pathname])

  // Offline detection
  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    setIsOffline(!navigator.onLine)
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline) }
  }, [])

  // Session idle detection
  useEffect(() => {
    const reset = () => {
      setIdle(false)
      setShowWarning(false)
      clearTimeout(warnTimer.current)
      clearTimeout(idleTimer.current)
      warnTimer.current = setTimeout(() => setShowWarning(true), 15 * 60 * 1000)
      idleTimer.current = setTimeout(() => setIdle(true), 20 * 60 * 1000)
    }
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const
    events.forEach(e => window.addEventListener(e, reset))
    reset()
    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      clearTimeout(warnTimer.current)
      clearTimeout(idleTimer.current)
    }
  }, [])

  if (pathname === '/login' || pathname.startsWith('/track') || pathname.startsWith('/upload') || pathname === '/war-room') return <>{children}</>

  return (
    <ToastProvider>
      <a href="#main-content" className="skip-link">Ir al contenido</a>
      {!isMobile && <IntelligenceTicker />}
      <div className="shell">
        <LoadingBar />
        {!isMobile && <Sidebar />}
        <div className="shell-main">
          {isMobile ? (
            <MobileHeader alertCount={alertCount} />
          ) : (
            <div className={`topbar ${scrolled ? 'topbar-scrolled' : ''}`}>
              <TopBar />
            </div>
          )}
          <main id="main-content" ref={scrollRef} className="page-wrap">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
        <CommandPalette />
        {!isMobile && <ShortcutHelp />}
        {isMobile && <MobileBottomNav />}
        {isMobile && <CruzFAB />}
      </div>

      {/* Offline banner */}
      {isOffline && (
        <div className="offline-banner">Sin conexión — mostrando datos en caché</div>
      )}

      {/* Welcome overlay for first-time users */}
      <WelcomeOverlay />

      {/* Session idle warning */}
      {showWarning && !idle && (
        <div className="idle-warning">
          <span>&#9201;</span> Sesión inactiva — se bloqueará en 5 minutos
        </div>
      )}

      {/* Session idle overlay */}
      {idle && (
        <div className="idle-overlay" onClick={() => { setIdle(false); setShowWarning(false) }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128274;</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Sesión bloqueada</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>Haz clic o toca para continuar</div>
        </div>
      )}
    </ToastProvider>
  )
}
