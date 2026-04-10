'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import CruzLayout from './cruz/CruzLayout'
import { CommandPalette } from './command-palette'
import { ShortcutHelp } from './shortcut-help'
import { ToastProvider, useToast } from './Toast'
import { useKeyboardShortcuts } from '@/hooks/use-shortcuts'
import { useIsMobile } from '@/hooks/use-mobile'
import { usePullToRefresh } from '@/hooks/use-pull-refresh'
// MobileBottomNav removed — navigation via topbar + floating CRUZ chat
import { WelcomeOverlay } from './WelcomeOverlay'
import { CruzChatBubble } from './cruz-chat-bubble'
import { SlideInNotification } from './notifications/SlideInNotification'
import { getCookieValue } from '@/lib/client-config'

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
  const [key, setKey] = useState(0)
  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => { setVisible(true); setKey(k => k + 1) }, 30)
    return () => clearTimeout(t)
  }, [pathname])
  return (
    <div
      key={key}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.999)',
        transition: 'opacity 160ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        willChange: visible ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}

/** Listens for celebration events dispatched by use-notifications Realtime and triggers toasts. */
function CelebrationListener() {
  const { toast } = useToast()
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ title: string }>).detail
      toast(detail.title, 'celebration')
    }
    window.addEventListener('cruz:celebration', handler)
    return () => window.removeEventListener('cruz:celebration', handler)
  }, [toast])
  return null
}

/** Gold banner shown when broker is impersonating a client view. */
function ViewingAsBanner({ companyName, onExit }: { companyName: string; onExit: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: 'var(--gold)', color: 'var(--bg-card)', height: 36,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 12, fontSize: 13, fontWeight: 600,
    }}>
      <span>Viendo como: {companyName}</span>
      <button
        onClick={onExit}
        style={{
          background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: 4, color: 'var(--bg-card)', padding: '2px 10px',
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
  const [showScrollTop, setShowScrollTop] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const warnTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Resolve portal identity from cookies
  const [portalType, setPortalType] = useState<'operator' | 'client'>('client')
  const [clientName, setClientName] = useState<string | undefined>(undefined)
  const [clientInitials, setClientInitials] = useState<string | undefined>(undefined)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const role = getCookieValue('user_role')
    if (role === 'broker' || role === 'admin') {
      setPortalType('operator')
    } else {
      setPortalType('client')
      const name = getCookieValue('company_name')
      if (name) {
        setClientName(name)
        const words = name.split(/\s+/).filter(Boolean)
        setClientInitials(words.length >= 2 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase())
      }
    }
  }, [])

  useKeyboardShortcuts()
  const { pulling, distance } = usePullToRefresh()

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

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

  // Scroll-to-top visibility
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
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

  if (pathname === '/login' || pathname.startsWith('/track') || pathname.startsWith('/upload') || pathname.startsWith('/proveedor') || pathname === '/war-room') return <>{children}</>

  return (
    <ToastProvider>
      <CelebrationListener />
      <SlideInNotification />
      <a href="#main-content" className="skip-link">Ir al contenido</a>

      {/* Broker viewing-as banner */}
      {viewingAs && <ViewingAsBanner companyName={viewingName} onExit={() => {
        fetch('/api/auth/view-as', { method: 'DELETE' }).then(() => {
          setViewingAs(null)
          window.location.href = '/'
        })
      }} />}

      {/* Pull-to-refresh indicator (mobile only) */}
      {isMobile && distance > 0 && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998,
          display: 'flex', justifyContent: 'center', paddingTop: Math.min(distance, 100),
          transition: pulling ? 'none' : 'padding-top 200ms ease',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--bg-card, #FFFFFF)',
            border: '1px solid var(--border, #E8E5E0)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `rotate(${pulling ? 180 : (distance / 80) * 180}deg)`,
            transition: pulling ? 'none' : 'transform 200ms ease',
            fontSize: 16,
          }}>
            ↓
          </div>
        </div>
      )}

      <CruzLayout
        portalType={portalType}
        clientName={clientName}
        clientInitials={clientInitials}
        onLogout={() => { window.location.href = '/api/auth/logout' }}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen(v => !v)}
        hideSidebar={portalType === 'client'}
      >
        <LoadingBar />
        <div id="main-content" ref={scrollRef}>
          <PageTransition>{children}</PageTransition>
        </div>
      </CruzLayout>

      <CommandPalette />
      {!isMobile && <ShortcutHelp />}

      {/* Bottom nav removed — navigation via topbar logo, search icon, and floating CRUZ chat */}

      {/* Offline banner */}
      {isOffline && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9998, background: 'var(--navy-900)', color: 'var(--bg-card)',
          padding: '10px 24px', borderRadius: 'var(--radius-lg)',
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>📡</span>
          Sin conexión — mostrando datos previos
        </div>
      )}

      {/* Floating ADUANA AI chat bubble — desktop only (mobile uses TopBar AI link) */}
      {!isMobile && <CruzChatBubble />}

      {/* Welcome overlay removed — the launchpad IS the welcome */}

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Volver arriba"
          style={{
            position: 'fixed', bottom: 24, right: 20, zIndex: 40,
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--navy-900)', color: 'var(--bg-card)',
            border: 'none', cursor: 'pointer', fontSize: 16,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity 200ms',
          }}
        >
          ↑
        </button>
      )}

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
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Sesión bloqueada</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>Haz clic o toca para continuar</div>
        </div>
      )}
    </ToastProvider>
  )
}
