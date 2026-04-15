'use client'

import { useEffect, useState } from 'react'
import { csrfFetch } from '@/lib/client-config'
import { ROUTABLE_EVENT_KINDS, EVENT_KIND_LABELS } from '@/lib/telegram/formatters'

type RoutingRow = {
  id: string
  user_id: string | null
  chat_id: string
  event_kind: string
  enabled: boolean
}

type TestState = Record<string, 'idle' | 'sending' | 'ok' | 'err'>

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.045)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(192,197,206,0.18)',
  borderRadius: 20,
  padding: 20,
}

const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#E6EDF3',
  borderRadius: 10,
  padding: '0 12px',
  height: 44,
  fontSize: 'var(--aguila-fs-body)',
  fontFamily: 'var(--font-jetbrains-mono, monospace)',
  minWidth: 220,
}

const BTN: React.CSSProperties = {
  background: 'linear-gradient(135deg,#E8EAED 0%,#C0C5CE 50%,#7A7E86 100%)',
  color: '#0A0A0C',
  border: 'none',
  borderRadius: 12,
  height: 44,
  padding: '0 16px',
  fontWeight: 600,
  fontSize: 'var(--aguila-fs-body)',
  cursor: 'pointer',
  minHeight: 44,
}

export function NotificacionesClient({ role }: { role: string }) {
  const [rows, setRows] = useState<Record<string, RoutingRow | null>>({})
  const [loading, setLoading] = useState(true)
  const [testState, setTestState] = useState<TestState>({})
  const [savingKind, setSavingKind] = useState<string | null>(null)

  const isAdmin = role === 'admin' || role === 'broker'

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/telegram/routing')
        const json = await res.json()
        if (!alive) return
        const byKind: Record<string, RoutingRow | null> = {}
        for (const kind of ROUTABLE_EVENT_KINDS) byKind[kind] = null
        for (const r of (json.data ?? []) as RoutingRow[]) {
          byKind[r.event_kind] = r
        }
        setRows(byKind)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const save = async (kind: string, patch: Partial<RoutingRow>) => {
    setSavingKind(kind)
    try {
      const current = rows[kind]
      const body = {
        chat_id: patch.chat_id ?? current?.chat_id ?? '',
        event_kind: kind,
        enabled: patch.enabled ?? current?.enabled ?? true,
      }
      if (!body.chat_id) {
        setSavingKind(null)
        return
      }
      const res = await csrfFetch('/api/telegram/routing', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.data) {
        setRows((prev) => ({ ...prev, [kind]: json.data as RoutingRow }))
      }
    } finally {
      setSavingKind(null)
    }
  }

  const sendTest = async (kind: string) => {
    const current = rows[kind]
    if (!current?.chat_id) return
    setTestState((s) => ({ ...s, [kind]: 'sending' }))
    try {
      const res = await csrfFetch('/api/telegram/test', {
        method: 'POST',
        body: JSON.stringify({ chatId: current.chat_id, eventKind: kind }),
      })
      const json = await res.json()
      setTestState((s) => ({ ...s, [kind]: json.error ? 'err' : 'ok' }))
    } catch {
      setTestState((s) => ({ ...s, [kind]: 'err' }))
    }
    setTimeout(() => setTestState((s) => ({ ...s, [kind]: 'idle' })), 3000)
  }

  if (loading) {
    return <div style={{ ...CARD, color: '#94a3b8' }}>Cargando…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={CARD}>
        <div
          style={{
            fontSize: 'var(--aguila-fs-label)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#7A7E86',
            marginBottom: 8,
          }}
        >
          Reglas por evento
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ROUTABLE_EVENT_KINDS.map((kind) => {
            const row = rows[kind]
            const state = testState[kind] ?? 'idle'
            return (
              <div
                key={kind}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: 12,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600 }}>
                    {EVENT_KIND_LABELS[kind] ?? kind}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--aguila-fs-meta)',
                      color: '#7A7E86',
                      fontFamily: 'var(--font-jetbrains-mono, monospace)',
                    }}
                  >
                    {kind}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="chat_id"
                  defaultValue={row?.chat_id ?? ''}
                  style={INPUT}
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim()
                    if (v && v !== row?.chat_id) void save(kind, { chat_id: v })
                  }}
                />
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 'var(--aguila-fs-compact)',
                    color: '#94a3b8',
                    minHeight: 44,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={row?.enabled ?? false}
                    disabled={!row?.chat_id}
                    onChange={(e) => void save(kind, { enabled: e.currentTarget.checked })}
                    style={{ width: 20, height: 20 }}
                  />
                  Activa
                </label>
                <button
                  type="button"
                  onClick={() => void sendTest(kind)}
                  disabled={!row?.chat_id || state === 'sending'}
                  style={{
                    ...BTN,
                    opacity: !row?.chat_id ? 0.4 : 1,
                    minWidth: 160,
                  }}
                >
                  {state === 'sending'
                    ? 'Enviando…'
                    : state === 'ok'
                      ? 'Enviada ✓'
                      : state === 'err'
                        ? 'Error'
                        : 'Probar notificación'}
                </button>
                <div
                  style={{
                    fontSize: 'var(--aguila-fs-meta)',
                    color: savingKind === kind ? '#C0C5CE' : 'transparent',
                    minWidth: 60,
                  }}
                >
                  guardando…
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {isAdmin && (
        <div style={{ ...CARD, fontSize: 'var(--aguila-fs-compact)', color: '#94a3b8' }}>
          Como admin puedes editar tus propias reglas aquí. Para configurar las de
          otros miembros del equipo, usa <code>POST /api/telegram/routing</code> con{' '}
          <code>user_id</code> objetivo.
        </div>
      )}
    </div>
  )
}
