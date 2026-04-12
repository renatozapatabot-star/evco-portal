'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface StageData {
  workflow: string
  label: string
  count: number
  href: string
}

const STAGES: { workflow: string; label: string; href: string }[] = [
  { workflow: 'intake', label: 'RECEPCIÓN', href: '/entradas' },
  { workflow: 'classify', label: 'CLASIFICACIÓN', href: '/clasificar' },
  { workflow: 'docs', label: 'DOCUMENTOS', href: '/expedientes' },
  { workflow: 'pedimento', label: 'PEDIMENTO', href: '/pedimentos' },
  { workflow: 'crossing', label: 'CRUCE', href: '/cruces' },
  { workflow: 'post_op', label: 'POST-OP', href: '/traficos' },
  { workflow: 'invoice', label: 'FACTURACIÓN', href: '/facturacion' },
]

export function PipelineFunnel() {
  const [stages, setStages] = useState<StageData[]>(STAGES.map(s => ({ ...s, count: 0 })))
  const [total, setTotal] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/data?table=workflow_events&limit=5000&gte_field=created_at&gte_value=' +
          new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
        const data = await res.json()
        const events = data.data || []

        const counts: Record<string, number> = {}
        let t = 0
        for (const e of events) {
          if (e.status === 'pending' || e.status === 'processing') {
            counts[e.workflow] = (counts[e.workflow] || 0) + 1
            t++
          }
        }

        setStages(STAGES.map(s => ({ ...s, count: counts[s.workflow] || 0 })))
        setTotal(t)
      } catch {
        // Silent — funnel stays at 0
      }
    }
    load()
  }, [])

  const maxCount = Math.max(1, ...stages.map(s => s.count))

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: '#64748b',
        }}>
          Pipeline autónomo
        </span>
        <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
          {total} en proceso
        </span>
      </div>

      <div style={{
        display: 'flex', gap: 4, alignItems: 'stretch',
      }}>
        {stages.map((stage, i) => {
          const fillPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
          const hasItems = stage.count > 0

          return (
            <Link
              key={stage.workflow}
              href={stage.href}
              style={{ flex: 1, textDecoration: 'none', display: 'block' }}
            >
              <motion.div
                whileHover={{ scale: 1.03, y: -2 }}
                className={hasItems ? 'needs-action' : ''}
                style={{
                  padding: '10px 6px',
                  borderRadius: 12,
                  background: hasItems ? 'rgba(192,197,206,0.06)' : 'rgba(9,9,11,0.75)',
                  border: `1px solid ${hasItems ? 'rgba(192,197,206,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 200ms ease',
                }}
              >
                {/* Fill bar at bottom */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                  background: 'rgba(255,255,255,0.04)',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${fillPct}%`,
                    background: 'linear-gradient(90deg, #00f0ff, #0088ff)',
                    opacity: 0.6,
                    transition: 'width 800ms ease',
                  }} />
                </div>

                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 18, fontWeight: 800,
                  color: hasItems ? '#C0C5CE' : '#64748b',
                }}>
                  {stage.count}
                </div>
                <div style={{
                  fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: hasItems ? '#94a3b8' : '#475569',
                  marginTop: 2,
                  lineHeight: 1.2,
                }}>
                  {stage.label}
                </div>

                {/* Arrow connector (except last) */}
                {i < stages.length - 1 && (
                  <div style={{
                    position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 10, color: '#475569', zIndex: 1,
                  }}>
                    →
                  </div>
                )}
              </motion.div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
