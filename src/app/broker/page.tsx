'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, AlertTriangle, FileText, Wrench,
  Activity, Mail, ArrowRight, Clock, CheckCircle2,
  XCircle, Server, Database, Globe, RefreshCw,
} from 'lucide-react'
import { fmtDateTime } from '@/lib/format-utils'

/* ── Types ─────────────────────────────────────────────────── */

interface Company {
  company_id: string
  name: string
  clave_cliente: string
  trafico_count: number
  valor_ytd: number
}

interface Pendiente {
  company_name: string
  company_id: string
  solicitudes_vencidas: number
  entradas_sin_trafico: number
}

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

/* ── Design tokens (matching TopNav v6) ────────────────────── */

const T = {
  bg: '#FAFAF8',
  card: 'var(--card-bg)',
  border: '#E8E5E0',
  gold: '#C4963C',
  goldSubtle: '#F5F0E4',
  goldBorder: 'rgba(184,149,63,0.25)',
  text: '#1A1A1A',
  textSec: '#6B6B6B',
  textMuted: '#9B9B9B',
  green: '#2D8540',
  greenBg: '#F0FDF4',
  greenBorder: '#BBF7D0',
  amber: '#C47F17',
  amberBg: '#FFFBEB',
  amberBorder: '#FDE68A',
  red: '#C23B22',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
  navBg: '#1A1814',
  navText: '#EAE6DC',
  navMuted: '#7C7870',
} as const

/* ── Broker page ───────────────────────────────────────────── */

export default function BrokerCommandCenter() {
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [heartbeat, setHeartbeat] = useState<HeartbeatEntry | null>(null)
  const [intelligence, setIntelligence] = useState<IntelligenceStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Auth check
  useEffect(() => {
    const match = document.cookie.match(/(^| )user_role=([^;]+)/)
    const r = match ? match[2] : null
    setRole(r)
    if (r !== 'broker' && r !== 'admin') {
      router.replace('/')
    }
  }, [router])

  // Fetch all data
  useEffect(() => {
    if (role !== 'broker' && role !== 'admin') return
    loadData()
  }, [role])

  async function loadData() {
    setLoading(true)
    try {
      const [companiesRes, heartbeatRes, intelligenceRes] = await Promise.all([
        fetch('/api/broker/data'),
        fetch('/api/broker/data?section=heartbeat'),
        fetch('/api/broker/data?section=intelligence'),
      ])

      const companiesData = await companiesRes.json()
      const heartbeatData = await heartbeatRes.json()
      const intelligenceData = await intelligenceRes.json()

      if (companiesData.companies) setCompanies(companiesData.companies)
      if (companiesData.pendientes) setPendientes(companiesData.pendientes)
      if (heartbeatData.heartbeat) setHeartbeat(heartbeatData.heartbeat)
      if (intelligenceData.intelligence) setIntelligence(intelligenceData.intelligence)
    } catch {
      // Silent — data will show empty states
    } finally {
      setLoading(false)
    }
  }

  async function viewAsClient(companyId: string) {
    const res = await fetch('/api/auth/view-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId }),
    })
    if (res.ok) {
      router.push('/')
    }
  }

  if (role !== 'broker' && role !== 'admin') return null

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page title */}
      <h1 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 24 }}>
        Centro de Mando
      </h1>

      <div>

        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 8 }} />)}
            </div>
            {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 48, borderRadius: 4 }} />)}
          </div>
        ) : (
          <>
            {/* ── Section 1: Client Cards ─────────────────────── */}
            <SectionHeader icon={Building2} title="Clientes Activos" count={companies.length} />
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16, marginBottom: 32,
            }}>
              {companies.map(c => (
                <div key={c.company_id} style={{
                  background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{c.name}</div>
                      <div style={{
                        fontSize: 11, fontFamily: 'var(--font-jetbrains-mono)',
                        color: T.textMuted, marginTop: 2,
                      }}>
                        Clave: {c.clave_cliente}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <Stat label="Traficos" value={c.trafico_count.toString()} />
                    <Stat label="Valor YTD" value={formatCurrency(c.valor_ytd)} mono />
                  </div>
                  <button
                    onClick={() => viewAsClient(c.company_id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '10px 16px', borderRadius: 6, border: 'none',
                      background: T.gold, color: 'var(--bg-card)', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', minHeight: 44,
                    }}
                  >
                    Ver como cliente <ArrowRight size={14} />
                  </button>
                </div>
              ))}
              {companies.length === 0 && (
                <EmptyCard icon={Building2} message="No hay clientes activos con portal." />
              )}
            </div>

            {/* ── Section 2: Pendientes ───────────────────────── */}
            <SectionHeader icon={AlertTriangle} title="Pendientes" />
            <div style={{
              background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: 20, marginBottom: 32,
            }}>
              {pendientes.length === 0 ? (
                <EmptyInline icon={CheckCircle2} message="Sin pendientes urgentes." color={T.green} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {pendientes.map(p => (
                    <div key={p.company_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', background: T.amberBg, border: `1px solid ${T.amberBorder}`,
                      borderRadius: 6,
                    }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{p.company_name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                        {p.solicitudes_vencidas > 0 && (
                          <span style={{ color: T.red }}>
                            <FileText size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
                            {p.solicitudes_vencidas} solicitudes vencidas
                          </span>
                        )}
                        {p.entradas_sin_trafico > 0 && (
                          <span style={{ color: T.amber }}>
                            <Clock size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
                            {p.entradas_sin_trafico} entradas sin trafico &gt;48h
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Section 3: Herramientas ─────────────────────── */}
            <SectionHeader icon={Wrench} title="Herramientas" />
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12, marginBottom: 32,
            }}>
              {[
                { href: '/oca', label: 'OCA Clasificacion' },
                { href: '/cotizacion', label: 'Cotizacion' },
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
                    color: T.gold, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', textAlign: 'left', minHeight: 44,
                  }}
                >
                  {tool.label}
                </button>
              ))}
            </div>

            {/* ── Section 4: Intelligence ─────────────────────── */}
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

            {/* ── Section 5: System Health ────────────────────── */}
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
                      background: heartbeat.all_ok ? T.green : T.red,
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                      {heartbeat.all_ok ? 'Todo operativo' : 'Problemas detectados'}
                    </span>
                    <span style={{
                      fontSize: 11, color: T.textMuted, fontFamily: 'var(--font-jetbrains-mono)',
                      marginLeft: 'auto',
                    }}>
                      {fmtDateTime(new Date(heartbeat.created_at))}
                    </span>
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 12,
                  }}>
                    <HealthCheck
                      icon={Server} label="pm2"
                      ok={heartbeat.pm2_ok}
                      detail={heartbeat.details?.pm2}
                    />
                    <HealthCheck
                      icon={Database} label="Supabase"
                      ok={heartbeat.supabase_ok}
                      detail={heartbeat.details?.supabase}
                    />
                    <HealthCheck
                      icon={Globe} label="Vercel"
                      ok={heartbeat.vercel_ok}
                      detail={heartbeat.details?.vercel}
                    />
                    <HealthCheck
                      icon={RefreshCw} label="Sync"
                      ok={heartbeat.sync_ok}
                      detail={heartbeat.details?.sync}
                    />
                  </div>
                </div>
              ) : (
                <EmptyInline icon={Activity} message="Sin datos de heartbeat." color={T.textMuted} />
              )}
            </div>
          </>
        )}
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

