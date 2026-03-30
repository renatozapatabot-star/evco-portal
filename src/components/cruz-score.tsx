'use client'
import { useEffect, useRef, useState } from 'react'
import { scoreColor, scoreLabel } from '@/lib/cruz-score'

interface CruzScoreProps { score: number; size?: 'sm' | 'md' | 'lg'; showLabel?: boolean }

export function CruzScore({ score, size = 'md', showLabel = false }: CruzScoreProps) {
  const color = scoreColor(score)
  const label = scoreLabel(score)
  const dims = { sm: 32, md: 44, lg: 64 }
  const d = dims[size]
  const sw = size === 'sm' ? 3 : size === 'md' ? 3.5 : 4
  const r = (d - sw) / 2
  const circ = 2 * Math.PI * r
  const progress = (score / 100) * circ
  const fs = { sm: 11, md: 14, lg: 22 }

  // Animate stroke on mount
  const [offset, setOffset] = useState(circ)
  const [displayScore, setDisplayScore] = useState(0)
  const mounted = useRef(false)

  useEffect(() => {
    if (mounted.current) {
      setOffset(circ - progress)
      setDisplayScore(score)
      return
    }
    mounted.current = true
    const t = setTimeout(() => {
      setOffset(circ - progress)
      // Count up the number
      const duration = 600
      const start = performance.now()
      const animate = (now: number) => {
        const elapsed = now - start
        const p = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        setDisplayScore(Math.round(score * eased))
        if (p < 1) requestAnimationFrame(animate)
      }
      requestAnimationFrame(animate)
    }, 100)
    return () => clearTimeout(t)
  }, [score, circ, progress])

  return (
    <div className="cruz-score" style={{ width: d, textAlign: 'center' }}>
      <svg
        width={d} height={d} viewBox={`0 0 ${d} ${d}`}
        role="img"
        aria-label={`Score ${score} de 100 — ${label}`}
      >
        <circle cx={d/2} cy={d/2} r={r} fill="none" stroke="var(--n-100)" strokeWidth={sw} />
        <circle cx={d/2} cy={d/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${d/2} ${d/2})`}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }} />
        <text x={d/2} y={d/2} textAnchor="middle" dominantBaseline="central"
          fontSize={fs[size]} fontWeight={700} fontFamily="var(--font-ui)" fill={color}>
          {displayScore}
        </text>
      </svg>
      {showLabel && <div className="cruz-score-label" style={{ color }}>{label}</div>}
    </div>
  )
}
