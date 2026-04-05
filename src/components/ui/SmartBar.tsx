'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useIsMobile } from '@/hooks/use-mobile'

interface SmartAction {
  icon: string
  label: string
  href?: string
  onClick?: () => void
}

function getActions(pathname: string): SmartAction[] | null {
  // Hide on CRUZ AI and login — those pages have their own UI
  if (pathname === '/cruz' || pathname === '/login' || pathname === '/bienvenida') return null

  // Tráfico detail
  if (pathname.startsWith('/traficos/') && pathname !== '/traficos') {
    const traficoId = decodeURIComponent(pathname.split('/')[2] || '')
    return [
      { icon: '📎', label: 'Subir doc', href: `/documentos/subir?trafico=${encodeURIComponent(traficoId)}` },
      { icon: '📤', label: 'Compartir', onClick: () => {
        const url = `${window.location.origin}/share/${encodeURIComponent(traficoId)}`
        navigator.clipboard.writeText(url).catch(() => {})
      }},
      { icon: '💬', label: 'Preguntar', href: `/cruz?trafico=${encodeURIComponent(traficoId)}` },
    ]
  }

  // Tráficos list
  if (pathname === '/traficos') {
    return [
      { icon: '🔍', label: 'Buscar', onClick: () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
      }},
      { icon: '📊', label: 'Exportar', href: '/exportar' },
      { icon: '💬', label: 'CRUZ AI', href: '/cruz' },
    ]
  }

  // Documentos / expedientes
  if (pathname === '/documentos' || pathname === '/expedientes') {
    return [
      { icon: '📎', label: 'Subir', href: '/documentos/subir' },
      { icon: '📋', label: 'Expedientes', href: '/expedientes' },
      { icon: '💬', label: 'CRUZ AI', href: '/cruz' },
    ]
  }

  // Default (dashboard, logros, actividad, reportes, etc.)
  return [
    { icon: '📊', label: 'Reportes', href: '/reportes' },
    { icon: '📎', label: 'Subir doc', href: '/documentos/subir' },
    { icon: '💬', label: 'CRUZ AI', href: '/cruz' },
  ]
}

export function SmartBar() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [opacity, setOpacity] = useState(1)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fade on scroll, return after 1s idle
  const handleScroll = useCallback(() => {
    setOpacity(0.3)
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => setOpacity(1), 1000)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
    }
  }, [handleScroll])

  const actions = getActions(pathname)
  if (!actions) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? 76 : 24,
      ...(isMobile
        ? { left: '50%', transform: 'translateX(-50%)' }
        : { right: 24 }),
      zIndex: 49,
      display: 'flex',
      gap: 8,
      opacity,
      transition: 'opacity 300ms ease',
      pointerEvents: opacity < 0.5 ? 'none' : 'auto',
    }}>
      {actions.map((action, i) => {
        const content = (
          <>
            <span style={{ fontSize: 14 }}>{action.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{action.label}</span>
          </>
        )

        const pillStyle: React.CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 40,
          padding: '0 14px',
          borderRadius: 20,
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid #E8E5E0',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          cursor: 'pointer',
          textDecoration: 'none',
          transition: 'border-color 150ms, box-shadow 150ms',
          whiteSpace: 'nowrap',
        }

        if (action.href) {
          return (
            <Link
              key={i}
              href={action.href}
              style={pillStyle}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#C4963C'
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(196,150,60,0.15)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E8E5E0'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
              }}
            >
              {content}
            </Link>
          )
        }

        return (
          <button
            key={i}
            onClick={action.onClick}
            style={{ ...pillStyle, fontFamily: 'inherit' }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#C4963C'
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(196,150,60,0.15)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E8E5E0'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
            }}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
