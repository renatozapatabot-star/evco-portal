'use client'

import { useId, useState } from 'react'
import type { ReactNode } from 'react'

export interface PortalTab {
  id: string
  label: ReactNode
  content: ReactNode
  /** Optional count/badge shown next to label. */
  count?: number
}

export interface PortalTabsProps {
  tabs: PortalTab[]
  /** Uncontrolled: starts on `defaultTabId` (or first tab). */
  defaultTabId?: string
  /** Controlled: external state for `activeTabId` + `onTabChange`. */
  activeTabId?: string
  onTabChange?: (id: string) => void
  className?: string
  ariaLabel?: string
}

/**
 * Tabs primitive — composes `.portal-tabs` + `.portal-tab` with the
 * unified motion system from portal-components.css. Used on detail
 * pages (/embarques/[id], /pedimentos/[id], /expedientes/[id]).
 */
export function PortalTabs({
  tabs,
  defaultTabId,
  activeTabId: controlled,
  onTabChange,
  className,
  ariaLabel,
}: PortalTabsProps) {
  const gen = useId()
  const [internal, setInternal] = useState<string>(defaultTabId ?? tabs[0]?.id ?? '')
  const active = controlled ?? internal
  const current = tabs.find((t) => t.id === active) ?? tabs[0]

  function handleChange(id: string) {
    if (controlled === undefined) setInternal(id)
    onTabChange?.(id)
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--portal-line-1)',
          marginBottom: 'var(--portal-s-6)',
        }}
      >
        {tabs.map((t) => {
          const isActive = t.id === active
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${gen}-tab-${t.id}`}
              aria-selected={isActive}
              aria-controls={`${gen}-panel-${t.id}`}
              onClick={() => handleChange(t.id)}
              style={{
                padding: '12px 18px',
                fontFamily: 'var(--portal-font-mono)',
                fontSize: 'var(--portal-fs-micro)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: isActive ? 'var(--portal-fg-1)' : 'var(--portal-fg-4)',
                borderBottom: `2px solid ${isActive ? 'var(--portal-green-2)' : 'transparent'}`,
                marginBottom: -1,
                background: 'transparent',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {t.label}
              {typeof t.count === 'number' && (
                <span
                  style={{
                    fontSize: 'var(--portal-fs-micro)',
                    color: 'var(--portal-fg-5)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={`${gen}-panel-${current?.id}`}
        aria-labelledby={`${gen}-tab-${current?.id}`}
      >
        {current?.content}
      </div>
    </div>
  )
}
