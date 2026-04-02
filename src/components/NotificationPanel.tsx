'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Bell, CheckCircle, AlertTriangle, FileX, Clock, Package, Search, FileCheck } from 'lucide-react'
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

const GROUP_CONFIG: Record<string, { label: (n: number) => string; icon: typeof Bell }> = {
  doc_pull_failed: { label: (n) => `${n} documento${n !== 1 ? 's' : ''} sin obtener`, icon: FileX },
  solicitud_vencida: { label: (n) => `${n} solicitud${n !== 1 ? 'es' : ''} vencida${n !== 1 ? 's' : ''}`, icon: Clock },
  entrada_received: { label: (n) => `${n} entrada${n !== 1 ? 's' : ''} en bodega`, icon: Package },
  anomaly_detected: { label: (n) => `${n} anomalía${n !== 1 ? 's' : ''} detectada${n !== 1 ? 's' : ''}`, icon: Search },
  doc_recibido: { label: (n) => `${n} documento${n !== 1 ? 's' : ''} recibido${n !== 1 ? 's' : ''}`, icon: FileCheck },
}

function groupNotifications(notifications: Notification[]) {
  const groups: Record<string, Notification[]> = {}
  const ungrouped: Notification[] = []

  for (const n of notifications) {
    if (GROUP_CONFIG[n.type]) {
      if (!groups[n.type]) groups[n.type] = []
      groups[n.type].push(n)
    } else {
      ungrouped.push(n)
    }
  }

  return { groups, ungrouped }
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
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications ?? []))
      .catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
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

  const markGroupRead = async (type: string) => {
    const groupNotifs = notifications.filter((n) => n.type === type && !n.read)
    await Promise.all(
      groupNotifs.map((n) =>
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: n.id }),
        })
      )
    )
    setNotifications((prev) =>
      prev.map((n) => (n.type === type ? { ...n, read: true } : n))
    )
  }

  const { groups, ungrouped } = groupNotifications(notifications)
  const unreadGroups = Object.entries(groups).filter(([, items]) => items.some((n) => !n.read))
  const totalUnreadGroups = unreadGroups.length + ungrouped.filter((n) => !n.read).length

  const badgeText = totalUnreadGroups === 0 ? null : totalUnreadGroups >= 10 ? '9+' : `${totalUnreadGroups}`

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
          background: 'var(--card-bg)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Notificaciones</span>
            {badgeText && (
              <span style={{
                fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)',
                background: '#C23B22', color: '#FFFFFF',
                borderRadius: 9999, padding: '1px 6px', lineHeight: '16px', minWidth: 20, textAlign: 'center',
              }}>{badgeText}</span>
            )}
          </div>
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
            <>
              {/* Grouped notifications */}
              {Object.entries(groups).map(([type, items]) => {
                const config = GROUP_CONFIG[type]
                const GroupIcon = config?.icon || Bell
                const unreadInGroup = items.filter((n) => !n.read).length
                const isExpanded = expandedGroup === type

                return (
                  <div key={type}>
                    <div
                      onClick={() => setExpandedGroup(isExpanded ? null : type)}
                      style={{
                        padding: '12px 20px',
                        borderBottom: '1px solid #F0ECE4',
                        cursor: 'pointer',
                        background: unreadInGroup > 0 ? 'rgba(184,149,63,0.04)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <GroupIcon size={16} style={{ color: unreadInGroup > 0 ? '#C47F17' : '#9C9890', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: unreadInGroup > 0 ? 700 : 500, color: '#1A1A18' }}>
                          {config?.label(items.length) || `${items.length} ${type}`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {unreadInGroup > 0 && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)',
                            background: '#C47F17', color: '#FFFFFF',
                            borderRadius: 9999, padding: '1px 6px', lineHeight: '16px', minWidth: 18, textAlign: 'center',
                          }}>{unreadInGroup >= 10 ? '9+' : unreadInGroup}</span>
                        )}
                        <span style={{ fontSize: 11, color: '#9C9890', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>&#9654;</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ background: '#FAFAF8' }}>
                        {unreadInGroup > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markGroupRead(type) }}
                            style={{
                              display: 'block', width: '100%', padding: '6px 20px',
                              fontSize: 11, fontWeight: 600, color: '#B8953F',
                              background: 'none', border: 'none', borderBottom: '1px solid #F0ECE4',
                              cursor: 'pointer', textAlign: 'left',
                            }}
                          >
                            Marcar todo como leído
                          </button>
                        )}
                        {items.map((n) => {
                          const Icon = SEVERITY_ICON[n.severity] || Bell
                          const color = SEVERITY_COLOR[n.severity] || '#9C9890'
                          return (
                            <div
                              key={n.id}
                              onClick={() => !n.read && markRead(n.id)}
                              style={{
                                padding: '10px 20px 10px 36px',
                                borderBottom: '1px solid #F0ECE4',
                                cursor: 'pointer',
                                background: n.read ? 'transparent' : 'rgba(184,149,63,0.04)',
                              }}
                            >
                              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <Icon size={12} style={{ color, flexShrink: 0, marginTop: 3 }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 12, fontWeight: n.read ? 500 : 700, color: '#1A1A18' }}>{n.title}</div>
                                  <div style={{ fontSize: 10, color: '#9C9890', marginTop: 2, fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtDateTime(n.created_at)}</div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Ungrouped notifications */}
              {ungrouped.map((n) => {
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
              })}
            </>
          )}
        </div>
      </div>
    </>
  )
}
