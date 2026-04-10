'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { haptic } from '@/hooks/use-haptic'
import { useCountUp } from '@/hooks/use-count-up'
import { Sparkline } from '@/components/sparkline'

export interface CardAction {
  label: string
  href: string
  primary?: boolean
}

type CardUrgency = 'red' | 'amber' | 'green' | 'neutral'

interface WorkflowCardProps {
  href: string
  label: string
  Icon: LucideIcon
  kpi: number | null
  subtitle: string
  variant: 'hero' | 'kpi' | 'uniform' | 'compact' | 'large' | 'small'
  actions: CardAction[]
  delay?: number
  spanFull?: boolean
  urgency?: CardUrgency
  cardKey?: string
  intensityClass?: string
  // Bento grid additions
  sparklineData?: number[]
  criticalItem?: string
  /** For hero card: mini table of active tráficos */
  activeItems?: { trafico: string; pedimento: string | null; estatus: string; daysOld: number }[]
  /** For hero: completion percentage */
  completionPct?: number
  /** Trend delta percentage */
  trendDelta?: number
  /** For hero empty state: cumulative stats */
  totalTraficos?: number
  totalCruzados?: number
  lastCrossingInfo?: { trafico: string; fecha: string } | null
  /** For uniform: small completion ring (0-100) */
  completionRing?: number
}

const U_BORDER = { red: 'rgba(220,38,38,0.25)', amber: 'rgba(217,119,6,0.25)', green: 'rgba(22,163,74,0.25)', neutral: 'rgba(255,255,255,0.08)' }
const U_TOP    = { red: 'rgba(220,38,38,0.7)', amber: 'rgba(217,119,6,0.6)', green: 'rgba(22,163,74,0.5)', neutral: 'rgba(201,168,76,0.4)' }
const U_SHADOW = { red: 'rgba(220,38,38,0.1)', amber: 'rgba(217,119,6,0.08)', green: 'rgba(22,163,74,0.08)', neutral: 'rgba(0,0,0,0.2)' }
const U_ICON   = { red: 'rgba(220,38,38,0.7)', amber: 'rgba(217,119,6,0.7)', green: 'rgba(22,163,74,0.7)', neutral: 'rgba(255,255,255,0.5)' }
const U_SPARK  = { red: '#DC2626', amber: '#D97706', green: '#16A34A', neutral: '#C8962E' }

function glowClass(u: CardUrgency) {
  if (u === 'red') return 'glow-red'
  if (u === 'amber') return 'glow-amber'
  if (u === 'green') return 'glow-green'
  return ''
}

// ── Animated KPI number ──
function AnimatedKpi({ value, size = 32, isUSD = false, decimals = 0 }: { value: number; size?: number; isUSD?: boolean; decimals?: number }) {
  const animated = useCountUp(value, 800, decimals)
  const formatted = decimals > 0 ? animated.toFixed(decimals) : animated.toLocaleString()
  const display = isUSD ? `$${formatted}` : formatted
  return (
    <span style={{
      fontSize: size,
      fontWeight: 800,
      fontFamily: 'var(--font-mono)',
      color: '#FFFFFF',
      lineHeight: 1,
      textShadow: '0 0 16px rgba(201,168,76,0.2)',
    }}>
      {display}
    </span>
  )
}

