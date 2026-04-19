'use client'

import {
  Wrench, Activity, Mail, Server, Database,
  Globe, RefreshCw, CheckCircle2, XCircle,
} from 'lucide-react'
import { fmtDateTime } from '@/lib/format-utils'
import { useRouter } from 'next/navigation'

const T = {
  card: 'var(--card-bg)',
  border: 'var(--border)',
  gold: 'var(--gold)',
  goldSubtle: 'var(--gold-50, #F5F0E4)',
  goldBorder: 'rgba(184,149,63,0.25)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  green: 'var(--status-green)',
} as const

interface HeartbeatEntry {
  created_at: string
  all_ok: boolean
  pm2_ok: boolean
  supabase_ok: boolean
  vercel_ok: boolean
  sync_ok: boolean
  sync_age_hours: number | null
  details: Record<string, string>
}

interface IntelligenceStats {
  total_today: number
  by_account: Record<string, number>
}

interface BrokerToolsProps {
  heartbeat: HeartbeatEntry | null
  intelligence: IntelligenceStats | null
  isMobile: boolean
}

export function BrokerTools({ heartbeat, intelligence, isMobile }: BrokerToolsProps) {
  const router = useRouter()

  return (
    <>
      {/* Herramientas */}
      <SectionHeader icon={Wrench} title="Herramientas" />
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12, marginBottom: 32,
      }}>
        {[
          { href: '/oca', label: 'OCA Clasificación' },
          { href: '/cotizacion', label: 'Cotización' },
          { href: '/usmca', label: 'USMCA' },
          { href: '/anexo24', label: 'Anexo 24' },
          { href: '/admin', label: 'Administración' },
        ].map(tool => (
          <button
            key={tool.href}
            onClick={() => router.push(tool.href)}
            style={{
              padding: '14px 16px', borderRadius: 6,
              background: T.goldSubtle, border: `1px solid ${T.goldBorder}`,
              color: T.gold, fontSize: 'var(--aguila-fs-body)', fontWeight: 600,
              cursor: 'pointer', textAlign: 'left', minHeight: 44,
            }}
          >
            {tool.label}
          </button>
        ))}
      </div>

      {/* Email Intelligence */}
      <SectionHeader icon={Mail} title="Email Intelligence" />
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 20, marginBottom: 32,
      }}>
        {intelligence ? (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Stat label="Procesados hoy" value={intelligence.total_today.toString()} />
            {Object.entries(intelligence.by_account).map(([account, count]) => (
              <Stat key={account} label={account} value={count.toString()} />
            ))}
          </div>
        ) : (
          <EmptyInline icon={Mail} message="Sin datos de intelligence." color={T.textMuted} />
        )}
      </div>

      {/* System Health */}
      <SectionHeader icon={Activity} title="Salud del Sistema" />
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 20, marginBottom: 32,
      }}>
        {heartbeat ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: heartbeat.all_ok ? T.green : 'var(--status-red)',
              }} />
              <span style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: T.text }}>
                {heartbeat.all_ok ? 'Todo operativo' : 'Problemas detectados'}
              </span>
              <span style={{
                fontSize: 'var(--aguila-fs-meta)', color: T.textMuted, fontFamily: 'var(--font-jetbrains-mono)',
                marginLeft: 'auto',
              }}>
                {fmtDateTime(new Date(heartbeat.created_at))}
              </span>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}>
              <HealthCheck icon={Server} label="pm2" ok={heartbeat.pm2_ok} detail={heartbeat.details?.pm2} />
              <HealthCheck icon={Database} label="Supabase" ok={heartbeat.supabase_ok} detail={heartbeat.details?.supabase} />
              <HealthCheck icon={Globe} label="Vercel" ok={heartbeat.vercel_ok} detail={heartbeat.details?.vercel} />
              <HealthCheck icon={RefreshCw} label="Sync" ok={heartbeat.sync_ok} detail={heartbeat.details?.sync} />
            </div>
          </div>
        ) : (
          <EmptyInline icon={Activity} message="Sin datos de heartbeat." color={T.textMuted} />
        )}
      </div>
    </>
  )
}

/* -- Shared subcomponents -- */

function SectionHeader({ icon: Icon, title }: { icon: typeof Wrench; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Icon size={18} style={{ color: 'var(--gold)' }} />
      <h2 style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

function HealthCheck({ icon: Icon, label, ok, detail }: {
  icon: typeof Server; label: string; ok: boolean; detail?: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
      background: ok ? 'var(--portal-status-green-bg)' : 'var(--portal-status-red-bg)',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.2)' : '#FECACA'}`,
      borderRadius: 6,
    }}>
      <Icon size={16} style={{ color: ok ? '#2D8540' : '#C23B22', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {detail && (
          <div style={{
            fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-secondary)', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {detail}
          </div>
        )}
      </div>
      {ok ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} /> : <XCircle size={16} style={{ color: 'var(--danger)' }} />}
    </div>
  )
}

function EmptyInline({ icon: Icon, message, color }: {
  icon: typeof Mail; message: string; color: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      <Icon size={16} style={{ color }} />
      <span style={{ fontSize: 'var(--aguila-fs-body)', color }}>{message}</span>
    </div>
  )
}
