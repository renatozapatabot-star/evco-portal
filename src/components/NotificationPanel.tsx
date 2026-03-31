'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Bell, CheckCircle, AlertTriangle } from 'lucide-react'
import { fmtDateTime } from '@/lib/format-utils'
import Link from 'next/link'

interface Notification {
  id: string
  type: string
  severity: string
  title: string
  description: string | null
  trafico_id: string | null
  action_url: string | null
  read: boolean
  created_at: string
}

const SEVERITY_ICON: Record<string, typeof Bell> = {
  success: CheckCircle,
  warning: AlertTriangle,
  critical: AlertTriangle,
  info: Bell,
}

const SEVERITY_COLOR: Record<string, string> = {
  success: '#2D8540',
  warning: '#C47F17',
  critical: '#C23B22',
  info: '#9C9890',
}

export function NotificationPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen])

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    },
    [isOpen, onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleEscape])

  const markRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const unread = notifications.filter((n) => !n.read)

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 998,
          }}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: isOpen ? 0 : -400,
          bottom: 0,
          width: 400,
          maxWidth: '90vw',
          background: 'var(--surface-card, #FFFFFF)',
          borderLeft: '1px solid var(--border-default, #E8E5E0)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
          zIndex: 999,
          transition: 'right 300ms ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E8E5E0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            Notificaciones{unread.length > 0 ? ` (${unread.length})` : ''}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9C9890',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 72, margin: '8px 16px', borderRadius: 8 }}
              />
            ))
          ) : notifications.length === 0 ? (
            <div
              style={{ padding: 40, textAlign: 'center', color: '#9C9890' }}
            >
              <Bell
                size={24}
                style={{ margin: '0 auto 8px', display: 'block' }}
              />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Sin alertas</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Monitoreando en tiempo real
              </div>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = SEVERITY_ICON[n.severity] || Bell
              const color = SEVERITY_COLOR[n.severity] || '#9C9890'
              return (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  style={{
                    padding: '12px 20px',
                    borderBottom: '1px solid #F0ECE4',
                    cursor: 'pointer',
                    background: n.read
                      ? 'transparent'
                      : 'rgba(184,149,63,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Icon
                      size={16}
                      style={{ color, flexShrink: 0, marginTop: 2 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: n.read ? 500 : 700,
                          color: '#1A1A18',
                        }}
                      >
                        {n.title}
                      </div>
                      {n.description && (
                        <div
                          style={{
                            fontSize: 12,
                            color: '#6B6B6B',
                            marginTop: 2,
                          }}
                        >
                          {n.description}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 11,
                          color: '#9C9890',
                          marginTop: 4,
                          fontFamily: 'var(--font-jetbrains-mono)',
                        }}
                      >
                        {fmtDateTime(n.created_at)}
                      </div>
                    </div>
                  </div>
                  {n.action_url && (
                    <Link
                      href={n.action_url}
                      onClick={onClose}
                      style={{
                        fontSize: 12,
                        color: '#B8953F',
                        fontWeight: 600,
                        textDecoration: 'none',
                        marginTop: 6,
                        display: 'inline-block',
                      }}
                    >
                      Ver detalle →
                    </Link>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
