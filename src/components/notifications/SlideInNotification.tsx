'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { X } from 'lucide-react'
import { haptic } from '@/hooks/use-haptic'

interface NotificationItem {
  id: string
  title: string
  description: string
  severity: 'info' | 'success' | 'warning' | 'error' | 'celebration'
  href?: string
  timestamp: number
}

const SEVERITY_BORDER: Record<string, string> = {
  info: 'var(--info-500, #3B82F6)',
  success: 'var(--success, #16A34A)',
  warning: 'var(--warning-500, #D97706)',
  error: 'var(--danger-500, #DC2626)',
  celebration: 'var(--gold, #C9A84C)',
}

const AUTO_DISMISS_MS = 5000
const MAX_VISIBLE = 3

/**
 * Slide-in notification system.
 * Listens for 'cruz:notification-slide' CustomEvent and displays
 * notifications that slide in from the right edge with haptic feedback.
 */
export function SlideInNotification() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  useEffect(() => {
    function handleNotification(e: Event) {
      const detail = (e as CustomEvent).detail as {
        title: string
        description: string
        severity?: string
        href?: string
      }

      if (!detail?.title) return

      const item: NotificationItem = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: detail.title,
        description: detail.description,
        severity: (detail.severity as NotificationItem['severity']) || 'info',
        href: detail.href,
        timestamp: Date.now(),
      }

      haptic.notify()

      setNotifications(prev => {
        const next = [item, ...prev]
        // Keep only max visible
        return next.slice(0, MAX_VISIBLE)
      })

      // Auto-dismiss
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== item.id))
      }, AUTO_DISMISS_MS)
    }

    document.addEventListener('cruz:notification-slide', handleNotification)
    return () => document.removeEventListener('cruz:notification-slide', handleNotification)
  }, [])

  if (notifications.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 72,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 340,
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="popLayout">
        {notifications.map(notif => {
          const borderColor = SEVERITY_BORDER[notif.severity] || SEVERITY_BORDER.info
          const content = (
            <motion.div
              key={notif.id}
              layout
              initial={{ x: '110%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '110%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                pointerEvents: 'auto',
                background: 'var(--glass-bg, rgba(255,255,255,0.92))',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid var(--glass-border, rgba(255,255,255,0.3))',
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: 12,
                padding: '12px 16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                cursor: notif.href ? 'pointer' : 'default',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-primary, #1A1A1A)',
                    lineHeight: 1.3,
                  }}>
                    {notif.title}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-secondary, #6B6B6B)',
                    marginTop: 2,
                    lineHeight: 1.4,
                  }}>
                    {notif.description}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    dismiss(notif.id)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    color: 'var(--text-muted, #9B9B9B)',
                    flexShrink: 0,
                  }}
                  aria-label="Cerrar notificación"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )

          if (notif.href) {
            return (
              <Link key={notif.id} href={notif.href} style={{ textDecoration: 'none' }} onClick={() => dismiss(notif.id)}>
                {content}
              </Link>
            )
          }

          return content
        })}
      </AnimatePresence>
    </div>
  )
}
