'use client'

import Link from 'next/link'
import { fmtUSDCompact } from '@/lib/format-utils'
import {
  GREEN, AMBER, RED, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
} from '@/lib/design-system'
import type { ClientHealth, HealthStatus } from './types'

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

function dotColor(s: HealthStatus): string {
  return s === 'red' ? RED : s === 'yellow' ? AMBER : GREEN
}

export function ClientHealthGrid({ clients }: { clients: ClientHealth[] }) {
  return (
    <section id="client-health" style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <h2
          style={{
            fontSize: 'var(--aguila-fs-label)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: TEXT_MUTED,
            margin: 0,
          }}
        >
          Cartera
        </h2>
        <Link
          href="/admin"
          style={{ fontSize: 12, color: TEXT_SECONDARY, textDecoration: 'none' }}
        >
          Ver todos →
        </Link>
      </div>

      {clients.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className="admin-nav-cards"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
        >
          {clients.map(c => (
            <ClientCard key={c.company_id} client={c} />
          ))}
        </div>
      )}

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.admin-nav-cards) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}

function ClientCard({ client }: { client: ClientHealth }) {
  const color = dotColor(client.status)
  return (
    <Link
      href={`/admin?company=${encodeURIComponent(client.company_id)}`}
      style={{
        display: 'block',
        padding: 14,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 120ms',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(192,197,206,0.2)'
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: color, boxShadow: `0 0 6px ${color}`,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: TEXT_PRIMARY,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {client.name}
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: 12, color: TEXT_SECONDARY, flexShrink: 0,
        }}>
          {client.traficos} · {fmtUSDCompact(client.value_usd)}
        </span>
      </div>
      <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 6, paddingLeft: 16 }}>
        {client.summary}
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div style={{ padding: 28, textAlign: 'center', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
      Sin actividad de clientes en los últimos 7 días.
    </div>
  )
}