/* ── Subcomponents ─────────────────────────────────────────── */

function SectionHeader({ icon: Icon, title, count }: { icon: typeof Building2; title: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Icon size={18} style={{ color: 'var(--gold)' }} />
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      {count !== undefined && (
        <span style={{
          fontSize: 11, fontWeight: 600, color: 'var(--gold)',
          background: '#F5F0E4', padding: '2px 8px', borderRadius: 9999,
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
        fontFamily: mono ? 'var(--font-jetbrains-mono)' : undefined,
      }}>
        {value}
      </div>
    </div>
  )
}

function HealthCheck({ icon: Icon, label, ok, detail }: {
  icon: typeof Server; label: string; ok: boolean; detail?: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
      background: ok ? '#F0FDF4' : '#FEF2F2',
      border: `1px solid ${ok ? '#BBF7D0' : '#FECACA'}`,
      borderRadius: 6,
    }}>
      <Icon size={16} style={{ color: ok ? '#2D8540' : '#C23B22', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {detail && (
          <div style={{
            fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden',
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

function EmptyCard({ icon: Icon, message }: { icon: typeof Building2; message: string }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8,
      padding: 32, textAlign: 'center', gridColumn: '1 / -1',
    }}>
      <Icon size={24} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>{message}</p>
    </div>
  )
}

function EmptyInline({ icon: Icon, message, color }: {
  icon: typeof Building2; message: string; color: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      <Icon size={16} style={{ color }} />
      <span style={{ fontSize: 13, color }}>{message}</span>
    </div>
  )
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}
