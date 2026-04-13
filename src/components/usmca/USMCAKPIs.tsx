'use client'

import { TrendingUp, ShieldCheck, AlertCircle } from 'lucide-react'
import { fmtUSDCompact } from '@/lib/format-utils'

/* ── Light tokens (DESIGN_SYSTEM.md v6) ── */
const D = {
  card: 'var(--bg-card)',
  cardBorder: 'var(--border)',
  gold: 'var(--gold)',
  goldSubtle: 'rgba(196,150,60,0.08)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  green: 'var(--success)',
  greenSubtle: 'rgba(22,163,74,0.08)',
  mono: 'var(--font-mono)',
  r: 8,
} as const

interface USMCAKPIsProps {
  loading: boolean
  savingsMonth: number
  countApplied: number
  isMobile: boolean
}

export function USMCAKPIs({ loading, savingsMonth, countApplied, isMobile }: USMCAKPIsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
      <KPICard
        icon={<TrendingUp size={20} />}
        label="Ahorro T-MEC este mes"
        value={loading ? '...' : fmtUSDCompact(savingsMonth)}
        sub="Estimado 8% sobre valor IMD"
        accent="green"
      />
      <KPICard
        icon={<ShieldCheck size={20} />}
        label="Embarques con T-MEC aplicado"
        value={loading ? '...' : String(countApplied)}
        sub="Régimen IMD activo"
        accent="gold"
      />
      <KPICard
        icon={<AlertCircle size={20} />}
        label="Elegibles sin T-MEC"
        value="\u2014"
        sub="Análisis de elegibilidad próximamente"
        accent="muted"
      />
    </div>
  )
}

/* ── KPI Card ── */
function KPICard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent: 'green' | 'gold' | 'muted'
}) {
  const accentColor = accent === 'green' ? D.green : accent === 'gold' ? D.gold : D.textMuted
  const accentBg = accent === 'green' ? D.greenSubtle : accent === 'gold' ? D.goldSubtle : 'rgba(107,107,107,0.1)'

  return (
    <div style={{
      background: D.card,
      border: `1px solid ${D.cardBorder}`,
      borderRadius: D.r,
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          background: accentBg,
          borderRadius: D.r,
          padding: 8,
          color: accentColor,
          display: 'flex',
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 13, color: D.textSec }}>{label}</span>
      </div>
      <p style={{
        fontSize: 28,
        fontWeight: 700,
        fontFamily: D.mono,
        margin: '0 0 4px',
        letterSpacing: '-0.02em',
        color: accent === 'muted' ? D.textMuted : D.text,
      }}>
        {value}
      </p>
      <p style={{ fontSize: 12, color: D.textMuted, margin: 0 }}>{sub}</p>
    </div>
  )
}
