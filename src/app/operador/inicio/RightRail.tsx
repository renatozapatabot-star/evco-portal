'use client'

import Link from 'next/link'
import { Activity } from 'lucide-react'
import { fmtDateTime } from '@/lib/format-utils'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_CYAN, GREEN, GOLD,
} from '@/lib/design-system'
import type { DecisionRow } from './types'

interface Props {
  colaCount: number
  feed: DecisionRow[]
}

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  'En Proceso':       { bg: 'rgba(0,229,255,0.12)',  fg: ACCENT_CYAN, label: 'En proceso' },
  'Documentacion':    { bg: 'rgba(148,163,184,0.12)', fg: TEXT_SECONDARY, label: 'Documentación' },
  'En Aduana':        { bg: 'rgba(148,163,184,0.12)', fg: TEXT_SECONDARY, label: 'En aduana' },
  'Pedimento Pagado': { bg: 'rgba(34,197,94,0.12)',   fg: GREEN, label: 'Pagado' },
  'Cruzado':          { bg: 'rgba(34,197,94,0.12)',   fg: GREEN, label: 'Cruzado' },
}

function StatusPill({ label }: { label: string | null }) {
  const c = (label && STATUS_PILL[label]) || { bg: 'rgba(148,163,184,0.1)', fg: TEXT_MUTED, label: label || '—' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      padding: '2px 8px', borderRadius: 20,
      background: c.bg, color: c.fg,
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

export function RightRail({ colaCount, feed }: Props) {
  const visible = feed.slice(0, 5)
  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {/* Cola de excepciones */}
      <section style={{
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        boxShadow: GLASS_SHADOW,
        padding: '20px',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: TEXT_MUTED, margin: 0,
        }}>
          Cola de excepciones
        </div>
        <div style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: 44,
          fontWeight: 800,
          color: colaCount > 0 ? GOLD : TEXT_MUTED,
          margin: '8px 0 12px 0',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {colaCount}
        </div>
        {colaCount > 0 ? (
          <Link
            href="/operador/cola"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              padding: '10px 16px',
              borderRadius: 12,
              background: GOLD,
              color: '#0D0D0C',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
              width: '100%',
            }}
          >
            Ver cola →
          </Link>
        ) : (
          <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: 0 }}>
            Sin excepciones pendientes.
          </p>
        )}
      </section>

      {/* Actividad reciente */}
      <section style={{
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        boxShadow: GLASS_SHADOW,
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: visible.length > 0 ? 12 : 0 }}>
          <Activity size={14} color={ACCENT_CYAN} />
          <span style={{
            fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: TEXT_MUTED,
          }}>
            Actividad reciente
          </span>
          {visible.length > 0 && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: GREEN, boxShadow: `0 0 6px ${GREEN}`, marginLeft: 4,
            }} />
          )}
        </div>

        {visible.length === 0 ? (
          <div style={{ color: TEXT_MUTED, fontSize: 12, padding: '16px 0' }}>
            Aún no hay actividad registrada hoy.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {visible.map((f, i) => (
              <div key={f.id} style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: '10px 0',
                borderBottom: i < visible.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: 13, fontWeight: 700, color: ACCENT_CYAN,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}>
                    {f.trafico || '—'}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: 10, color: TEXT_MUTED, flexShrink: 0,
                  }}>
                    {fmtDateTime(f.created_at)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11, color: TEXT_SECONDARY,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, minWidth: 0,
                  }}>
                    {truncate(f.decision, 60)}
                  </span>
                  <StatusPill label={f.decision_type} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  )
}

function truncate(s: string | null, n: number): string {
  if (!s) return '—'
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}
