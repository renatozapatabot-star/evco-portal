'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import { fmtDateTime } from '@/lib/format-utils'
import { track } from '@/lib/telemetry/useTrack'
import { getCompanyIdCookie } from '@/lib/client-config'

/**
 * V1 Polish Pack · Block 6 — in-app notification bell.
 * - Supabase Realtime subscription on `notifications` filtered by
 *   `user_id = {companyId}:{role}` (matched against `recipient_key`).
 *   Falls back to polling on focus if Realtime fails.
 * - Dropdown: 20 most recent, grouped by date
 * - Click a row → mark read + navigate to action_url
 * - ADUANA dark glass styling, JetBrains Mono on timestamps
 * - 60px min touch target on bell button
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

interface Notification {
  id: string
  title: string
  description: string
  severity: string
  action_url: string | null
  trafico_id: string | null
  entity_type: string | null
  entity_id: string | null
  read: boolean
  created_at: string
}

type ListResponse = {
  data: { notifications: Notification[]; unread: number } | null
  error: { code: string; message: string } | null
}

function groupByDay(items: Notification[]): Array<{ label: string; items: Notification[] }> {
  const fmt = (d: Date) => d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Chicago' })
  const today = fmt(new Date())
  const yesterday = fmt(new Date(Date.now() - 86400000))
  const groups = new Map<string, Notification[]>()
  for (const n of items) {
    const key = fmt(new Date(n.created_at))
    const label = key === today ? 'Hoy' : key === yesterday ? 'Ayer' : key
    const arr = groups.get(label) ?? []
    arr.push(n)
    groups.set(label, arr)
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/list', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as ListResponse
      if (json.data) {
        setItems(json.data.notifications)
        setUnread(json.data.unread)
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[notification-bell] list failed', err)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + refetch on window focus (polling fallback).
  useEffect(() => {
    fetchList()
    const onFocus = () => fetchList()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchList])

  // Supabase Realtime subscription — live updates on INSERT/UPDATE.
  // Scoped by company_id to match server-side listNotifications scoping.
  // Falls back to the focus-polling above if Realtime can't establish
  // (no env vars, no cookie, channel error).
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[notification-bell] Realtime disabled: missing Supabase env; falling back to polling')
      }
      return
    }
    const companyId = getCompanyIdCookie()
    if (!companyId) return

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
    let channel: RealtimeChannel | null = null
    let loggedFailure = false

    try {
      channel = supabase
        .channel(`notifications:${companyId}`)
        .on(
          // mirrors src/hooks/use-realtime-trafico.ts — Supabase types lag here
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'postgres_changes' as any, // any-ok: supabase-js realtime event name type lacks string literals
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `company_id=eq.${companyId}`,
          },
          () => { fetchList() },
        )
        .subscribe((status) => {
          if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && !loggedFailure) {
            loggedFailure = true
            if (process.env.NODE_ENV !== 'production') {
              console.warn(`[notification-bell] Realtime status=${status}; falling back to polling`)
            }
          }
        })
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[notification-bell] Realtime subscribe threw; falling back to polling', err)
      }
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [fetchList])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const handleOpen = () => {
    setOpen(v => !v)
    if (!open) fetchList()
  }

  const handleClick = async (n: Notification) => {
    track('notification_clicked', {
      entityType: n.entity_type ?? 'notification',
      entityId: n.id,
      metadata: { severity: n.severity, hasAction: Boolean(n.action_url) },
    })
    if (!n.read) {
      try {
        await fetch('/api/notifications/mark-read', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: n.id }),
        })
        setItems(prev => prev.map(i => (i.id === n.id ? { ...i, read: true } : i)))
        setUnread(u => Math.max(0, u - 1))
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[notification-bell] mark-read failed', err)
        }
      }
    }
    if (n.action_url) window.location.href = n.action_url
  }

  const badge = unread === 0 ? null : unread > 9 ? '9+' : String(unread)
  const groups = groupByDay(items)

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`${unread} notificaciones sin leer`}
        aria-expanded={open}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 60,
          minHeight: 60,
          padding: 8,
          borderRadius: 12,
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(230,237,243,0.85)',
          cursor: 'pointer',
          transition: 'background 150ms, border-color 150ms',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          e.currentTarget.style.borderColor = 'rgba(192,197,206,0.2)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        }}
      >
        <Bell size={18} />
        {badge && (
          <span
            aria-hidden
            style={{
              position: 'absolute', top: 10, right: 10,
              minWidth: 18, height: 18, padding: '0 5px',
              borderRadius: 9, background: 'var(--portal-fg-1)', color: '#0B1220',
              fontSize: 'var(--aguila-fs-label)', fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 9999,
            width: 380, maxHeight: 480, overflowY: 'auto',
            background: 'rgba(255,255,255,0.045)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(192,197,206,0.25)',
            borderRadius: 20,
            boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 25px -8px rgba(192,197,206,0.4)',
            padding: 12,
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 8px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: 'var(--portal-fg-1)' }}>Notificaciones</div>
            <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-4)', fontFamily: 'var(--font-mono)' }}>
              {loading ? 'Cargando…' : unread > 0 ? `${unread} sin leer` : 'Al día'}
            </div>
          </div>

          {items.length === 0 && !loading && (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <Bell size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)' }}>Sin notificaciones recientes</div>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', marginTop: 4 }}>
                Las menciones y alertas del sistema aparecerán aquí.
              </div>
            </div>
          )}

          {groups.map(group => (
            <div key={group.label} style={{ marginTop: 8 }}>
              <div style={{
                fontSize: 'var(--aguila-fs-label)', textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--portal-fg-5)', padding: '4px 8px',
              }}>
                {group.label}
              </div>
              {group.items.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  style={{
                    width: '100%', textAlign: 'left',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '10px 8px', borderRadius: 12,
                    background: n.read ? 'transparent' : 'rgba(192,197,206,0.06)',
                    border: '1px solid transparent',
                    color: 'var(--portal-fg-1)', cursor: 'pointer',
                    transition: 'background 150ms, border-color 150ms',
                    minHeight: 60,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(192,197,206,0.06)' }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 8, height: 8, marginTop: 6, flexShrink: 0,
                      borderRadius: '50%',
                      background: n.read ? 'transparent' : 'var(--portal-fg-3)',
                      boxShadow: n.read ? 'none' : '0 0 8px rgba(192,197,206,0.6)',
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'block', fontSize: 'var(--aguila-fs-body)', fontWeight: n.read ? 500 : 700,
                      color: 'var(--portal-fg-1)', marginBottom: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{n.title}</span>
                    <span style={{
                      display: 'block', fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)',
                      marginBottom: 4,
                    }}>{n.description}</span>
                    <span style={{
                      fontSize: 'var(--aguila-fs-label)', color: 'var(--portal-fg-5)',
                      fontFamily: 'var(--font-mono)',
                    }}>{fmtDateTime(n.created_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
