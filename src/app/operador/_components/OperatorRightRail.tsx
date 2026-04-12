'use client'

import { BG_CARD, BORDER, GLASS_BLUR, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, GREEN, RED, ACCENT_CYAN } from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'
import { BridgeTimes } from '@/components/BridgeTimes'
import type { TeamMember } from '@/types/cockpit'
import type { WorkflowEvent } from '@/app/operador/cola/ExceptionCard'

function getUrgencyDot(createdAt: string): string {
  const ageH = (Date.now() - new Date(createdAt).getTime()) / 3600000
  if (ageH > 6) return RED
  if (ageH > 2) return '#FBBF24'
  return GREEN
}

function getTypeLabel(eventType: string): string {
  if (eventType.startsWith('classify')) return 'Clasificacion'
  if (eventType.startsWith('docs')) return 'Documentos'
  if (eventType.startsWith('crossing')) return 'Despacho'
  return 'Error'
}

interface OperatorRightRailProps {
  queuePreview: WorkflowEvent[]
  team: TeamMember[]
}

export function OperatorRightRail({ queuePreview, team }: OperatorRightRailProps) {
  const hasTeam = team.some(t => t.isOnline)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Queue preview */}
      {queuePreview.length > 0 && (
        <RailCard title="En cola">
          {queuePreview.slice(0, 5).map((evt) => (
            <div key={evt.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 0',
              borderBottom: `1px solid ${BORDER}`,
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: getUrgencyDot(evt.created_at),
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                color: TEXT_SECONDARY,
                flexShrink: 0,
              }}>
                {evt.company_id.substring(0, 8)}
              </span>
              <span style={{
                fontSize: 11,
                color: TEXT_MUTED,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {getTypeLabel(evt.event_type)}
              </span>
              <span style={{
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                color: TEXT_MUTED,
                flexShrink: 0,
              }}>
                {fmtDateTime(evt.created_at).split(', ')[1] || ''}
              </span>
            </div>
          ))}
        </RailCard>
      )}

      {/* Active team */}
      <RailCard title="Equipo activo">
        {!hasTeam ? (
          <div style={{ fontSize: 11, color: TEXT_MUTED, padding: '12px 0', textAlign: 'center' }}>
            Sin operadores conectados
          </div>
        ) : (
          team.filter(t => t.isOnline).map((member) => (
            <div key={member.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: GREEN,
                boxShadow: `0 0 6px ${GREEN}`,
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, flex: 1 }}>
                {member.full_name}
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: TEXT_MUTED }}>
                {member.actionsToday} resueltas
              </span>
            </div>
          ))
        )}
      </RailCard>

      {/* Bridge wait times */}
      <RailCard title="Puentes">
        <BridgeTimes />
      </RailCard>
    </div>
  )
}

function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: BG_CARD,
      backdropFilter: `blur(${GLASS_BLUR})`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
      border: `1px solid ${BORDER}`,
      borderRadius: 20,
      padding: '16px 18px',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: TEXT_MUTED,
        marginBottom: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}
