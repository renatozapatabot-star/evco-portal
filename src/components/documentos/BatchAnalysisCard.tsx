'use client'

import Link from 'next/link'
import { CheckCircle, AlertTriangle, XCircle, Link2, FileText, Sparkles } from 'lucide-react'
import { GlassCard } from '@/components/aguila'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
  ACCENT_SILVER, ACCENT_SILVER_DIM, GREEN, AMBER, RED,
} from '@/lib/design-system'

const MONO = 'var(--font-jetbrains-mono), monospace'

export interface BatchAnalysisSummary {
  total: number
  ready: number
  review: number
  missing: number
  byType: Array<{ label: string; count: number }>
  linkedTraficos: string[]
  topIssues: Array<{ message: string; count: number }>
  totalsByCurrency: Array<{ currency: string; total: number }>
}

interface Props {
  summary: BatchAnalysisSummary
  onReset?: () => void
}

function Stat({
  label, value, tone,
}: {
  label: string
  value: number | string
  tone: 'silver' | 'green' | 'amber' | 'red'
}) {
  const color = tone === 'green' ? GREEN : tone === 'amber' ? AMBER : tone === 'red' ? RED : TEXT_PRIMARY
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{
        fontSize: 'var(--aguila-fs-label, 10px)',
        letterSpacing: 'var(--aguila-ls-label, 0.08em)',
        textTransform: 'uppercase',
        color: TEXT_MUTED,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: MONO,
        fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
        fontWeight: 800,
        color,
        letterSpacing: 'var(--aguila-ls-tight, -0.03em)',
      }}>
        {value}
      </span>
    </div>
  )
}

function formatAmount(total: number, currency: string): string {
  try {
    return `${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
  } catch {
    return `${total.toFixed(2)} ${currency}`
  }
}

export function BatchAnalysisCard({ summary, onReset }: Props) {
  const { total, ready, review, missing, byType, linkedTraficos, topIssues, totalsByCurrency } = summary
  const maxTypeCount = Math.max(1, ...byType.map((t) => t.count))
  const overallTone: 'green' | 'amber' | 'red' =
    missing > 0 ? 'red' : review > 0 ? 'amber' : 'green'
  const summaryIcon = overallTone === 'green'
    ? <CheckCircle size={20} color={GREEN} aria-hidden />
    : overallTone === 'amber'
      ? <AlertTriangle size={20} color={AMBER} aria-hidden />
      : <XCircle size={20} color={RED} aria-hidden />

  return (
    <GlassCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={18} color={ACCENT_SILVER} aria-hidden />
          <h2 style={{
            margin: 0,
            fontSize: 'var(--aguila-fs-section, 14px)',
            fontWeight: 700,
            color: TEXT_PRIMARY,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            Análisis del lote
          </h2>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {summaryIcon}
            <span style={{
              fontSize: 'var(--aguila-fs-meta, 11px)',
              fontFamily: MONO,
              color: TEXT_SECONDARY,
              letterSpacing: '0.02em',
            }}>
              {overallTone === 'green' ? 'Todo listo' : overallTone === 'amber' ? 'Revisar' : 'Falta información'}
            </span>
          </span>
        </div>

        {/* Hero stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 16,
        }}>
          <Stat label="Documentos" value={total} tone="silver" />
          <Stat label="Listos" value={ready} tone={ready > 0 ? 'green' : 'silver'} />
          <Stat label="Revisar" value={review} tone={review > 0 ? 'amber' : 'silver'} />
          <Stat label="Falta" value={missing} tone={missing > 0 ? 'red' : 'silver'} />
        </div>

        {/* Per-type breakdown */}
        {byType.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              fontSize: 'var(--aguila-fs-label, 10px)',
              letterSpacing: 'var(--aguila-ls-label, 0.08em)',
              textTransform: 'uppercase',
              color: TEXT_MUTED,
            }}>
              Por tipo
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byType.map((t) => (
                <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 150, minWidth: 0, fontSize: 'var(--aguila-fs-compact)', color: TEXT_PRIMARY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <FileText size={12} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle', color: ACCENT_SILVER_DIM }} />
                    {t.label}
                  </div>
                  <div style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.04)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${(t.count / maxTypeCount) * 100}%`,
                      height: '100%',
                      background: ACCENT_SILVER,
                    }} />
                  </div>
                  <div style={{ width: 40, textAlign: 'right', fontFamily: MONO, color: ACCENT_SILVER_DIM, fontSize: 'var(--aguila-fs-compact)' }}>
                    {t.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Currency totals */}
        {totalsByCurrency.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{
              fontSize: 'var(--aguila-fs-label, 10px)',
              letterSpacing: 'var(--aguila-ls-label, 0.08em)',
              textTransform: 'uppercase',
              color: TEXT_MUTED,
            }}>
              Importe total detectado
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {totalsByCurrency.map((c) => (
                <span
                  key={c.currency}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    fontFamily: MONO,
                    fontSize: 'var(--aguila-fs-body)',
                    color: TEXT_PRIMARY,
                  }}
                >
                  {formatAmount(c.total, c.currency)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Linked traficos */}
        {linkedTraficos.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{
              fontSize: 'var(--aguila-fs-label, 10px)',
              letterSpacing: 'var(--aguila-ls-label, 0.08em)',
              textTransform: 'uppercase',
              color: TEXT_MUTED,
            }}>
              Embarques enlazados
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {linkedTraficos.map((id) => (
                <Link
                  key={id}
                  href={`/embarques/${encodeURIComponent(id)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    minHeight: 36,
                    padding: '0 12px',
                    borderRadius: 999,
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.22)',
                    color: GREEN,
                    fontSize: 'var(--aguila-fs-compact)',
                    fontFamily: MONO,
                    textDecoration: 'none',
                  }}
                >
                  <Link2 size={12} aria-hidden />
                  {id}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* Issue digest */}
        {topIssues.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{
              fontSize: 'var(--aguila-fs-label, 10px)',
              letterSpacing: 'var(--aguila-ls-label, 0.08em)',
              textTransform: 'uppercase',
              color: TEXT_MUTED,
            }}>
              Atenciones del lote
            </div>
            <ul style={{
              margin: 0,
              paddingLeft: 18,
              color: TEXT_SECONDARY,
              fontSize: 'var(--aguila-fs-body)',
              lineHeight: 1.6,
            }}>
              {topIssues.map((it, idx) => (
                <li key={idx}>
                  {it.message}
                  {it.count > 1 ? (
                    <span style={{ marginLeft: 6, fontFamily: MONO, color: AMBER }}>
                      · {it.count}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Actions */}
        {onReset ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onReset}
              style={{
                minHeight: 44,
                padding: '0 18px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: TEXT_PRIMARY,
                fontSize: 'var(--aguila-fs-body)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Nuevo lote
            </button>
          </div>
        ) : null}
      </div>
    </GlassCard>
  )
}
