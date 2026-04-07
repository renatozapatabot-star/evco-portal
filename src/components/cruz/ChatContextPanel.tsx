'use client'

import { AlertTriangle, Clock, FileText } from 'lucide-react'
import { D } from './ChatMessageList'

interface PanelData {
  enProceso: { trafico_number?: string; id?: string; estatus?: string }[]
  urgent: { trafico_number?: string; id?: string }[]
  alertTitle: string | null
}

interface ChatContextPanelProps {
  panelData: PanelData
}

export default function ChatContextPanel({ panelData }: ChatContextPanelProps) {
  return (
    <aside style={{
      width: '35%', borderLeft: `1px solid ${D.border}`,
      padding: 20, overflowY: 'auto', background: D.bg,
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      {/* En seguimiento */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 10,
                      letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
          En seguimiento
        </div>
        {panelData.urgent.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {panelData.urgent.map((t, i) => (
              <div key={i} style={{
                background: D.surface, border: `1px solid ${D.border}`,
                borderRadius: 8, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertTriangle size={14} style={{ color: '#C47F17', flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: D.text, fontWeight: 600, fontFamily: 'var(--font-jetbrains-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.trafico_number || t.id || 'Sin numero'}
                </div>
                <div style={{ fontSize: 11, color: D.textMuted, marginLeft: 'auto', flexShrink: 0 }}>
                  Sin pedimento
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: D.textMuted, padding: '8px 0' }}>
            Sin pendientes
          </div>
        )}
      </div>

      {/* En proceso */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 10,
                      letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
          En proceso ({panelData.enProceso.length})
        </div>
        {panelData.enProceso.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {panelData.enProceso.map((t, i) => (
              <div key={i} style={{
                background: D.surface, border: `1px solid ${D.border}`,
                borderRadius: 8, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Clock size={14} style={{ color: D.textMuted, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: D.text, fontWeight: 600, fontFamily: 'var(--font-jetbrains-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.trafico_number || t.id || 'Sin numero'}
                </div>
                <div style={{ fontSize: 11, color: D.textMuted, marginLeft: 'auto', flexShrink: 0 }}>
                  {t.estatus || 'En proceso'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: D.textMuted, padding: '8px 0' }}>
            Sin traficos en proceso
          </div>
        )}
      </div>

      {/* Alertas */}
      {panelData.alertTitle && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 10,
                        letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
            Alerta activa
          </div>
          <div style={{
            background: D.surface, border: `1px solid ${D.border}`,
            borderRadius: 8, padding: '10px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <FileText size={14} style={{ color: '#C47F17', flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: D.text }}>
              {panelData.alertTitle}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
