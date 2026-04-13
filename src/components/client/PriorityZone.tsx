'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ClientData } from '@/components/cockpit/shared/fetchCockpitData'

interface Props {
  atRiskShipments: ClientData['atRiskShipments']
}

export function PriorityZone({ atRiskShipments }: Props) {
  if (atRiskShipments.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
      style={{
        background: 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(251,191,36,0.04) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(239,68,68,0.15)',
        borderRadius: 20,
        padding: '20px 24px',
        marginBottom: 16,
        boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 20px rgba(239,68,68,0.06)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} color="#FBBF24" />
          <span className="priority-pulse-dot" style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#FBBF24',
          }} />
          <span style={{
            fontSize: 12, fontWeight: 700, color: '#FBBF24',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Requieren atención ({atRiskShipments.length})
          </span>
        </div>
        <Link href="/embarques" style={{
          fontSize: 12, color: '#94a3b8', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          Ver todos <ArrowRight size={12} />
        </Link>
      </div>

      {/* Alert rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {atRiskShipments.map((s) => (
          <Link
            key={s.id}
            href={`/embarques/${s.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <motion.div
              whileHover={{ y: -1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="priority-alert-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
                minHeight: 60,
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 14, fontWeight: 700, color: '#E6EDF3',
                flexShrink: 0, minWidth: 110,
              }}>
                {s.trafico}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12, color: '#FBBF24', flexShrink: 0,
                fontWeight: 600,
              }}>
                {s.daysActive}d
              </span>
              <span style={{
                fontSize: 12, color: '#8b9ab5',
                flex: 1, minWidth: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {s.description || s.status}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600, color: '#E8EAED',
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                Revisar <ArrowRight size={12} />
              </span>
            </motion.div>
          </Link>
        ))}
      </div>

      <style>{`
        .priority-pulse-dot {
          animation: priorityPulse 2s ease-in-out infinite;
        }
        @keyframes priorityPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(251,191,36,0.6); }
          50% { opacity: 0.4; box-shadow: 0 0 2px rgba(251,191,36,0.2); }
        }
        .priority-alert-row:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(251,191,36,0.15) !important;
        }
        @media (max-width: 640px) {
          .priority-alert-row {
            flex-wrap: wrap !important;
            gap: 6px !important;
          }
        }
      `}</style>
    </motion.div>
  )
}
