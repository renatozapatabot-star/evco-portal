'use client'

import {
  Building2, AlertTriangle, FileText,
  ArrowRight, Clock, CheckCircle2,
} from 'lucide-react'

const T = {
  card: 'var(--card-bg)',
  border: 'var(--border)',
  gold: 'var(--gold)',
  text: 'var(--text-primary)',
  textMuted: 'var(--text-muted)',
  green: 'var(--status-green)',
  amber: 'var(--gold-700)',
  amberBg: 'var(--amber-50)',
  amberBorder: 'var(--amber-200)',
  red: 'var(--status-red)',
} as const

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

interface BrokerClientsProps {
  companies: Company[]
  pendientes: Pendiente[]
  isMobile: boolean
  onViewAsClient: (companyId: string) => void
}

export function BrokerClients({ companies, pendientes, isMobile, onViewAsClient }: BrokerClientsProps) {
  return (
    <>
      {/* Client Cards */}
      <SectionHeader icon={Building2} title="Clientes Activos" count={companies.length} />
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
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
              <Stat label="Tráficos" value={c.trafico_count.toString()} />
              <Stat label="Valor YTD" value={formatCurrency(c.valor_ytd)} mono />
            </div>
            <button
              onClick={() => onViewAsClient(c.company_id)}
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

      {/* Pendientes */}
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
                display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between', gap: isMobile ? 8 : 0,
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
    </>
  )
}

/* -- Shared subcomponents -- */

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
