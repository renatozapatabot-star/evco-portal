'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { TopNav } from './TopNav'
import { Sidebar } from './Sidebar'
import { StatusStrip } from './StatusStrip'
import { CommandPalette } from './command-palette'
import { ShortcutHelp } from './shortcut-help'
import { ToastProvider } from './Toast'
import { useKeyboardShortcuts } from '@/hooks/use-shortcuts'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileBottomNav } from './mobile-bottom-nav'
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

/** Gold banner shown when broker is impersonating a client view. */
function ViewingAsBanner({ companyName, onExit }: { companyName: string; onExit: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#B8953F', color: '#FFFFFF', height: 36,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 12, fontSize: 13, fontWeight: 600,
    }}>
      <span>Viendo como: {companyName}</span>
      <button
        onClick={onExit}
        style={{
          background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: 4, color: '#FFFFFF', padding: '2px 10px',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Salir
      </button>
    </div>
  )
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

  // Read viewing_as cookie for broker impersonation banner
  const [viewingAs, setViewingAs] = useState<string | null>(null)
  const [viewingName, setViewingName] = useState<string>('')
  useEffect(() => {
    const vaMatch = document.cookie.match(/(^| )viewing_as=([^;]+)/)
    const nameMatch = document.cookie.match(/(^| )company_name=([^;]+)/)
    if (vaMatch) {
      setViewingAs(vaMatch[2])
      setViewingName(nameMatch ? decodeURIComponent(nameMatch[2]) : vaMatch[2])
    }
  }, [pathname])

  if (pathname === '/login' || pathname.startsWith('/track') || pathname.startsWith('/upload') || pathname === '/war-room') return <>{children}</>

  return (
    <ToastProvider>
      <a href="#main-content" className="skip-link">Ir al contenido</a>

      {/* Broker viewing-as banner */}
      {viewingAs && <ViewingAsBanner companyName={viewingName} onExit={() => {
        fetch('/api/auth/view-as', { method: 'DELETE' }).then(() => {
          setViewingAs(null)
          window.location.href = '/broker'
        })
      }} />}

      <div className="shell">
        <LoadingBar />
        {!isMobile && <Sidebar />}
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
