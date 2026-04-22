/**
 * PORTAL · /mi-cuenta — Quick Insights card (server-renderable).
 *
 * Three-tile strip + one proactive insight row. Silver-chrome only —
 * per client-accounting-ethics.md §tone, this surface never carries
 * amber/red dunning colors.
 *
 * Automation tile shows "—" when we don't yet have data
 * (automationPct === null) rather than 0, so a pre-launch tenant
 * doesn't see a false negative score.
 */
import Link from 'next/link'
import { Sparkles, TrendingUp, Truck } from 'lucide-react'
import { GlassCard, SectionHeader } from '@/components/aguila'
import type { QuickInsightsPayload } from '@/lib/mi-cuenta/quick-insights'

export interface QuickInsightsCardProps {
  insights: QuickInsightsPayload
  /** When true, renders the chat deep-link CTA (client surface). */
  showChatCta?: boolean
}

export function QuickInsightsCard({ insights, showChatCta = true }: QuickInsightsCardProps) {
  const { automationPct, shipmentsThisMonth, proactiveInsight } = insights

  return (
    <>
      <style>{`
        [data-quick-insights-grid] {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        @media (max-width: 640px) {
          [data-quick-insights-grid] { grid-template-columns: 1fr; }
        }
      `}</style>
      <GlassCard padding={20}>
        <SectionHeader title="Resumen rápido" />
        <div data-quick-insights-grid style={{ marginTop: 14 }}>
          <InsightTile
            icon={<Sparkles size={14} aria-hidden />}
            label="Automatización CRUZ"
            value={automationPct === null ? '—' : `${automationPct}%`}
            sublabel={automationPct === null ? 'Aún sin datos' : 'Últimos 30 días'}
          />
          <InsightTile
            icon={<Truck size={14} aria-hidden />}
            label="Embarques este mes"
            value={String(shipmentsThisMonth)}
            sublabel={shipmentsThisMonth === 0 ? 'Sin actividad aún' : 'América/Chicago'}
          />
          <InsightTile
            icon={<TrendingUp size={14} aria-hidden />}
            label="Tendencia"
            value={trendLabel({ automationPct, shipmentsThisMonth })}
            sublabel={trendSublabel({ automationPct, shipmentsThisMonth })}
          />
        </div>

        <div
          style={{
            marginTop: 16,
            padding: '12px 14px',
            borderRadius: 14,
            border: '1px solid rgba(192,197,206,0.12)',
            background: 'rgba(192,197,206,0.04)',
            display: 'grid',
            gridTemplateColumns: showChatCta ? 'minmax(0,1fr) auto' : '1fr',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--aguila-fs-label, 10px)',
                letterSpacing: 'var(--aguila-ls-label, 0.08em)',
                textTransform: 'uppercase',
                color: 'var(--aguila-text-muted)',
                marginBottom: 4,
              }}
            >
              CRUZ notó
            </div>
            <div
              style={{
                fontSize: 'var(--aguila-fs-body, 13px)',
                color: 'var(--aguila-text-primary)',
                lineHeight: 1.5,
              }}
            >
              {proactiveInsight.text}
            </div>
          </div>
          {showChatCta && (
            <Link
              href="/mi-cuenta/cruz"
              style={{
                padding: '8px 14px',
                borderRadius: 12,
                border: '1px solid rgba(192,197,206,0.18)',
                background: 'rgba(192,197,206,0.06)',
                color: 'var(--aguila-text-primary)',
                fontSize: 'var(--aguila-fs-compact, 11px)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                minHeight: 44,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Preguntar a CRUZ
            </Link>
          )}
        </div>
      </GlassCard>
    </>
  )
}

function trendLabel(args: { automationPct: number | null; shipmentsThisMonth: number }): string {
  if (args.automationPct !== null && args.automationPct >= 60) return 'Alta'
  if (args.shipmentsThisMonth > 0) return 'Estable'
  return 'En calma'
}

function trendSublabel(args: { automationPct: number | null; shipmentsThisMonth: number }): string {
  if (args.automationPct !== null && args.automationPct >= 60) return 'CRUZ haciendo el trabajo'
  if (args.shipmentsThisMonth > 0) return 'Cadencia normal'
  return 'Todo tranquilo'
}

function InsightTile({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sublabel: string
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        border: '1px solid rgba(192,197,206,0.12)',
        background: 'rgba(192,197,206,0.03)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--aguila-text-muted)',
          marginBottom: 8,
        }}
      >
        {icon}
        <span
          style={{
            fontSize: 'var(--aguila-fs-label, 10px)',
            letterSpacing: 'var(--aguila-ls-label, 0.08em)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono, ui-monospace)',
          fontSize: 'var(--aguila-fs-kpi-compact, 28px)',
          fontWeight: 700,
          color: 'var(--aguila-text-primary)',
          letterSpacing: 'var(--aguila-ls-tight, -0.03em)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 'var(--aguila-fs-meta, 11px)',
          color: 'var(--aguila-text-muted)',
        }}
      >
        {sublabel}
      </div>
    </div>
  )
}
