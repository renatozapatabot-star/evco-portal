'use client'

import { ACCENT_SILVER } from '@/lib/design-system'
import { TAB_ORDER, TAB_LABELS_ES, type TabId } from '@/lib/pedimento-types'

export interface TabStripProps {
  activeTab: TabId
  onChange: (tab: TabId) => void
}

export function TabStrip({ activeTab, onChange }: TabStripProps) {
  return (
    <nav
      role="tablist"
      aria-label="Secciones del pedimento"
      style={{
        display: 'flex',
        overflowX: 'auto',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'rgba(255,255,255,0.045)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {TAB_ORDER.map((tab) => {
        const isActive = tab === activeTab
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            style={{
              padding: '14px 16px',
              minHeight: 60,
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? ACCENT_SILVER : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? `2px solid ${ACCENT_SILVER}` : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
            }}
          >
            {TAB_LABELS_ES[tab]}
          </button>
        )
      })}
    </nav>
  )
}
