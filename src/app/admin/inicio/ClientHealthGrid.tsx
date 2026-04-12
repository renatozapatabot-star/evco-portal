'use client'

import Link from 'next/link'
import { fmtUSDCompact, fmtDateTime } from '@/lib/format-utils'
import { GREEN, AMBER, RED, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'
import type { ClientHealth, HealthStatus } from './types'

const cardStyle: React.CSSProperties = {
  padding: 24,
  borderRadius: 20,
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow:
    '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(0,229,255,0.12)',
}

function statusColor(s: HealthStatus): string {
  return s === 'red' ? RED : s === 'yellow' ? AMBER : GREEN
}

function statusLabel(s: HealthStatus): string {
  return s === 'red' ? 'Atención' : s === 'yellow' ? 'Revisar' : 'Saludable'
}

export function ClientHealthGrid({ clients }: { clients: ClientHealth[] }) {
  return (
    <section id="client-health" style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div>
          <h2
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: TEXT_MUTED,
              margin: 0,
            }}
          >
            Salud de cartera
          </h2>
          <p style={{ fontSize: 20, color: TEXT_PRIMARY, fontWeight: 700, margin: '4px 0 0 0' }}>
            Clientes activos
          </p>
        </div>
        <Link
          href="/admin"
          style={{
            fontSize: 12,
            color: TEXT_SECONDARY,
            textDecoration: 'none',
          }}
        >
          Ver todos →
        </Link>
      </div>

      {clients.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {clients.map(c => (
            <ClientCard key={c.company_id} client={c} />
          ))}
        </div>
      )}
    </section>
  )
}

function ClientCard({ client }: { client: ClientHealth }) {
  const color = statusColor(client.status)
  return (
    <Link
      href={`/admin?company=${encodeURIComponent(client.company_id)}`}
      style={{
        display: 'block',
        minHeight: 140,
        padding: 16,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 120ms',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(0,229,255,0.2)'
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 10 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '70%',
          }}
        >
          {client.name}
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            background: `${color}22`,
            color,
            border: `1px solid ${color}44`,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
          {statusLabel(client.status)}
        </span>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: 13,
          color: TEXT_PRIMARY,
          marginBottom: 8,
        }}
      >
        {client.traficos} tráfico{client.traficos === 1 ? '' : 's'} · {fmtUSDCompact(client.value_usd)}
      </div>

      <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 6 }}>
        Última actividad: {fmtDateTime(client.last_activity)}
      </div>

      <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.4 }}>
        {client.summary}
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        padding: 40,
        textAlign: 'center',
        color: TEXT_MUTED,
        fontSize: 13,
      }}
    >
      🗂️ Sin actividad de clientes en los últimos 7 días.
    </div>
  )
}
