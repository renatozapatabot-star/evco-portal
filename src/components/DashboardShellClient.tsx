'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { TopNav } from './TopNav'
import { StatusStrip } from './StatusStrip'
import { CommandPalette } from './command-palette'
import { ShortcutHelp } from './shortcut-help'
import { ToastProvider } from './Toast'
import { useKeyboardShortcuts } from '@/hooks/use-shortcuts'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileBottomNav } from './mobile-bottom-nav'
// CruzFAB removed — CRUZ is accessible from bottom nav
import { WelcomeOverlay } from './WelcomeOverlay'

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
  const [idle, setIdle] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const warnTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useKeyboardShortcuts()

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
      <div className="shell">
        <LoadingBar />
        <TopNav />
        <StatusStrip />
        <div className="shell-main">
          <main id="main-content" ref={scrollRef} className="page-wrap">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
        <CommandPalette />
        {!isMobile && <ShortcutHelp />}
        {isMobile && <MobileBottomNav />}
        {/* CruzFAB removed — CRUZ is in bottom nav */}
      </div>

      {/* Offline banner */}
      {isOffline && (
        <div className="offline-banner">Sin conexion -- mostrando datos en cache</div>
      )}

      {/* Welcome overlay for first-time users */}
      <WelcomeOverlay />

      {/* Session idle warning */}
      {showWarning && !idle && (
        <div className="idle-warning">
          <span>&#9201;</span> Sesion inactiva -- se bloqueara en 5 minutos
        </div>
      )}

      {/* Session idle overlay */}
      {idle && (
        <div className="idle-overlay" onClick={() => { setIdle(false); setShowWarning(false) }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128274;</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Sesion bloqueada</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>Haz clic o toca para continuar</div>
        </div>
      )}
    </ToastProvider>
  )
}
