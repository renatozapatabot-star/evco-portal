'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCompanyIdCookie } from '@/lib/client-config'
import { computeAchievements, type Achievement } from '@/lib/achievements'
import { calculateTmecSavings } from '@/lib/tmec-savings'
import { fmtDateCompact } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { useIsMobile } from '@/hooks/use-mobile'
import { playSound } from '@/lib/sounds'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function LogrosPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    if (!companyId) return

    Promise.all([
      supabase.from('traficos')
        .select('trafico, estatus, pedimento, fecha_llegada, fecha_cruce, proveedores, score_reasons, regimen, importe_total')
        .eq('company_id', companyId)
        .gte('fecha_llegada', '2024-01-01')
        .order('fecha_llegada', { ascending: false })
        .limit(2000),
      supabase.from('entradas')
        .select('tiene_faltantes, mercancia_danada, fecha_llegada_mercancia')
        .eq('company_id', companyId)
        .order('fecha_llegada_mercancia', { ascending: false })
        .limit(50),
    ]).then(([trafRes, entRes]) => {
      const traficos = trafRes.data || []
      const entradas = entRes.data || []
      const tmecSavings = calculateTmecSavings(traficos)
      const computed = computeAchievements(traficos, entradas, tmecSavings)
      setAchievements(computed)

      // Play sound if new achievement earned since last visit
      const earnedIds = computed.filter(a => a.earned).map(a => a.id)
      const seenRaw = localStorage.getItem('cruz-seen-achievements')
      const seen: string[] = seenRaw ? JSON.parse(seenRaw) : []
      const newlyEarned = earnedIds.filter(id => !seen.includes(id))
      if (newlyEarned.length > 0) {
        playSound('achievement')
        localStorage.setItem('cruz-seen-achievements', JSON.stringify(earnedIds))
      }

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const earned = achievements.filter(a => a.earned)
  const locked = achievements.filter(a => !a.earned)

  return (
    <div className="page-shell" style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>Logros</h1>
      <p style={{ fontSize: 13, color: '#6B6B6B', margin: '0 0 24px' }}>
        {loading ? 'Calculando...' : `${earned.length} de ${achievements.length} obtenidos`}
      </p>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12 }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: 12 }} />
          ))}
        </div>
      ) : achievements.length === 0 ? (
        <EmptyState icon="🏆" title="Sin logros aún" description="Los logros se desbloquean conforme avancen sus operaciones." />
      ) : (
        <>
          {/* Earned */}
          {earned.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#8B6914', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Obtenidos
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 32 }}>
                {earned.map(a => (
                  <AchievementCard key={a.id} achievement={a} />
                ))}
              </div>
            </>
          )}

          {/* Locked */}
          {locked.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#9B9B9B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Por desbloquear
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12 }}>
                {locked.map(a => (
                  <AchievementCard key={a.id} achievement={a} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const { earned, icon, title, description, earnedDate, value, progress, progressLabel } = achievement

  return (
    <div
      className={earned ? 'achievement-glow' : ''}
      style={{
        padding: 16,
        borderRadius: 12,
        border: `1.5px solid ${earned ? '#C4963C' : '#E8E5E0'}`,
        background: earned ? 'rgba(196,150,60,0.04)' : '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'border-color 200ms, background 200ms',
      }}
    >
      {/* Icon */}
      <div style={{
        fontSize: 28,
        filter: earned ? 'none' : 'grayscale(1) opacity(0.4)',
        lineHeight: 1,
      }}>
        {icon}
      </div>

      {/* Title */}
      <div style={{
        fontSize: 14,
        fontWeight: 700,
        color: earned ? '#1A1A1A' : '#9B9B9B',
        lineHeight: 1.3,
      }}>
        {title}
      </div>

      {/* Description */}
      <div style={{
        fontSize: 12,
        color: earned ? '#6B6B6B' : '#C4C4C4',
        lineHeight: 1.4,
      }}>
        {description}
      </div>

      {/* Value or progress */}
      {earned && value && (
        <div style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: '#8B6914',
          marginTop: 'auto',
        }}>
          {value}
        </div>
      )}

      {earned && earnedDate && (
        <div style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: '#9B9B9B',
        }}>
          {fmtDateCompact(earnedDate)}
        </div>
      )}

      {!earned && progress !== undefined && progress > 0 && (
        <div style={{ marginTop: 'auto' }}>
          {/* Progress bar */}
          <div style={{
            height: 4,
            borderRadius: 2,
            background: '#F5F4F0',
            overflow: 'hidden',
            marginBottom: 4,
          }}>
            <div style={{
              height: '100%',
              width: `${Math.round(progress * 100)}%`,
              background: '#C4963C',
              borderRadius: 2,
              transition: 'width 500ms ease',
            }} />
          </div>
          {progressLabel && (
            <div style={{ fontSize: 10, color: '#9B9B9B', fontFamily: 'var(--font-mono)' }}>
              {progressLabel}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
