'use client'

import { ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import { fmtUSDCompact } from '@/lib/format-utils'
import { countryFlag } from '@/lib/carrier-names'
import { EmptyState } from '@/components/ui/EmptyState'
import { SupplierDetail } from './SupplierDetail'
import type { SupplierAgg } from './SupplierDetail'

const T = {
  surface: 'var(--bg-card)',
  surfaceHover: 'var(--portal-ink-2)',
  surfaceActive: '#EEEDE8',
  border: 'var(--border)',
  text: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  gold: 'var(--gold)',
  goldSubtle: 'rgba(196,150,60,0.08)',
  goldBorder: 'rgba(196,150,60,0.25)',
  green: 'var(--success)',
  red: 'var(--danger-500)',
  mono: 'var(--font-jetbrains-mono)',
} as const

function RiskBadge({ level }: { level: SupplierAgg['riskLevel'] }) {
  const bg = level === 'high' ? 'rgba(220,38,38,0.1)' : level === 'medium' ? 'rgba(217,119,6,0.1)' : level === 'watch' ? 'rgba(37,99,235,0.1)' : 'rgba(22,163,74,0.1)'
  const color = level === 'high' ? 'var(--danger-500)' : level === 'medium' ? 'var(--warning-500, #D97706)' : level === 'watch' ? 'var(--info)' : 'var(--success)'
  const label = level === 'high' ? 'ALTO' : level === 'medium' ? 'MED' : level === 'watch' ? 'NUEVO' : 'OK'
  return (
    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 9999, background: bg, color }}>
      {label}
    </span>
  )
}

interface SupplierTableProps {
  filtered: SupplierAgg[]
  expandedSupplier: string | null
  onToggleExpand: (name: string | null) => void
  isMobile: boolean
  search: string
  loading: boolean
}

export function SupplierTable({ filtered, expandedSupplier, onToggleExpand, isMobile, search, loading }: SupplierTableProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ height: 48, background: T.surface, borderRadius: i === 0 ? '8px 8px 0 0' : i === 9 ? '0 0 8px 8px' : 0 }} />
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 48 }}>
        <EmptyState
          icon="🏭"
          title={search ? `Sin resultados para "${search}"` : 'Sin datos de proveedores'}
          description={search ? 'Intenta con otro termino' : 'Los proveedores se extraen del campo proveedores de cada trafico'}
        />
      </div>
    )
  }

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
      {isMobile ? (
        <MobileCards filtered={filtered} expandedSupplier={expandedSupplier} onToggleExpand={onToggleExpand} />
      ) : (
        <DesktopTable filtered={filtered} expandedSupplier={expandedSupplier} onToggleExpand={onToggleExpand} />
      )}
    </div>
  )
}

