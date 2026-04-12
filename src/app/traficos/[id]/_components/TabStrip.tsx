'use client'

import { useState, type ReactNode } from 'react'
import { ACCENT_CYAN, BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW, TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'
import { useTrack } from '@/lib/telemetry/useTrack'

export interface TabDef {
  id: string
  label: string
  content: ReactNode
}

export function TabStrip({ tabs, traficoId, defaultTab }: { tabs: TabDef[]; traficoId: string; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id)
  const track = useTrack()

  return (
    <div
      style={{
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        boxShadow: GLASS_SHADOW,
        overflow: 'hidden',
      }}
    >
      <div
        role="tablist"
        aria-label="Secciones del tráfico"
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 12px 0',
          borderBottom: `1px solid ${BORDER}`,
          overflowX: 'auto',
        }}
      >
        {tabs.map((t) => {
          const selected = t.id === active
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setActive(t.id)
                track('page_view', {
                  entityType: 'trafico_tab',
                  entityId: traficoId,
                  metadata: { tab: t.id },
                })
              }}
              style={{
                minHeight: 60,
                padding: '14px 18px',
                background: 'transparent',
                border: 'none',
                borderBottom: selected ? `2px solid ${ACCENT_CYAN}` : '2px solid transparent',
                color: selected ? TEXT_PRIMARY : TEXT_MUTED,
                fontSize: 13,
                fontWeight: selected ? 700 : 500,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" style={{ padding: 20 }}>
        {tabs.find((t) => t.id === active)?.content ?? null}
      </div>
    </div>
  )
}
