'use client'

import Link from 'next/link'
import { fmtUSDFull } from '@/lib/format-utils'
import { ACCENT_CYAN, GOLD, GREEN, AMBER, RED, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'
import type { InicioData } from './types'

const panelStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 20,
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow:
    '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(0,229,255,0.12)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: TEXT_MUTED,
  margin: 0,
}

export function RightRail({ rail }: { rail: InicioData['rightRail'] }) {
  const sysFailed = rail.system.workflowFailed
  const sysPending = rail.system.workflowPending
  const sysHealthy = sysFailed === 0 && sysPending < 10

  const sysColor = sysFailed > 0 ? RED : sysPending >= 10 ? AMBER : GREEN
  const sysLabel = sysFailed > 0
    ? `🔴 ${sysFailed} evento${sysFailed === 1 ? '' : 's'} fallido${sysFailed === 1 ? '' : 's'}`
    : sysPending >= 10
    ? `🟡 ${sysPending} eventos en cola`
    : '🟢 Pipeline saludable'

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {/* Decisiones */}
      <section style={panelStyle}>
        <h3 style={labelStyle}>Decisiones que requieren tu atención</h3>
        <div
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 44,
            fontWeight: 800,
            color: rail.decisionesPendientes > 0 ? GOLD : TEXT_MUTED,
            margin: '8px 0 12px 0',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rail.decisionesPendientes}
        </div>
        {rail.decisionesPendientes > 0 ? (
          <Link
            href="/admin/aprobaciones"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              padding: '10px 16px',
              borderRadius: 12,
              background: GOLD,
              color: '#0B0F1A',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
              width: '100%',
            }}
          >
            Ver cola de aprobaciones →
          </Link>
        ) : (
          <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: 0 }}>
            Sin decisiones pendientes de broker.
          </p>
        )}
      </section>

      {/* Equipo */}
      <section style={panelStyle}>
        <h3 style={labelStyle}>Equipo activo (24h)</h3>
        {rail.team.length === 0 ? (
          <p style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 12, marginBottom: 0 }}>
            Sin actividad reciente.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rail.team.map(t => (
              <li
                key={t.operator_id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span style={{ fontSize: 13, color: TEXT_PRIMARY, fontWeight: 600 }}>{t.name}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: 13,
                    color: ACCENT_CYAN,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {t.actions} acc{t.actions === 1 ? 'ión' : 'iones'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sistema */}
      <section style={panelStyle}>
        <h3 style={labelStyle}>Sistema</h3>
        <div style={{ fontSize: 13, color: sysColor, fontWeight: 700, marginTop: 12, marginBottom: 8 }}>
          {sysLabel}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>Costo IA hoy</span>
          <span
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 13,
              color: GOLD,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtUSDFull(rail.system.todaySpendUsd)}
          </span>
        </div>
        {sysHealthy ? null : (
          <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 12, marginBottom: 0 }}>
            Revisa la cola de workflow_events.
          </p>
        )}
      </section>
    </aside>
  )
}
