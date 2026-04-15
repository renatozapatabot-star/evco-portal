'use client'

import Link from 'next/link'
import { fmtUSDFull } from '@/lib/format-utils'
import {
  GOLD, GREEN, AMBER, RED, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
} from '@/lib/design-system'
import type { InicioData } from './types'

const panelStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 20,
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow:
    '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(192,197,206,0.12)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--aguila-fs-label)',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: TEXT_MUTED,
  margin: 0,
}

export function RightRail({ rail }: { rail: InicioData['rightRail'] }) {
  const sysFailed = rail.system.workflowFailed
  const sysPending = rail.system.workflowPending
  const sysColor = sysFailed > 0 ? RED : sysPending >= 10 ? AMBER : GREEN
  const sysLabel = sysFailed > 0
    ? `${sysFailed} evento${sysFailed === 1 ? '' : 's'} fallido${sysFailed === 1 ? '' : 's'}`
    : sysPending >= 10
    ? `${sysPending} eventos en cola`
    : 'Pipeline saludable'

  const topOperator = rail.team[0]

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {/* Decisiones */}
      <section style={panelStyle}>
        <h3 style={labelStyle}>Decisiones que requieren tu atención</h3>
        <div
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-large)',
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
              fontSize: 'var(--aguila-fs-body)',
              textDecoration: 'none',
              width: '100%',
            }}
          >
            Ver cola →
          </Link>
        ) : (
          <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: 0 }}>
            Sin decisiones pendientes de broker.
          </p>
        )}
      </section>

      {/* Estado del sistema */}
      <section style={panelStyle}>
        <h3 style={labelStyle}>Estado del sistema</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: sysColor, boxShadow: `0 0 6px ${sysColor}`,
          }} />
          <span style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_PRIMARY, fontWeight: 600 }}>
            {sysLabel}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: topOperator ? 10 : 0 }}>
          <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>Costo IA hoy</span>
          <span
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 'var(--aguila-fs-body)',
              color: GOLD,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtUSDFull(rail.system.todaySpendUsd)}
          </span>
        </div>
        {topOperator && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>Operador más activo</span>
            <span style={{ fontSize: 12, color: TEXT_PRIMARY, fontWeight: 600 }}>
              {topOperator.name} · {topOperator.actions}
            </span>
          </div>
        )}
      </section>
    </aside>
  )
}
