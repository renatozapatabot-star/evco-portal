'use client'

import { useState, useEffect } from 'react'
import {
  Truck, FileText,
  FileSpreadsheet, FolderOpen, BarChart3, TrendingUp,
  Activity, Clock, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ClientData } from '@/components/cockpit/shared/fetchCockpitData'
import { fmtDateTime } from '@/lib/format-utils'
import { PriorityZone } from './PriorityZone'
import { SmartKPIStrip } from './SmartKPIStrip'
import { IntelligencePanel } from './IntelligencePanel'
import { SuggestedActions } from './SuggestedActions'
import { NavCardGrid, type NavCardGridItem } from '../NavCardGrid'

// ── Tile config ────────────────────────────────────────────

interface NavTile {
  href: string
  label: string
  icon: LucideIcon
  description: string
  dataKey?: keyof ClientData | 'catalog'
}

// V1 client cockpit tiles (Phase 4 cull) — only routes to V1-approved surfaces.
const TILES: NavTile[] = [
  { href: '/embarques',          label: 'Embarques',     icon: Truck,           description: 'Operaciones activas',     dataKey: 'activeShipments' },
  { href: '/pedimentos',        label: 'Pedimentos',   icon: FileText,        description: 'Declaraciones aduanales', dataKey: 'pedimentosEnProceso' },
  { href: '/reportes/anexo-24', label: 'Anexo 24',     icon: FileSpreadsheet, description: 'Control de inventarios' },
  { href: '/expedientes',       label: 'Expedientes',  icon: FolderOpen,      description: 'Documentos por operación' },
  { href: '/reportes',          label: 'Reportes',     icon: BarChart3,       description: 'Análisis y estadísticas' },
  { href: '/kpis',              label: "KPI's",        icon: TrendingUp,      description: 'Indicadores clave' },
]

// ── Helpers ────────────────────────────────────────────────

function statusColor(level: ClientData['statusLevel']): string {
  if (level === 'red') return '#EF4444'
  if (level === 'amber') return '#FBBF24'
  return '#22C55E'
}

function tileCount(tile: NavTile, data: ClientData): number | null {
  if (!tile.dataKey || tile.dataKey === 'catalog') return null
  const val = data[tile.dataKey]
  return typeof val === 'number' ? val : null
}

function tileMicroStatus(tile: NavTile, data: ClientData): { text: string; warning: boolean } | null {
  const ms = data.navMicroStatus
  switch (tile.href) {
    case '/embarques':
      if (ms.traficos.active === 0) return null
      return {
        text: `${ms.traficos.active} activos` +
          (ms.traficos.delayed > 0 ? ` · ${ms.traficos.delayed} retrasados` : '') +
          (ms.traficos.atRisk > 0 ? ` · ${ms.traficos.atRisk} en riesgo` : ''),
        warning: ms.traficos.delayed > 0 || ms.traficos.atRisk > 0,
      }
    case '/entradas':
      if (ms.entradas.thisMonth === 0 && ms.entradas.withFaltantes === 0) return null
      return {
        text: `${ms.entradas.thisMonth} este mes` +
          (ms.entradas.withFaltantes > 0 ? ` · ${ms.entradas.withFaltantes} con faltantes` : ''),
        warning: ms.entradas.withFaltantes > 0,
      }
    case '/pedimentos':
      if (ms.pedimentos.active === 0 && data.activeShipments > 0) {
        return { text: '0 activos · sin actividad', warning: true }
      }
      if (ms.pedimentos.active > 0) {
        return {
          text: `${ms.pedimentos.active} en trámite` +
            (ms.pedimentos.todayActivity ? '' : ' · sin movimiento hoy'),
          warning: !ms.pedimentos.todayActivity,
        }
      }
      return null
    default:
      return null
  }
}

const statusIcons: Record<string, string> = {
  'En Proceso': '⏳',
  'Documentacion': '📋',
  'En Aduana': '🏛',
  'Pedimento Pagado': '✅',
  'Cruzado': '✅',
}

// ── Fix 3: Display name split ─────────────────────────────

function toDisplayName(legalName: string): { display: string; suffix: string } {
  const suffixPattern = /\s*(S\.?\s*DE\s*R\.?\s*L\.?\s*(DE\s*C\.?\s*V\.?)?|S\.?\s*A\.?\s*(DE\s*C\.?\s*V\.?)?|S\.?\s*C\.?|S\.?\s*A\.?\s*P\.?\s*I\.?(\s*DE\s*C\.?\s*V\.?)?)\.?\s*$/i
  const match = legalName.match(suffixPattern)
  if (match && match.index !== undefined) {
    return {
      display: legalName.slice(0, match.index).trim(),
      suffix: match[0].trim(),
    }
  }
  return { display: legalName, suffix: '' }
}

// ── Fix 4: Activity status pills ──────────────────────────

const STATUS_PILL_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  'En Proceso':       { bg: 'rgba(192,197,206,0.12)',  text: '#C0C5CE', label: 'En proceso' },
  'Documentacion':    { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8', label: 'Documentación' },
  'En Aduana':        { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8', label: 'En aduana' },
  'Pedimento Pagado': { bg: 'rgba(34,197,94,0.12)',   text: '#22C55E', label: 'Pagado' },
  'Cruzado':          { bg: 'rgba(34,197,94,0.12)',   text: '#22C55E', label: 'Cruzado' },
}

function StatusPill({ status }: { status: string }) {
  const c = STATUS_PILL_CONFIG[status] ?? { bg: 'rgba(148,163,184,0.1)', text: '#64748b', label: status }
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      padding: '2px 8px', borderRadius: 20,
      background: c.bg, color: c.text,
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

// ── Fix 7: Live timestamp ─────────────────────────────────

function LiveTimestamp() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!now) return null

  const dateStr = now.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'America/Chicago',
  })
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Chicago',
  })

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 11, color: '#64748b', marginTop: 4,
    }}>
      {dateStr} · {timeStr} · Datos en vivo
    </div>
  )
}

