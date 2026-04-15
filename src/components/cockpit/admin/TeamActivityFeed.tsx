'use client'

import { useEffect, useState } from 'react'
import { useCockpitRealtime } from '@/hooks/use-cockpit-realtime'
import { IfThenCard } from '../shared/IfThenCard'

interface ActivityItem {
  id: string
  operatorName: string
  actionType: string
  time: string
  icon: string
}

const ACTION_LABELS: Record<string, { icon: string; label: string }> = {
  operator_login: { icon: '🟢', label: 'inició sesión' },
  operator_cockpit_view: { icon: '👁', label: 'abrió el cockpit' },
  view_cockpit: { icon: '👁', label: 'abrió el cockpit' },
  operator_classification_confirmed: { icon: '✓', label: 'confirmó clasificación' },
  operator_chase_message_copied: { icon: '📋', label: 'copió mensaje al proveedor' },
  operator_card_cleared: { icon: '🎯', label: 'limpió una tarjeta' },
  operator_mi_turno_clicked: { icon: '▶', label: 'avanzó en MI TURNO' },
  operator_kanban_card_clicked: { icon: '📦', label: 'revisó un embarque' },
  cruz_ai_query: { icon: '🤖', label: 'preguntó a Asistente AGUILA' },
  demo_lead_captured: { icon: '🎯', label: 'nuevo lead del demo' },
}

export function TeamActivityFeed() {
  const [feed, setFeed] = useState<ActivityItem[]>([])
  const [operators, setOperators] = useState<Record<string, string>>({})
  const { latestAction, isLive } = useCockpitRealtime()

  // Load operators map + initial feed
  useEffect(() => {
    Promise.all([
      fetch('/api/data?table=operators&limit=20').then(r => r.json()),
      fetch('/api/data?table=operator_actions&limit=15&order_by=created_at&order_dir=desc').then(r => r.json()),
    ]).then(([opsRes, actionsRes]) => {
      const opMap: Record<string, string> = {}
      for (const op of opsRes.data || []) opMap[op.id] = op.full_name || 'Operador'
      setOperators(opMap)

      const items = ((actionsRes.data || []) as Array<Record<string, unknown>>).map(a => {
        const at = ACTION_LABELS[a.action_type as string] || { icon: '•', label: a.action_type as string }
        const created = new Date(a.created_at as string)
        return {
          id: a.id as string,
          operatorName: opMap[a.operator_id as string] || 'Sistema',
          actionType: at.label,
          time: created.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' }),
          icon: at.icon,
        }
      })
      setFeed(items)
    }).catch(() => {})
  }, [])

  // Add realtime updates to feed
  useEffect(() => {
    if (!latestAction) return
    const at = ACTION_LABELS[latestAction.action_type] || { icon: '•', label: latestAction.action_type }
    const newItem: ActivityItem = {
      id: latestAction.id,
      operatorName: operators[latestAction.operator_id] || 'Operador',
      actionType: at.label,
      time: new Date(latestAction.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' }),
      icon: at.icon,
    }
    setFeed(prev => [newItem, ...prev.slice(0, 14)])
  }, [latestAction, operators])

  return (
    <IfThenCard
      id="admin-team-activity"
      state={isLive ? 'active' : 'quiet'}
      title="Actividad en vivo"
      activeCondition={isLive ? 'Conectado en tiempo real' : undefined}
      quietContent={
        feed.length === 0 ? (
          <div style={{ padding: '12px 0', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
            Sin actividad reciente
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
            {feed.map((item, i) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 8px', borderRadius: 6,
                background: i === 0 ? 'rgba(192,197,206,0.04)' : 'transparent',
                animation: i === 0 ? 'fadeIn 300ms ease' : undefined,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' }}>{item.icon}</span>
                <span style={{ fontSize: 12, color: '#E8EAED', fontWeight: 600, flexShrink: 0 }}>
                  {item.operatorName.split(' ')[0]}
                </span>
                <span style={{ fontSize: 12, color: '#8B949E', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.actionType}
                </span>
                <span className="font-mono" style={{ fontSize: 10, color: '#6E7681', flexShrink: 0 }}>
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        )
      }
      footer={
        <span style={{ color: isLive ? '#16A34A' : '#6E7681' }}>
          {isLive ? '● En vivo' : '○ Sin conexión en tiempo real'}
        </span>
      }
    />
  )
}
