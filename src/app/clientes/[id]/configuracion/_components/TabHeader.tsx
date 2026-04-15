'use client'

import type { ReactNode } from 'react'
import { TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'

export function TabHeader({ title, subtitle, badge }: {
  title: string
  subtitle?: string
  badge?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 600, color: TEXT_PRIMARY }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_MUTED, maxWidth: 640 }}>
            {subtitle}
          </p>
        )}
      </div>
      {badge}
    </div>
  )
}
