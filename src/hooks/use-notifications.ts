'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCookieValue } from '@/lib/client-config'

interface NotificationCount {
  unread: number
  latest: string | null
}

/**
 * v2 Notification hook — subscribes to Supabase Realtime with rate limiting.
 * Buffers notifications for 5s before updating the badge.
 * Quiet hours (11 PM – 5 AM): accumulates silently.
 */
export function useNotificationBadge() {
  const [count, setCount] = useState(0)
  const bufferRef = useRef<number>(0)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const companyId = typeof document !== 'undefined' ? getCookieValue('company_id') : ''

  // Flush buffered notifications to state
  const flush = useCallback(() => {
    if (bufferRef.current > 0) {
      setCount(prev => prev + bufferRef.current)
      bufferRef.current = 0
    }
  }, [])

  // Check if in quiet hours
  const isQuietHours = () => {
    const h = new Date().getHours()
    return h >= 23 || h < 5
  }

  // Fetch initial count
  useEffect(() => {
    if (!companyId) return
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => {
        const notifs = d.notifications ?? []
        const unread = notifs.filter((n: { read: boolean }) => !n.read).length
        setCount(unread)
      })
      .catch((err) => console.error('[use-notifications] fetch failed:', err.message))
  }, [companyId])

  // Realtime subscription
  useEffect(() => {
    if (!companyId) return

    const supabase = createClient()
    const channel = supabase
      .channel('notifications-badge')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `company_id=eq.${companyId}`,
        },
        (payload: { new: { severity?: string; title?: string; description?: string } }) => {
          // Buffer the notification
          bufferRef.current += 1

          // Dispatch celebration event for toast bridge
          if (payload.new.severity === 'celebration' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cruz:celebration', {
              detail: { title: payload.new.title || '', description: payload.new.description || '' },
            }))
          }

          // Dispatch slide-in notification for real-time visibility
          if (typeof document !== 'undefined' && payload.new.title) {
            document.dispatchEvent(new CustomEvent('cruz:notification-slide', {
              detail: {
                title: payload.new.title,
                description: payload.new.description || '',
                severity: payload.new.severity || 'info',
              },
            }))
          }

          // If quiet hours, don't flush (accumulate)
          if (isQuietHours()) return

          // Rate limit: flush after 5s buffer
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              flush()
              flushTimerRef.current = undefined
            }, 5000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    }
  }, [companyId, flush])

  const markAllRead = useCallback(() => {
    setCount(0)
    bufferRef.current = 0
  }, [])

  return { unreadCount: count, markAllRead }
}
