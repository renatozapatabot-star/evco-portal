'use client'

import Link from 'next/link'
import {
  Package, Truck, FileText, ClipboardList,
  FileSpreadsheet, FolderOpen, BarChart3, TrendingUp,
  AlertTriangle, Activity, Brain, ArrowRight,
  Clock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ClientData } from '@/components/cockpit/shared/fetchCockpitData'
import { fmtDateTime } from '@/lib/format-utils'

// ── Tile config ────────────────────────────────────────────

interface NavTile {
  href: string
  label: string
  icon: LucideIcon
  description: string
  dataKey?: keyof ClientData | 'catalog'
}

const TILES: NavTile[] = [
  { href: '/entradas',    label: 'Entradas',              icon: Package,         description: 'Mercancía recibida',        dataKey: 'entradasThisWeek' },
  { href: '/traficos',    label: 'Tráficos',              icon: Truck,           description: 'Operaciones activas',       dataKey: 'activeShipments' },
  { href: '/pedimentos',  label: 'Pedimentos',            icon: FileText,        description: 'Declaraciones aduanales',   dataKey: 'pedimentosEnProceso' },
  { href: '/catalogo',    label: 'Catálogo de Partes',    icon: ClipboardList,   description: 'Productos y fracciones',    dataKey: 'catalog' },
  { href: '/anexo24',     label: 'Anexo 24',              icon: FileSpreadsheet, description: 'Control de inventarios' },
  { href: '/expedientes', label: 'Expedientes Digitales', icon: FolderOpen,      description: 'Documentos por operación' },
  { href: '/reportes',    label: 'Reportes',              icon: BarChart3,       description: 'Análisis y estadísticas' },
  { href: '/kpis',        label: "KPI's",                 icon: TrendingUp,      description: 'Indicadores clave' },
]

// ── Status dot color ───────────────────────────────────────

function statusColor(level: ClientData['statusLevel']): string {
  if (level === 'red') return '#EF4444'
  if (level === 'amber') return '#FBBF24'
  return '#22C55E'
}

// ── Helpers ────────────────────────────────────────────────

function tileCount(tile: NavTile, data: ClientData): number | null {
  if (!tile.dataKey || tile.dataKey === 'catalog') return null
  const val = data[tile.dataKey]
  return typeof val === 'number' ? val : null
}

const statusIcons: Record<string, string> = {
  'En Proceso': '⏳',
  'Documentacion': '📋',
  'En Aduana': '🏛',
  'Pedimento Pagado': '✅',
  'Cruzado': '✅',
}

// ── Component ──────────────────────────────────────────────

