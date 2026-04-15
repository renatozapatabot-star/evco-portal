'use client'

/**
 * ClienteInicio — 3-tab cliente self-service cockpit (V1.5 F11).
 *
 * Tabs: Mis embarques activos · Documentos · Notificaciones.
 * Mobile 375px: tab pills stack on top; cards collapse to single column.
 *
 * ZAPATA AI silver-glass aesthetic, JetBrains Mono on refs/timestamps/filenames.
 * Zero relative times — always fmtDateTime / fmtDate via format-utils.
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  Truck, FileText, Package, CheckCircle, AlertCircle, MapPin, Flag, Circle,
  Bell, FolderOpen, Download,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fmtDate, fmtDateTime } from '@/lib/format-utils'
import {
  getClienteEventLabel,
  type ClienteEventLabel,
} from '@/lib/cliente/event-labels'
import type {
  ClienteTraficoCard,
  ClienteDocumento,
  ClienteNotificacion,
} from '@/lib/cliente/dashboard'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { GlassCard } from '@/components/aguila'

// ── Icon resolver ─────────────────────────────────────────────
const ICONS: Record<ClienteEventLabel['icon'], LucideIcon> = {
  'truck': Truck,
  'file-text': FileText,
  'package': Package,
  'check-circle': CheckCircle,
  'alert-circle': AlertCircle,
  'map-pin': MapPin,
  'flag': Flag,
  'circle': Circle,
}

// ── Status pulse color ────────────────────────────────────────
function statusPulse(estatus: string | null): string {
  const s = (estatus ?? '').toLowerCase()
  if (s.includes('cruzad')) return '#22C55E'
  if (s.includes('deten') || s.includes('riesgo') || s.includes('rojo')) return '#EF4444'
  if (s.includes('aduana') || s.includes('proceso') || s.includes('documen')) return '#FBBF24'
  return '#C0C5CE'
}

// ── Shared surface tokens ─────────────────────────────────────
// Card chrome is unified through <GlassCard> per ZAPATA AI v6 (core-invariants 26).
const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' }

// ── Tab definitions ───────────────────────────────────────────
type TabKey = 'traficos' | 'documentos' | 'notificaciones'

type Props = {
  companyName: string
  activeTraficos: ClienteTraficoCard[]
  documentos: ClienteDocumento[]
  notificaciones: ClienteNotificacion[]
}

export function ClienteInicio({
  companyName,
  activeTraficos,
  documentos,
  notificaciones,
}: Props) {
  const [tab, setTab] = useState<TabKey>('traficos')

  const tabs: Array<{ key: TabKey; label: string; count: number; icon: LucideIcon }> = [
    { key: 'traficos',       label: 'Mis embarques activos', count: activeTraficos.length, icon: Truck },
    { key: 'documentos',     label: 'Documentos',           count: documentos.length,     icon: FolderOpen },
    { key: 'notificaciones', label: 'Notificaciones',       count: notificaciones.length, icon: Bell },
  ]

  return (
    <div style={{ padding: '8px 0', maxWidth: 1400, margin: '0 auto' }}>
      {/* ZAPATA AI brand trio */}
      <CockpitBrandHeader subtitle={companyName ? `Inicio · ${companyName}` : 'Inicio'} />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontSize: 'var(--aguila-fs-title)', fontWeight: 800, color: '#E6EDF3',
          margin: 0, letterSpacing: '-0.03em',
        }}>
          {companyName || 'Mi portal'}
        </h1>
        <p style={{ fontSize: 'var(--aguila-fs-body)', color: '#94a3b8', margin: '4px 0 0' }}>
          Estado en tiempo real de tus operaciones
        </p>
      </div>

      {/* Tab pills */}
      <div
        className="cliente-tabs"
        style={{
          display: 'flex', gap: 8, flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                minHeight: 60, padding: '10px 18px',
                border: active
                  ? '1px solid rgba(192,197,206,0.35)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 999,
                background: active ? 'rgba(192,197,206,0.12)' : 'rgba(255,255,255,0.04)',
                color: active ? '#E8EAED' : '#94a3b8',
                cursor: 'pointer',
                fontSize: 'var(--aguila-fs-body)', fontWeight: 600,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                transition: 'all 120ms ease',
              }}
              aria-pressed={active}
            >
              <Icon size={14} />
              <span>{t.label}</span>
              <span style={{
                ...MONO,
                fontSize: 'var(--aguila-fs-meta)',
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.35)',
                color: active ? '#E8EAED' : '#64748b',
              }}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Tab panels */}
      {tab === 'traficos'       && <TraficosPanel rows={activeTraficos} />}
      {tab === 'documentos'     && <DocumentosPanel rows={documentos} />}
      {tab === 'notificaciones' && <NotificacionesPanel rows={notificaciones} />}

      <style>{`
        @media (max-width: 640px) {
          .cliente-tabs { flex-direction: column; }
          .cliente-tabs > button { width: 100%; justify-content: flex-start; }
          .cliente-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// ── Panel: embarques activos ───────────────────────────────────

function TraficosPanel({ rows }: { rows: ClienteTraficoCard[] }) {
  if (rows.length === 0) {
    return (
      <EmptyCard
        icon={<Truck size={24} color="#475569" />}
        title="Sin embarques activos"
        subtitle="Tus operaciones en curso aparecerán aquí."
      />
    )
  }

  return (
    <div
      className="cliente-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 12,
      }}
    >
      {rows.map(r => {
        const pulse = statusPulse(r.estatus)
        const lastLabel = getClienteEventLabel(r.last_event_type)
        const Icon = ICONS[lastLabel.icon]
        return (
          <GlassCard
            key={r.trafico}
            href={`/embarques/${encodeURIComponent(r.trafico)}/trace`}
            padding={16}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 60 }}
          >
            {/* Top row: ref + status dot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{
                ...MONO,
                fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: '#E6EDF3',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {r.trafico}
              </div>
              <span
                title={r.estatus ?? ''}
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: pulse, boxShadow: `0 0 8px ${pulse}`,
                  flexShrink: 0,
                }}
              />
            </div>

            {/* Estatus badge + ETA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {r.estatus && (
                <span style={{
                  fontSize: 'var(--aguila-fs-meta)', fontWeight: 600,
                  padding: '3px 10px', borderRadius: 999,
                  background: 'rgba(192,197,206,0.12)',
                  color: '#C0C5CE',
                }}>
                  {r.estatus}
                </span>
              )}
              {r.fecha_llegada && (
                <span style={{ ...MONO, fontSize: 'var(--aguila-fs-meta)', color: '#64748b' }}>
                  ETA {fmtDate(r.fecha_llegada)}
                </span>
              )}
            </div>

            {/* Last event */}
            {r.last_event_type && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                paddingTop: 8,
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}>
                <Icon size={14} color="#C0C5CE" />
                <span style={{
                  fontSize: 'var(--aguila-fs-compact)', color: '#94a3b8',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1, minWidth: 0,
                }}>
                  {lastLabel.label}
                </span>
                {r.last_event_at && (
                  <span style={{ ...MONO, fontSize: 'var(--aguila-fs-label)', color: '#64748b', flexShrink: 0 }}>
                    {fmtDateTime(r.last_event_at)}
                  </span>
                )}
              </div>
            )}
          </GlassCard>
        )
      })}
    </div>
  )
}

// ── Panel: documentos ─────────────────────────────────────────

function DocumentosPanel({ rows }: { rows: ClienteDocumento[] }) {
  if (rows.length === 0) {
    return (
      <EmptyCard
        icon={<FolderOpen size={24} color="#475569" />}
        title="Sin documentos"
        subtitle="Los expedientes de tus embarques aparecerán aquí a medida que se carguen."
      />
    )
  }

  // Group by trafico_id, preserving insertion order (already date-desc).
  const groups = new Map<string, ClienteDocumento[]>()
  for (const d of rows) {
    const key = d.trafico_id ?? '—'
    const arr = groups.get(key) ?? []
    arr.push(d)
    groups.set(key, arr)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from(groups.entries()).map(([traficoRef, docs]) => (
        <GlassCard key={traficoRef} padding={16}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 12,
          }}>
            <Truck size={14} color="#C0C5CE" />
            <Link
              href={`/embarques/${encodeURIComponent(traficoRef)}/trace`}
              style={{
                ...MONO,
                fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: '#E6EDF3',
                textDecoration: 'none',
              }}
            >
              {traficoRef}
            </Link>
            <span style={{ ...MONO, fontSize: 'var(--aguila-fs-meta)', color: '#64748b', marginLeft: 'auto' }}>
              {docs.length} {docs.length === 1 ? 'documento' : 'documentos'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {docs.map((d, i) => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0',
                borderBottom: i < docs.length - 1
                  ? '1px solid rgba(255,255,255,0.04)' : 'none',
                minHeight: 44,
              }}>
                <FileText size={14} color="#64748b" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    ...MONO,
                    fontSize: 'var(--aguila-fs-compact)', color: '#E6EDF3',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {d.nombre ?? 'Sin nombre'}
                  </div>
                  <div style={{ fontSize: 'var(--aguila-fs-label)', color: '#64748b', marginTop: 2 }}>
                    {d.doc_type ?? 'Documento'}
                    {d.created_at && (
                      <>
                        {' · '}
                        <span style={MONO}>{fmtDate(d.created_at)}</span>
                      </>
                    )}
                  </div>
                </div>
                {d.file_url && (
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      minHeight: 44, padding: '8px 12px',
                      borderRadius: 10,
                      background: 'rgba(192,197,206,0.12)',
                      color: '#C0C5CE',
                      fontSize: 'var(--aguila-fs-meta)', fontWeight: 600,
                      textDecoration: 'none',
                      flexShrink: 0,
                    }}
                  >
                    <Download size={12} />
                    <span>Descargar</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

// ── Panel: notificaciones ─────────────────────────────────────

function NotificacionesPanel({ rows }: { rows: ClienteNotificacion[] }) {
  if (rows.length === 0) {
    return (
      <EmptyCard
        icon={<Bell size={24} color="#475569" />}
        title="Sin notificaciones"
        subtitle="Aquí verás las actualizaciones recientes de tus embarques."
      />
    )
  }

  return (
    <GlassCard padding={8}>
      {rows.map((n, i) => {
        const label = getClienteEventLabel(n.event_type)
        const Icon = ICONS[label.icon]
        const content = (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 12px',
            borderBottom: i < rows.length - 1
              ? '1px solid rgba(255,255,255,0.04)' : 'none',
            minHeight: 60,
          }}>
            <Icon size={16} color="#C0C5CE" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--aguila-fs-body)', color: '#E6EDF3', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {label.label}
              </div>
              {n.trafico_id && (
                <div style={{ ...MONO, fontSize: 'var(--aguila-fs-label)', color: '#64748b', marginTop: 2 }}>
                  {n.trafico_id}
                </div>
              )}
            </div>
            {n.created_at && (
              <span style={{ ...MONO, fontSize: 'var(--aguila-fs-meta)', color: '#64748b', flexShrink: 0 }}>
                {fmtDateTime(n.created_at)}
              </span>
            )}
          </div>
        )
        return n.trafico_id ? (
          <Link
            key={n.id}
            href={`/embarques/${encodeURIComponent(n.trafico_id)}/trace`}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            {content}
          </Link>
        ) : (
          <div key={n.id}>{content}</div>
        )
      })}
    </GlassCard>
  )
}

// ── Empty state ───────────────────────────────────────────────

function EmptyCard({
  icon, title, subtitle,
}: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <GlassCard
      padding="40px 24px"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 10,
      }}
    >
      {icon}
      <div style={{ fontSize: 'var(--aguila-fs-section)', color: '#94a3b8', fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 'var(--aguila-fs-compact)', color: '#64748b', textAlign: 'center', maxWidth: 360 }}>
        {subtitle}
      </div>
    </GlassCard>
  )
}
