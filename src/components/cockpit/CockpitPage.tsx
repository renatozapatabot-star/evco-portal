'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface CockpitPageProps {
  title: string
  subtitle?: string
  headerActions?: ReactNode
  children: ReactNode
}

/**
 * Dark cockpit page wrapper. Applies .cruz-dark theme,
 * renders title bar, and wraps children in responsive padding.
 * Use this to wrap any authenticated page content.
 */
export function CockpitPage({ title, subtitle, headerActions, children }: CockpitPageProps) {
  return (
    <div className="cruz-dark" style={{
      minHeight: '100vh',
      background: '#111111',
      color: 'var(--text-primary, #E6EDF3)',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '24px 16px',
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            gap: 16,
          }}
        >
          <div>
            <h1 style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text-primary, #E6EDF3)',
              margin: 0,
              lineHeight: 1.3,
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{
                fontSize: 13,
                color: 'var(--text-muted, #6E7681)',
                margin: '4px 0 0',
                lineHeight: 1.4,
              }}>
                {subtitle}
              </p>
            )}
          </div>
          {headerActions && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {headerActions}
            </div>
          )}
        </motion.div>

        {/* Content */}
        {children}
      </div>
    </div>
  )
}