function MobileCards({ filtered, expandedSupplier, onToggleExpand }: {
  filtered: SupplierAgg[]
  expandedSupplier: string | null
  onToggleExpand: (name: string | null) => void
}) {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {filtered.map((s, idx) => {
        const isExpanded = expandedSupplier === s.name
        return (
          <div key={s.name}>
            <div
              onClick={() => onToggleExpand(isExpanded ? null : s.name)}
              style={{
                background: isExpanded ? T.surfaceActive : T.surface,
                border: `1px solid ${T.border}`, borderRadius: 8,
                padding: '12px 14px', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ color: T.textMuted }}>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: T.goldSubtle, border: `1px solid ${T.goldBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Building2 size={14} style={{ color: T.gold }} />
                </div>
                <span style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {s.name}
                </span>
                {s.country && <span style={{ fontSize: 'var(--aguila-fs-body-lg)' }}>{countryFlag(s.country)}</span>}
                {idx < 3 && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 9999, background: T.goldSubtle, color: T.gold, border: `1px solid ${T.goldBorder}`, flexShrink: 0 }}>
                    TOP {idx + 1}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginLeft: 22 }}>
                <div>
                  <div style={{ fontSize: 'var(--aguila-fs-label)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Embarques</div>
                  <div style={{ fontFamily: T.mono, fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: T.text }}>{s.traficoCount}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--aguila-fs-label)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valor</div>
                  <div style={{ fontFamily: T.mono, fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: T.green }}>{s.totalValue > 0 ? fmtUSDCompact(s.totalValue) : '\u2014'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--aguila-fs-label)', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Riesgo</div>
                  <RiskBadge level={s.riskLevel} />
                </div>
              </div>
            </div>
            {isExpanded && <SupplierDetail supplier={s} />}
          </div>
        )
      })}
    </div>
  )
}

function DesktopTable({ filtered, expandedSupplier, onToggleExpand }: {
  filtered: SupplierAgg[]
  expandedSupplier: string | null
  onToggleExpand: (name: string | null) => void
}) {
  return (
    <>
      {/* Header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 80px 120px 70px 60px 60px 50px',
        padding: '10px 16px',
        borderBottom: `1px solid ${T.border}`,
        fontSize: 'var(--aguila-fs-label)', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: T.textMuted,
      }}>
        <span />
        <span>Proveedor</span>
        <span style={{ textAlign: 'right' }}>Embarques</span>
        <span style={{ textAlign: 'right' }}>Valor</span>
        <span style={{ textAlign: 'right' }}>Docs %</span>
        <span style={{ textAlign: 'right' }}>T-MEC</span>
        <span style={{ textAlign: 'center' }}>Riesgo</span>
        <span style={{ textAlign: 'center' }}>País</span>
      </div>

      {/* Rows */}
      {filtered.map((s, idx) => {
        const isExpanded = expandedSupplier === s.name
        return (
          <div key={s.name}>
            <div
              onClick={() => onToggleExpand(isExpanded ? null : s.name)}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 80px 120px 70px 60px 60px 50px',
                padding: '12px 16px',
                alignItems: 'center',
                borderBottom: `1px solid ${T.border}`,
                cursor: 'pointer',
                background: isExpanded ? T.surfaceActive : 'transparent',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = T.surfaceHover }}
              onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ color: T.textMuted }}>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: T.goldSubtle, border: `1px solid ${T.goldBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Building2 size={14} style={{ color: T.gold }} />
                </div>
                <span title={s.name} style={{
                  fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: T.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s.name}
                </span>
                {idx < 3 && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 9999,
                    background: T.goldSubtle, color: T.gold, border: `1px solid ${T.goldBorder}`,
                    flexShrink: 0,
                  }}>
                    TOP {idx + 1}
                  </span>
                )}
              </div>
              <span style={{ textAlign: 'right', fontFamily: T.mono, fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: T.text }}>
                {s.traficoCount}
              </span>
              <span style={{ textAlign: 'right', fontFamily: T.mono, fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, color: T.green }}>
                {s.totalValue > 0 ? fmtUSDCompact(s.totalValue) : <span style={{ color: T.textMuted }}>{'\u2014'}</span>}
              </span>
              <span style={{ textAlign: 'right', fontFamily: T.mono, fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, color: s.docCompliance >= 90 ? T.green : s.docCompliance >= 70 ? 'var(--warning-500, #D97706)' : T.red }}>
                {s.docCompliance}%
              </span>
              <span style={{ textAlign: 'right', fontFamily: T.mono, fontSize: 'var(--aguila-fs-compact)', color: s.tmecRate > 0 ? T.green : T.textMuted }}>
                {s.tmecRate > 0 ? `${s.tmecRate}%` : '\u2014'}
              </span>
              <span style={{ textAlign: 'center' }}>
                <RiskBadge level={s.riskLevel} />
              </span>
              <span style={{ textAlign: 'center', fontSize: 'var(--aguila-fs-body-lg)' }}>
                {s.country ? countryFlag(s.country) : '\uD83C\uDF10'}
              </span>
            </div>

            {isExpanded && <SupplierDetail supplier={s} />}
          </div>
        )
      })}
    </>
  )
}
