'use client'

import Link from 'next/link'
import { fmtDateTime } from '@/lib/format-utils'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_CYAN, GREEN, GOLD,
} from '@/lib/design-system'
import type { DecisionRow } from './types'

interface Props {
  personalAssigned: number
  personalDone: number
  colaCount: number
  feed: DecisionRow[]
}

const DAILY_GOAL = 5

export function RightRail({ personalAssigned, personalDone, colaCount, feed }: Props) {
  const progress = Math.min(100, Math.round((personalDone / DAILY_GOAL) * 100))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Tu día */}
      <Card>
        <CardTitle>Tu día</CardTitle>
        <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
          <Metric label="Asignados" value={personalAssigned} />
          <Metric label="Resueltos hoy" value={personalDone} color={GREEN} />
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{
            height: 6,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 999,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: progress >= 100 ? GREEN : GOLD,
              transition: 'width 240ms ease',
            }} />
          </div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Meta diaria {personalDone}/{DAILY_GOAL}
          </div>
        </div>
      </Card>

      {/* Cola excepciones */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <CardTitle>Cola de excepciones</CardTitle>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 32,
              fontWeight: 800,
              color: colaCount > 0 ? GOLD : TEXT_MUTED,
              marginTop: 4,
              lineHeight: 1,
            }}>
              {colaCount}
            </div>
          </div>
          <Link
            href="/operador/cola"
            style={{ color: ACCENT_CYAN, fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Ver cola →
          </Link>
        </div>
      </Card>

      {/* Actividad */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: ACCENT_CYAN,
            boxShadow: `0 0 8px ${ACCENT_CYAN}`,
            animation: 'inicio-pulse 1.6s ease-in-out infinite',
          }} />
          <CardTitle>Última actividad</CardTitle>
        </div>
        <style>{`
          @keyframes inicio-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.85); }
          }
        `}</style>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {feed.length === 0 ? (
            <div style={{ color: TEXT_MUTED, fontSize: 12 }}>
              Aún no hay actividad registrada hoy.
            </div>
          ) : feed.map((f) => (
            <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12, color: TEXT_PRIMARY }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: ACCENT_CYAN, fontWeight: 700 }}>
                  {f.trafico || '—'}
                </span>
                <span style={{ color: TEXT_SECONDARY }}>
                  {truncate(f.decision, 56)}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TEXT_MUTED }}>
                {fmtDateTime(f.created_at)} · {f.decision_type}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: BG_CARD,
      backdropFilter: `blur(${GLASS_BLUR})`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
      border: `1px solid ${BORDER}`,
      borderRadius: 20,
      boxShadow: GLASS_SHADOW,
      padding: '18px 20px',
    }}>
      {children}
    </div>
  )
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: TEXT_SECONDARY,
    }}>
      {children}
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 28,
        fontWeight: 800,
        color: color || TEXT_PRIMARY,
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
    </div>
  )
}

function truncate(s: string | null, n: number): string {
  if (!s) return '—'
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}
