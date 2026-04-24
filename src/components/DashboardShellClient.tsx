'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef, Suspense } from 'react'
import dynamic from 'next/dynamic'
import AguilaLayout from './aguila/AguilaLayout'
import { AguilaFooterShellFallback } from './aguila/AguilaFooter'
import { ToastProvider, useToast } from './Toast'
import { useKeyboardShortcuts } from '@/hooks/use-shortcuts'
import { useIsMobile } from '@/hooks/use-mobile'
import { usePullToRefresh } from '@/hooks/use-pull-refresh'
import { SlideInNotification } from './notifications/SlideInNotification'
import TelemetryProvider from './telemetry/TelemetryProvider'
import { getCookieValue } from '@/lib/client-config'

// Defer heavy components — not needed on first paint
const CommandPaletteProvider = dynamic(() => import('./CommandPaletteProvider').then(m => ({ default: m.CommandPaletteProvider })), { ssr: false })
const ShortcutHelp = dynamic(() => import('./shortcut-help').then(m => ({ default: m.ShortcutHelp })), { ssr: false })
const AguilaChatBubble = dynamic(() => import('./aguila-chat-bubble').then(m => ({ default: m.AguilaChatBubble })), { ssr: false })
const IntelligenceTicker = dynamic(() => import('./intelligence/IntelligenceTicker'), { ssr: false, loading: () => null })

interface Props { children: React.ReactNode }

function LoadingBar() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t) }, [pathname])
  if (!loading) return null
  return <div className="load-bar" />
}

/** PageTransition removed — added 30ms+ delay to every navigation with minimal visual benefit */

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
      gap: 12, fontSize: 'var(--aguila-fs-body)', fontWeight: 600,
    }}>
      <span>Viendo como: {companyName}</span>
      <button
        onClick={onExit}
        style={{
          background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: 4, color: 'var(--bg-card)', padding: '2px 10px',
          fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, cursor: 'pointer',
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
    if (role === 'broker' || role === 'admin' || role === 'warehouse' || role === 'contabilidad') {
      // Internal-team roles all use the operator-style shell (sidebar visible, internal chrome).
      // Cockpit landing pages (/bodega/inicio, /contabilidad/inicio) arrive in later commits.
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

  // Route change: close mobile sidebar, set data-page, read viewing_as cookie
  useEffect(() => {
    setMobileOpen(false)
    document.body.setAttribute('data-page', pathname)
    const vaMatch = document.cookie.match(/(^| )viewing_as=([^;]+)/)
    const nameMatch = document.cookie.match(/(^| )company_name=([^;]+)/)
    if (vaMatch) {
      setViewingAs(vaMatch[2])
      setViewingName(nameMatch ? decodeURIComponent(nameMatch[2]) : vaMatch[2])
    } else {
      setViewingAs(null)
    }
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

  // Broker impersonation state (read in pathname effect above)
  const [viewingAs, setViewingAs] = useState<string | null>(null)
  const [viewingName, setViewingName] = useState<string>('')

  if (pathname === '/login' || pathname.startsWith('/track') || pathname.startsWith('/upload') || pathname.startsWith('/proveedor') || pathname === '/war-room') return <>{children}</>

  // Pages that render their own PortalTopBar (via PortalDashboard) must
  // not also render the shell-level TopBar + IntelligenceTicker — otherwise
  // the user sees two stacked top bars. Keep this list in sync with the
  // routes that mount <PortalDashboard>.
  const hasPortalTopBar =
    pathname === '/inicio' ||
    pathname === '/operador/inicio' ||
    pathname === '/admin/eagle'

  return (
    <ToastProvider>
      <TelemetryProvider>
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
            fontSize: 'var(--aguila-fs-body-lg)',
          }}>
            ↓
          </div>
        </div>
      )}

      <AguilaLayout
        portalType={portalType}
        clientName={clientName}
        clientInitials={clientInitials}
        onLogout={() => { window.location.href = '/api/auth/logout' }}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen(v => !v)}
        hideSidebar={true}
        hideTopBar={hasPortalTopBar}
      >
        <LoadingBar />
        {/* IntelligenceTicker is operator-only (V1 Clean Visibility · 2026-04-24).
            Client surface stays quiet; the ticker is internal ops signal. */}
        {!hasPortalTopBar && portalType === 'operator' && (
          <Suspense fallback={null}>
            <IntelligenceTicker />
          </Suspense>
        )}
        <div id="main-content" ref={scrollRef}>
          {children}
          {/* Shell-level identity footer — renders on every authenticated
              page. PageShell also renders an AguilaFooter for pages that
              compose through it (e.g. /inicio). Dedupe guard in the
              AguilaFooter component itself: if another [data-identity-footer]
              is already on the page, this one returns null. */}
          <AguilaFooterShellFallback />
        </div>
      </AguilaLayout>

      <CommandPaletteProvider />
      {!isMobile && <ShortcutHelp />}

      {/* Bottom nav removed — navigation via topbar logo + universal search */}

      {/* Offline banner */}
      {isOffline && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9998, background: 'var(--navy-900)', color: 'var(--bg-card)',
          padding: '10px 24px', borderRadius: 'var(--radius-lg)',
          fontSize: 'var(--aguila-fs-body)', fontWeight: 600, boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 'var(--aguila-fs-body-lg)' }}>📡</span>
          Sin conexión — mostrando datos previos
        </div>
      )}

      {/* Asistente chat bubble is operator-only on the V1 Clean
          Visibility surface (2026-04-24). Client surface does not render
          any AI-forward affordance until L1 supervisor promotion
          re-enables it behind an explicit per-feature flag. Operator role
          keeps the bubble for internal workflow continuity. */}
      {portalType === 'operator' && <AguilaChatBubble />}

      {/* Welcome overlay removed — the launchpad IS the welcome */}

      {/* Scroll to top — sits above the persistent AsistenteButton (60px tall + 20px bottom inset). */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Volver arriba"
          style={{
            position: 'fixed', bottom: 96, right: 20, zIndex: 40,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            color: 'var(--portal-fg-1)',
            border: '1px solid rgba(192,197,206,0.18)',
            cursor: 'pointer',
            fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
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
          <div style={{ fontSize: 'var(--aguila-fs-kpi-hero)', marginBottom: 16 }}>&#128274;</div>
          <div style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 800, marginBottom: 8 }}>Sesión bloqueada</div>
          <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)', marginBottom: 20 }}>Haz clic o toca para continuar</div>
        </div>
      )}
      </TelemetryProvider>
    </ToastProvider>
  )
}