export function WorkflowCard({
  href, label, Icon, kpi, subtitle, variant, actions, delay = 0, spanFull,
  urgency, cardKey, intensityClass, sparklineData, criticalItem, activeItems,
  completionPct, trendDelta, totalTraficos, totalCruzados, lastCrossingInfo, completionRing,
}: WorkflowCardProps) {
  const u = urgency || 'neutral'
  const isGood = u === 'green' || u === 'neutral'
  const prefersReduced = useReducedMotion()

  // ── HERO VARIANT — full-width command center hero ──
  if (variant === 'hero') {
    const hasActive = activeItems && activeItems.length > 0
    return (
      <motion.div
        className={`cc-card hero-circuit-bg ${glowClass(u)}${intensityClass ? ` ${intensityClass}` : ''}`}
        whileHover={prefersReduced ? undefined : { scale: 1.005 }}
        whileTap={prefersReduced ? undefined : { scale: 0.995 }}
        onTapStart={() => haptic.micro()}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{
          padding: '24px 28px',
          borderRadius: 20,
          background: 'var(--bg-elevated, rgba(255,255,255,0.04))',
          border: `1px solid ${U_BORDER[u]}`,
          borderTop: `3px solid ${U_TOP[u]}`,
          boxShadow: `0 2px 16px ${U_SHADOW[u]}`,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 200,
          position: 'relative',
          animation: 'ccCountUp 300ms ease both',
        }}
      >
        {/* Status badge */}
        {isGood && (
          <div className="cc-check-badge">
            <CheckCircle2 size={14} style={{ color: '#FFFFFF' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 24, flex: 1 }}>
          {/* Left: KPI + meta */}
          <div style={{ flex: '0 0 auto', minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Icon size={24} strokeWidth={1.5} style={{ color: U_ICON[u] }} />
              <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>{label}</span>
            </div>

            <div style={{ marginBottom: 8 }}>
              {kpi !== null && kpi > 0 ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <AnimatedKpi value={kpi} size={48} isUSD={subtitle.includes('USD')} />
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                    {subtitle.includes('USD') ? subtitle.replace('USD ', '') : subtitle}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: 16, color: 'rgba(22,163,74,0.7)', fontWeight: 600 }}>
                  {subtitle}
                </span>
              )}
            </div>

            {/* Trend arrow */}
            {trendDelta !== undefined && trendDelta !== 0 && (
              <span className="font-mono" style={{
                fontSize: 12, fontWeight: 600,
                color: trendDelta > 0 ? '#16A34A' : '#DC2626',
              }}>
                {trendDelta > 0 ? '↑' : '↓'}{Math.abs(Math.round(trendDelta))}%
                <span style={{ color: '#6E7681', fontWeight: 400, marginLeft: 4, fontFamily: 'var(--font-geist-sans)' }}>vs semana pasada</span>
              </span>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {actions.map(action => (
                <Link key={action.label} href={action.href} style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center',
                  ...(action.primary
                    ? { background: 'var(--gold, #eab308)', color: '#1A1A1A' }
                    : { background: 'transparent', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)' }),
                }}>
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: Mini table of active tráficos */}
          <div style={{ flex: 1, minWidth: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6E7681', marginBottom: 8 }}>
              {hasActive ? 'En tránsito ahora' : 'Último cruce'}
            </div>
            {hasActive ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeItems.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#E6EDF3' }}>
                      {item.pedimento || item.trafico}
                    </span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#8B949E' }}>{item.estatus}</span>
                      <span style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: item.daysOld > 5 ? 'rgba(220,38,38,0.15)' : item.daysOld > 2 ? 'rgba(217,119,6,0.12)' : 'rgba(255,255,255,0.06)',
                        color: item.daysOld > 5 ? '#DC2626' : item.daysOld > 2 ? '#D97706' : '#8B949E',
                      }}>
                        {item.daysOld}d
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} style={{ color: '#0D9488' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0D9488' }}>Todo al corriente</span>
                </div>
                {(totalTraficos ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#8B949E' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E6EDF3' }}>{totalTraficos?.toLocaleString()}</span> operaciones desde 2024
                    </span>
                    {(totalCruzados ?? 0) > 0 && (
                      <span style={{ fontSize: 12, color: '#8B949E' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E6EDF3' }}>{totalCruzados?.toLocaleString()}</span> cruces completados
                      </span>
                    )}
                  </div>
                )}
                {lastCrossingInfo && (
                  <div style={{ fontSize: 11, color: '#6E7681', marginTop: 4 }}>
                    Último: <span style={{ fontFamily: 'var(--font-mono)', color: '#8B949E' }}>{lastCrossingInfo.trafico}</span>
                  </div>
                )}
              </div>
            )}

            {/* Sparkline at bottom-right */}
            {sparklineData && sparklineData.length >= 2 && (
              <div style={{ marginTop: 12, opacity: 0.7 }}>
                <Sparkline data={sparklineData} width={120} height={32} color={U_SPARK[u]} />
              </div>
            )}
          </div>
        </div>

        {/* Completion progress bar */}
        {completionPct !== undefined && (
          <div style={{ marginTop: 16, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${Math.min(completionPct, 100)}%`,
              background: completionPct >= 100 ? '#16A34A' : 'var(--gold, #eab308)',
              transition: 'width 800ms ease',
            }} />
          </div>
        )}
      </motion.div>
    )
  }

  // ── KPI VARIANT — compact strip cell ──
  if (variant === 'kpi') {
    const isExchangeRate = label === 'T/C'
    const isUSD = !isExchangeRate && subtitle.includes('USD')
    const isDecimal = isExchangeRate || (kpi !== null && kpi > 0 && kpi < 100 && kpi % 1 !== 0)
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
        <motion.div
          className="cc-card"
          whileHover={prefersReduced ? undefined : { scale: 1.02, borderColor: 'rgba(255,255,255,0.15)' }}
          whileTap={prefersReduced ? undefined : { scale: 0.97 }}
          onTapStart={() => haptic.micro()}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            padding: '16px 20px 10px',
            borderRadius: 20,
            background: 'var(--bg-elevated, rgba(255,255,255,0.04))',
            border: '1px solid var(--border-card, #334155)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            animation: 'ccCountUp 300ms ease both',
            animationDelay: `${delay}ms`,
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6E7681', marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              {kpi !== null && kpi > 0 ? (
                <AnimatedKpi value={kpi} size={22} isUSD={isUSD} decimals={isDecimal ? 2 : 0} />
              ) : (
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>N/D</span>
              )}
              {trendDelta !== undefined && trendDelta !== 0 && (
                <span className="font-mono" style={{
                  fontSize: 10, fontWeight: 700,
                  color: trendDelta > 0 ? '#16A34A' : '#DC2626',
                }}>
                  {trendDelta > 0 ? '↑' : '↓'}{Math.abs(Math.round(trendDelta))}%
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#6E7681', marginTop: 2 }}>{subtitle}</div>
          </div>
          {/* Blue gradient progress bar at bottom */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
            borderRadius: '0 0 20px 20px', overflow: 'hidden',
            background: 'rgba(255,255,255,0.04)',
          }}>
            <div style={{
              height: '100%',
              width: kpi !== null && kpi > 0 ? `${Math.min(100, Math.max(15, (kpi / (kpi * 1.5)) * 100))}%` : '0%',
              background: 'linear-gradient(90deg, #00f0ff, #0088ff)',
              opacity: 0.4,
              borderRadius: '0 2px 2px 0',
              transition: 'width 800ms ease',
            }} />
          </div>
        </motion.div>
      </Link>
    )
  }

  // ── COMPACT VARIANT — reference row cells ──
  if (variant === 'compact') {
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
        <motion.div
          className="cc-card"
          whileHover={prefersReduced ? undefined : { scale: 1.02, borderColor: 'rgba(255,255,255,0.12)' }}
          whileTap={prefersReduced ? undefined : { scale: 0.97 }}
          onTapStart={() => haptic.micro()}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            padding: '14px 16px',
            borderRadius: 10,
            background: 'var(--bg-elevated, rgba(255,255,255,0.04))',
            border: '1px solid rgba(255,255,255,0.05)',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            animation: 'ccCountUp 300ms ease both',
            animationDelay: `${delay}ms`,
          }}
        >
          <Icon size={18} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>{label}</div>
            <div style={{ fontSize: 10, color: '#6E7681', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
          </div>
        </motion.div>
      </Link>
    )
  }

  // ── UNIFORM VARIANT — action cards (Tier 3) ──
  if (variant === 'uniform') {
    const hasData = kpi !== null && kpi > 0
    const isFormatUSD = subtitle.includes('USD')

    return (
      <motion.div
        className={`cc-card ${glowClass(u)}${intensityClass ? ` ${intensityClass}` : ''}`}
        whileHover={prefersReduced ? undefined : { scale: 1.015, boxShadow: `0 4px 20px ${U_SHADOW[u]}` }}
        whileTap={prefersReduced ? undefined : { scale: 0.97 }}
        onTapStart={() => haptic.micro()}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{
          padding: '20px 20px',
          borderRadius: 20,
          background: 'var(--bg-elevated, rgba(255,255,255,0.04))',
          border: `1px solid ${U_BORDER[u]}`,
          borderTop: `3px solid ${U_TOP[u]}`,
          boxShadow: `0 2px 12px ${U_SHADOW[u]}`,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 180,
          animation: `ccCountUp 300ms ease both`,
          animationDelay: `${delay}ms`,
          position: 'relative',
          opacity: isGood && !hasData ? 0.85 : 1,
          ...(spanFull ? { gridColumn: '1 / -1' } : {}),
        }}
      >
        {/* Status indicator */}
        {isGood && (
          <div className="cc-check-badge">
            <CheckCircle2 size={14} style={{ color: '#FFFFFF' }} />
          </div>
        )}

        {/* Sparkline or completion ring in top-right */}
        {completionRing !== undefined ? (
          <div style={{ position: 'absolute', top: 12, right: 12 }}>
            <svg width={36} height={36} style={{ flexShrink: 0 }}>
              <circle cx={18} cy={18} r={15} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
              <circle cx={18} cy={18} r={15} fill="none"
                stroke={completionRing >= 90 ? '#16A34A' : 'var(--gold, #eab308)'}
                strokeWidth={3} strokeDasharray={2 * Math.PI * 15}
                strokeDashoffset={2 * Math.PI * 15 * (1 - Math.min(completionRing, 100) / 100)}
                strokeLinecap="round"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 800ms ease' }} />
              <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
                style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', fill: '#E6EDF3' }}>
                {completionRing}%
              </text>
            </svg>
          </div>
        ) : sparklineData && sparklineData.length >= 2 ? (
          <div style={{ position: 'absolute', top: 14, right: 14, opacity: 0.6 }}>
            <Sparkline data={sparklineData} width={64} height={24} color={U_SPARK[u]} />
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Icon size={22} strokeWidth={1.5} style={{ color: U_ICON[u] }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>{label}</span>
        </div>

        <div style={{ marginBottom: criticalItem ? 4 : 16, minHeight: 40 }}>
          {hasData ? (
            <>
              <AnimatedKpi value={kpi} size={isFormatUSD ? 26 : 32} isUSD={isFormatUSD} />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>
                {isFormatUSD ? subtitle.replace('USD ', '') : subtitle}
              </span>
            </>
          ) : (
            <span style={{
              fontSize: 14,
              color: isGood ? 'rgba(22,163,74,0.7)' : 'rgba(255,255,255,0.4)',
              fontWeight: 600,
            }}>
              {subtitle}
            </span>
          )}
        </div>

        {/* Critical item — info scent */}
        {criticalItem && (
          <div style={{
            fontSize: 11, color: '#6E7681', fontFamily: 'var(--font-mono)',
            marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {criticalItem}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
          {actions.map(action => (
            <Link key={action.label} href={action.href} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center',
              ...(action.primary
                ? { background: 'var(--gold, #eab308)', color: '#1A1A1A', border: 'none' }
                : { background: 'transparent', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)' }),
            }}>
              {action.label}
            </Link>
          ))}
        </div>
      </motion.div>
    )
  }

  // ── LARGE VARIANT (legacy) ──
  if (variant === 'large') {
    return (
      <div className="cc-card" style={{
        padding: '24px 28px', borderRadius: 16,
        background: 'var(--bg-elevated, rgba(255,255,255,0.04))',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        animation: `ccCountUp 300ms ease both`, animationDelay: `${delay}ms`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Icon size={24} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.6)' }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>{label}</span>
        </div>
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 40, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFFFFF', lineHeight: 1 }}>{kpi ?? 0}</span>
          <span style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginLeft: 10 }}>{subtitle}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {actions.map(a => (
            <Link key={a.label} href={a.href} className="cc-card" style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center',
              ...(a.primary ? { background: 'var(--gold, #eab308)', color: '#1A1A1A' } : { background: 'transparent', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.25)' }),
            }}>{a.label}</Link>
          ))}
        </div>
      </div>
    )
  }

  // ── SMALL CARD (legacy) ──
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block', animation: `ccCountUp 300ms ease both`, animationDelay: `${delay}ms`, ...(spanFull ? { gridColumn: '1 / -1' } : {}) }}>
      <div className="cc-card" style={{
        padding: '20px 16px', borderRadius: 20, background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', color: '#1A1A1A', display: 'flex', flexDirection: 'column', minHeight: 160, height: '100%', cursor: 'pointer', position: 'relative',
      }}>
        {isGood && <div className="cc-check-badge"><CheckCircle2 size={14} style={{ color: '#FFFFFF' }} /></div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={24} strokeWidth={1.5} style={{ color: '#6B6B6B' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{label}</span>
        </div>
        <div style={{ fontSize: 13, color: '#6B6B6B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
          {kpi !== null && kpi > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{kpi} </span>}
          <span>{subtitle}</span>
        </div>
        {actions[0] && (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 16px', borderRadius: 8, background: 'var(--gold, #eab308)', color: '#1A1A1A', fontSize: 12, fontWeight: 700, marginTop: 'auto', alignSelf: 'flex-start' }}>
            {actions[0].label}
          </span>
        )}
      </div>
    </Link>
  )
}