// ── Component ──────────────────────────────────────────────

export function ClientHome({ companyName, data }: { companyName?: string; data: ClientData }) {
  const [activityExpanded, setActivityExpanded] = useState(false)
  const hasActivity = data.recentActivity.length > 0
  const visibleActivity = activityExpanded ? data.recentActivity : data.recentActivity.slice(0, 3)

  return (
    <div style={{ padding: '8px 0', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── 1. STATUS HERO ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: statusColor(data.statusLevel),
          boxShadow: `0 0 8px ${statusColor(data.statusLevel)}`,
          flexShrink: 0,
        }} />
        <div>
          {(() => {
            const { display, suffix } = toDisplayName(companyName || 'ZAPATA AI')
            return (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{
                  fontSize: 24, fontWeight: 800, color: '#E6EDF3',
                  margin: 0, letterSpacing: '-0.03em',
                }}>
                  {display}
                </h1>
                {suffix && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {suffix}
                  </span>
                )}
              </div>
            )
          })()}
          <p style={{
            fontSize: 14, color: '#94a3b8', marginTop: 2, fontWeight: 500,
          }}>
            {data.statusSentence}
          </p>
          <LiveTimestamp />
        </div>
      </div>

      {/* ── 2. SMART KPI STRIP ───────────────────────────── */}
      <SmartKPIStrip
        activeShipments={data.activeShipments}
        activeShipmentsYesterday={data.activeShipmentsYesterday}
        entradasThisMonth={data.entradasThisMonth}
        entradasLastWeek={data.entradasLastWeek}
        cruzadosYTD={data.cruzadosYTD}
        cruzadosLastMonth={data.cruzadosLastMonth}
        pedimentosEnProceso={data.pedimentosEnProceso}
      />

      {/* ── 3. PRIORITY ZONE ─────────────────────────────── */}
      <PriorityZone atRiskShipments={data.atRiskShipments} />

      {/* ── 4. SUGGESTED ACTIONS ─────────────────────────── */}
      <SuggestedActions suggestedActions={data.suggestedActions} />

      {/* ── 5. MAIN GRID: Nav Cards + Intelligence ───────── */}
      <div className="client-main-grid" style={{ display: 'grid', gap: 16 }}>

        {/* Left: Nav Cards */}
        <NavCardGrid
          items={TILES.map((tile): NavCardGridItem => {
            const count = tileCount(tile, data)
            const ms = tileMicroStatus(tile, data)
            return {
              tile: {
                href: tile.href,
                label: tile.label,
                icon: tile.icon,
                description: tile.description,
              },
              count,
              microStatus: ms?.text,
              microStatusWarning: ms?.warning,
            }
          })}
        />

        {/* Right: Intelligence + Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <IntelligencePanel
            computedInsights={data.computedInsights}
            activeShipments={data.activeShipments}
            cruzadosYTD={data.cruzadosYTD}
            entradasThisMonth={data.entradasThisMonth}
          />

          {/* Activity Feed (collapsible) */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            padding: '16px 20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            <button
              onClick={() => setActivityExpanded(!activityExpanded)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', background: 'none', border: 'none',
                cursor: 'pointer', padding: 0, marginBottom: hasActivity ? 12 : 0,
              }}
            >
              <Activity size={14} color="#C0C5CE" />
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
              <span style={{ marginLeft: 'auto' }}>
                {activityExpanded
                  ? <ChevronUp size={14} color="#64748b" />
                  : <ChevronDown size={14} color="#64748b" />
                }
              </span>
            </button>

            {hasActivity ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visibleActivity.map((event, i) => (
                  <div key={`${event.trafico}-${i}`} style={{
                    display: 'flex', flexDirection: 'column', gap: 4,
                    padding: '10px 0',
                    borderBottom: i < visibleActivity.length - 1
                      ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    {/* Line 1: icon + trafico ← left ... timestamp ← right */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 12, flexShrink: 0 }}>
                          {statusIcons[event.estatus] || '📦'}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13, fontWeight: 600, color: '#E6EDF3',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {event.trafico}
                        </span>
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10, color: '#64748b', flexShrink: 0, whiteSpace: 'nowrap',
                      }}>
                        {fmtDateTime(event.updated_at)}
                      </span>
                    </div>
                    {/* Line 2: description + status pill */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 20 }}>
                      <span style={{
                        fontSize: 11, color: '#64748b',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, minWidth: 0,
                      }}>
                        {event.description}
                      </span>
                      <StatusPill status={event.estatus} />
                    </div>
                  </div>
                ))}
                {!activityExpanded && data.recentActivity.length > 3 && (
                  <button
                    onClick={() => setActivityExpanded(true)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: '#C0C5CE', fontWeight: 600,
                      padding: '6px 0', textAlign: 'left',
                    }}
                  >
                    Ver {data.recentActivity.length - 3} más
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '24px 16px', gap: 8,
              }}>
                <Clock size={24} color="#475569" />
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
      </div>

      {/* ── Responsive styles ──────────────────────────── */}
      <style>{`
        .client-main-grid {
          grid-template-columns: 1fr 340px;
        }
        .nav-cards-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        @media (max-width: 1024px) {
          .client-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .nav-cards-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  )
}
