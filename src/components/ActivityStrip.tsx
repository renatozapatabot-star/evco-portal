'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { fmtDateTime } from '@/lib/format-utils'

interface ActivityItem {
  id: string
  operatorName: string
  action: string
  entityRef: string
  entityHref: string
  timestamp: string
}

const ACTION_LABELS: Record<string, { verb: string; entityPrefix: string }> = {
  operator_login: { verb: 'inició sesión', entityPrefix: '' },
  operator_cockpit_view: { verb: 'abrió el cockpit', entityPrefix: '' },
  view_cockpit: { verb: 'abrió el cockpit', entityPrefix: '' },
  operator_classification_confirmed: { verb: 'clasificó', entityPrefix: '' },
  operator_chase_message_copied: { verb: 'solicitó docs para', entityPrefix: '' },
  operator_card_cleared: { verb: 'completó', entityPrefix: '' },
  operator_mi_turno_clicked: { verb: 'avanzó en', entityPrefix: '' },
  operator_kanban_card_clicked: { verb: 'revisó', entityPrefix: '' },
  cruz_ai_query: { verb: 'consultó Asistente PORTAL', entityPrefix: '' },
  demo_lead_captured: { verb: 'capturó lead', entityPrefix: '' },
}

function getFirstName(fullName: string): string {
  const name = fullName?.trim()
  if (!name) return 'Sistema'
  return name.split(' ')[0]
}

function buildActivityItem(
  raw: Record<string, unknown>,
  operatorMap: Record<string, string>,
): ActivityItem {
  const actionType = raw.action_type as string
  const labels = ACTION_LABELS[actionType]
  const operatorName = getFirstName(operatorMap[raw.operator_id as string] || 'Sistema')
  const verb = labels?.verb || (actionType || '').replace(/_/g, ' ')

  // Try to extract a embarque reference from metadata
  const meta = (raw.metadata || {}) as Record<string, unknown>
  const traficoId = (meta.trafico_id || meta.trafico || meta.entity_id || '') as string
  const entityRef = traficoId || ''
  const entityHref = traficoId ? `/embarques/${encodeURIComponent(traficoId)}` : ''

  return {
    id: raw.id as string,
    operatorName,
    action: verb,
    entityRef,
    entityHref,
    timestamp: raw.created_at as string,
  }
}

export function ActivityStrip() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasNew, setHasNew] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const prevCountRef = useRef(0)

  const loadActivity = useCallback(async () => {
    try {
      const [opsRes, actionsRes] = await Promise.all([
        fetch('/api/data?table=operators&limit=20').then(r => r.json()),
        fetch('/api/data?table=operator_actions&limit=8&order_by=created_at&order_dir=desc').then(r => r.json()),
      ])

      const opMap: Record<string, string> = {}
      for (const op of (opsRes.data || [])) {
        opMap[op.id] = op.full_name || 'Operador'
      }

      const actions = ((actionsRes.data || []) as Array<Record<string, unknown>>).map(a =>
        buildActivityItem(a, opMap),
      )

      // Detect new activity
      if (prevCountRef.current > 0 && actions.length > 0) {
        const prevFirst = items[0]?.id
        if (prevFirst && actions[0]?.id !== prevFirst) {
          setHasNew(true)
          setTimeout(() => setHasNew(false), 5000)
        }
      }
      prevCountRef.current = actions.length

      setItems(actions)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [items])

  useEffect(() => {
    loadActivity()
    const interval = setInterval(loadActivity, 60_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 12,
      padding: '12px 12px 8px',
      margin: '8px 12px 0',
    }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          marginBottom: collapsed ? 0 : 8,
        }}
      >
        {/* Pulse dot */}
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: hasNew ? 'var(--portal-fg-3)' : 'rgba(255,255,255,0.2)',
          flexShrink: 0,
          transition: 'background 300ms',
          boxShadow: hasNew ? '0 0 8px rgba(192,197,206,0.6)' : 'none',
          animation: hasNew ? 'activityPulse 1.5s ease-in-out infinite' : 'none',
        }} />
        <span style={{
          fontSize: 'var(--aguila-fs-meta)',
          fontWeight: 600,
          color: 'var(--portal-fg-4)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          flex: 1,
          textAlign: 'left',
        }}>
          Actividad
        </span>
        <span style={{
          fontSize: 'var(--aguila-fs-label)',
          color: 'var(--portal-fg-5)',
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: 'transform 200ms',
        }}>
          ▾
        </span>
      </button>

      {/* Feed items */}
      {!collapsed && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {loading ? (
            <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', padding: '8px 0', textAlign: 'center' }}>
              Cargando...
            </div>
          ) : items.length === 0 ? (
            <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', padding: '8px 0', textAlign: 'center' }}>
              Sin actividad reciente
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} style={{
                padding: '4px 0',
              }}>
                {/* Action line */}
                <div style={{
                  fontSize: 'var(--aguila-fs-compact)',
                  lineHeight: '16px',
                  color: 'var(--portal-fg-1)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ fontWeight: 600 }}>{item.operatorName}</span>
                  {' '}
                  <span style={{ color: 'var(--portal-fg-4)' }}>{item.action}</span>
                  {item.entityRef && item.entityHref && (
                    <>
                      {' '}
                      <Link
                        href={item.entityHref}
                        style={{
                          color: 'var(--portal-fg-3)',
                          textDecoration: 'none',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--aguila-fs-meta)',
                        }}
                      >
                        {item.entityRef}
                      </Link>
                    </>
                  )}
                </div>
                {/* Timestamp */}
                <div style={{
                  fontSize: 'var(--aguila-fs-label)',
                  color: 'var(--portal-fg-5)',
                  fontFamily: 'var(--font-mono)',
                  marginTop: 1,
                }}>
                  {fmtDateTime(item.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes activityPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