export function ClientHome({ companyName, data }: { companyName?: string; data: ClientData }) {
  const hasAtRisk = data.atRiskShipments.length > 0
  const hasActivity = data.recentActivity.length > 0

  return (
    <div style={{ padding: '8px 0', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── 1. STATUS HERO + KPI STRIP ─────────────────── */}
      <div style={{ marginBottom: 16 }}>
        {/* Status header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: statusColor(data.statusLevel),
            boxShadow: `0 0 8px ${statusColor(data.statusLevel)}`,
            flexShrink: 0,
          }} />
          <div>
            <h1 style={{
              fontSize: 22, fontWeight: 800, color: '#E6EDF3',
              margin: 0, letterSpacing: '-0.02em',
            }}>
              {companyName || 'Portal'}
            </h1>
            <p style={{
              fontSize: 14, color: '#94a3b8', marginTop: 2, fontWeight: 500,
            }}>
              {data.statusSentence}
            </p>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="kpi-strip" style={{
          display: 'grid',
          gap: 12,
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '16px 20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          <KPIItem label="En proceso" value={data.activeShipments} color="#00E5FF" />
          <KPIItem label="Entradas esta semana" value={data.entradasThisWeek} />
          <KPIItem label="Cruzados este mes" value={data.cruzadosThisMonth} color="#22C55E" />
          <KPIItem label="Pedimentos en trámite" value={data.pedimentosEnProceso} />
        </div>
      </div>

      {/* ── 2. PRIORITY STRIP (conditional) ────────────── */}
      {hasAtRisk && (
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: 20,
          padding: '16px 20px',
          marginBottom: 16,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="#FBBF24" />
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#FBBF24',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Requieren atención ({data.atRiskShipments.length})
              </span>
            </div>
            <Link href="/traficos" style={{
              fontSize: 12, color: '#94a3b8', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div className="priority-list" style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
            {data.atRiskShipments.map((s) => (
              <Link
                key={s.id}
                href={`/traficos/${s.id}`}
                style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0 }}
              >
                <div className="priority-card" style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 14,
                  padding: '12px 16px',
                  minWidth: 220,
                  transition: 'all 200ms ease',
                }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: '#E6EDF3',
                    fontFamily: 'var(--font-jetbrains-mono)',
                  }}>
                    {s.trafico}
                  </div>
                  <div style={{
                    fontSize: 12, color: '#64748b', marginTop: 4,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: 200,
                  }}>
                    {s.description || s.status}
                  </div>
                  <div style={{
                    fontSize: 11, color: '#FBBF24', marginTop: 6,
                    fontFamily: 'var(--font-jetbrains-mono)',
                  }}>
                    {s.daysActive} días activo
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 3 + 4. SMART NAV CARDS + ACTIVITY FEED ─────── */}
      <div className="main-grid" style={{ display: 'grid', gap: 16, marginBottom: 16 }}>

        {/* Smart Nav Cards */}
        <div className="nav-cards-grid" style={{ display: 'grid', gap: 12 }}>
          {TILES.map((tile) => {
            const count = tileCount(tile, data)
            return (
              <Link
                key={tile.href}
                href={tile.href}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
              >
                <div className="smart-nav-card" style={{
                  background: 'rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 20,
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  width: '100%',
                  minHeight: 60,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(0,229,255,0.12)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: 'rgba(0,229,255,0.08)',
                    border: '1px solid rgba(0,229,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <tile.icon size={20} color="#00E5FF" strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.3,
                    }}>
                      {tile.label}
                    </div>
                    <div style={{
                      fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4,
                    }}>
                      {tile.description}
                    </div>
                  </div>
                  {count !== null && (
                    <div style={{
                      fontFamily: 'var(--font-jetbrains-mono)',
                      fontSize: 22, fontWeight: 800,
                      color: count > 0 ? '#E6EDF3' : '#475569',
                      flexShrink: 0,
                    }}>
                      {count}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {/* Activity Feed */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '16px 20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
          minHeight: 200,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          }}>
            <Activity size={14} color="#00E5FF" />
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Actividad reciente
            </span>
            {hasActivity && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#22C55E', boxShadow: '0 0 6px #22C55E',
                marginLeft: 4,
              }} />
            )}
          </div>

          {hasActivity ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.recentActivity.map((event, i) => (
                <div key={`${event.trafico}-${i}`} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 0',
                  borderBottom: i < data.recentActivity.length - 1
                    ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                    {statusIcons[event.estatus] || '📦'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontFamily: 'var(--font-jetbrains-mono)',
                        fontSize: 13, fontWeight: 600, color: '#E6EDF3',
                      }}>
                        {event.trafico}
                      </span>
                      <span style={{
                        fontSize: 11, color: '#64748b',
                      }}>
                        → {event.estatus}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 11, color: '#475569', marginTop: 2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {event.description}
                    </div>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-jetbrains-mono)',
                    fontSize: 10, color: '#475569', flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    {fmtDateTime(event.updated_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '32px 16px', gap: 8,
            }}>
              <Clock size={28} color="#475569" />
              <span style={{ fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                Sin actividad reciente
              </span>
              <span style={{ fontSize: 11, color: '#475569', textAlign: 'center' }}>
                Las actualizaciones de sus operaciones aparecerán aquí
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. INTELLIGENCE PANEL ──────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '16px 20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={14} color="#00E5FF" />
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              ADUANA Inteligencia
            </span>
          </div>
          <Link href="/aduana" style={{
            fontSize: 12, color: '#eab308', textDecoration: 'none',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 14px', borderRadius: 8,
            background: 'rgba(234,179,8,0.1)',
            border: '1px solid rgba(234,179,8,0.2)',
            minHeight: 36,
          }}>
            Pregunta a ADUANA <ArrowRight size={12} />
          </Link>
        </div>
        <p style={{
          fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: 0,
        }}>
          {data.activeShipments > 0 ? (
            <>
              {data.activeShipments} operación{data.activeShipments !== 1 ? 'es' : ''} en proceso
              {data.cruzadosThisMonth > 0 && (
                <>, {data.cruzadosThisMonth} cruzado{data.cruzadosThisMonth !== 1 ? 's' : ''} este mes</>
              )}
              {data.entradasThisWeek > 0 && (
                <>, {data.entradasThisWeek} entrada{data.entradasThisWeek !== 1 ? 's' : ''} esta semana</>
              )}
              .
            </>
          ) : (
            'ADUANA está lista para responder sus preguntas sobre operaciones aduaneras.'
          )}
        </p>
      </div>

      {/* ── Responsive styles ──────────────────────────── */}
      <style>{`
        /* KPI Strip: 4 columns */
        .kpi-strip {
          grid-template-columns: repeat(4, 1fr);
        }

        /* Main grid: cards + activity side by side */
        .main-grid {
          grid-template-columns: 1fr 380px;
        }

        /* Nav cards: 2x4 grid */
        .nav-cards-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        /* Smart card hover */
        .smart-nav-card:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(0,229,255,0.2) !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 30px rgba(0,229,255,0.18) !important;
          transform: translateY(-2px);
        }
        .smart-nav-card:active {
          transform: translateY(0);
        }

        /* Priority card hover */
        .priority-card:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(255,255,255,0.12) !important;
        }

        /* Hide scrollbar on priority strip */
        .priority-list {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .priority-list::-webkit-scrollbar {
          display: none;
        }

        /* Tablet */
        @media (max-width: 1024px) {
          .main-grid {
            grid-template-columns: 1fr !important;
          }
          .kpi-strip {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }

        /* Mobile */
        @media (max-width: 640px) {
          .kpi-strip {
            grid-template-columns: repeat(2, 1fr) !important;
            padding: 12px 14px !important;
          }
          .nav-cards-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .smart-nav-card {
            padding: 14px !important;
            gap: 12px !important;
          }
          .priority-list {
            flex-direction: column !important;
          }
          .priority-card {
            min-width: unset !important;
          }
        }
      `}</style>
    </div>
  )
}

// ── KPI Item ───────────────────────────────────────────────

function KPIItem({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: 'var(--font-jetbrains-mono)',
        fontSize: 28, fontWeight: 800,
        color: color || '#E6EDF3',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginTop: 4,
      }}>
        {label}
      </div>
    </div>
  )
}
