'use client'

import { BG_CARD, BORDER, GLASS_BLUR, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, GREEN, GOLD, ACCENT_CYAN } from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'
import type { PipelineStage, ActivityEvent, TeamMember } from '@/types/cockpit'

const ACTION_LABELS: Record<string, string> = {
  view_page: 'vio pagina',
  login: 'inicio sesion',
  logout: 'cerro sesion',
  vote_classification: 'voto clasificacion',
  override_ai_decision: 'corrigio clasificacion',
  assign_trafico: 'asigno trafico',
  release_trafico: 'libero trafico',
  send_email: 'envio email',
}

interface AdminRightRailProps {
  pipeline: PipelineStage[]
  activity: ActivityEvent[]
  team: TeamMember[]
  isLive: boolean
}

export function AdminRightRail({ pipeline, activity, team, isLive }: AdminRightRailProps) {
  const maxCount = Math.max(...pipeline.map(s => s.count), 1)
  const hasPipeline = pipeline.some(s => s.count > 0)
  const hasTeam = team.some(t => t.isOnline)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Pipeline funnel */}
      {hasPipeline && (
        <RailCard title="Pipeline">
          {pipeline.filter(s => s.count > 0).map(stage => (
            <div key={stage.estatus} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 0',
            }}>
              <span style={{
                fontSize: 11,
                color: TEXT_SECONDARY,
                width: 100,
                flexShrink: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {stage.estatus}
              </span>
              <div style={{
                flex: 1,
                height: 8,
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(stage.count / maxCount) * 100}%`,
                  height: '100%',
                  background: ACCENT_CYAN,
                  borderRadius: 4,
                  opacity: 0.6,
                }} />
              </div>
              <span style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: TEXT_PRIMARY,
                fontWeight: 700,
                width: 30,
                textAlign: 'right',
                flexShrink: 0,
              }}>
                {stage.count}
              </span>
            </div>
          ))}
        </RailCard>
      )}

      {/* Live activity */}
      <RailCard title="Actividad en vivo" dot={isLive}>
        {activity.length === 0 ? (
          <div style={{ fontSize: 11, color: TEXT_MUTED, padding: '12px 0', textAlign: 'center' }}>
            Sin actividad reciente
          </div>
        ) : (
          activity.slice(0, 10).map((evt) => (
            <div key={evt.id} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '6px 0',
              borderBottom: `1px solid ${BORDER}`,
            }}>
              <span style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: TEXT_MUTED,
                flexShrink: 0,
                marginTop: 1,
              }}>
                {fmtDateTime(evt.created_at).split(', ')[1] || fmtDateTime(evt.created_at)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_PRIMARY }}>
                  {evt.operator_name}
                </span>
                <span style={{ fontSize: 11, color: GOLD, marginLeft: 6 }}>
                  {ACTION_LABELS[evt.action_type] || evt.action_type}
                </span>
              </div>
            </div>
          ))
        )}
      </RailCard>

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
                {member.actionsToday} hoy
              </span>
            </div>
          ))
        )}
      </RailCard>
    </div>
  )
}

function RailCard({ title, children, dot }: { title: string; children: React.ReactNode; dot?: boolean }) {
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
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
      }}>
        {dot && (
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: GREEN,
            animation: 'pulse 2s infinite',
          }} />
        )}
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: TEXT_MUTED,
        }}>
          {title}
        </span>
      </div>
      {children}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
